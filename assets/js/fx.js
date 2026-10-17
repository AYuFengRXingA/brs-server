/* =====================================================================
   fx.js —— 背景像素地形、星光、粒子、光标、卡片倾斜
   ===================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.getElementById('bg-canvas');
  var ctx = canvas && canvas.getContext('2d', { alpha: true });

  var W = 0, H = 0, DPR = 1;
  var stars = [];
  var blocks = [];
  var layers = [];
  var skyGrad = null;
  var mouseX = 0, mouseY = 0, easeX = 0, easeY = 0;
  var t = 0;
  var slideShift = 0;

  /* ---------- 伪随机 ---------- */
  function rng(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
  }

  /* ---------- 像素地形（离屏） ---------- */
  function buildTerrain(w, h, cfg) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    var g = c.getContext('2d');
    var r = rng(cfg.seed);
    var step = cfg.step;
    var cols = Math.ceil(w / step) + 1;

    /* 生成阶梯高度（像素地形） */
    var hs = [];
    var base = h * cfg.base;
    var amp = h * cfg.amp;
    var phase = r() * 100;
    var walk = 0;
    for (var i = 0; i < cols; i++) {
      var n = Math.sin(i * cfg.freq + phase) * 0.55
            + Math.sin(i * cfg.freq * 2.3 + phase * 1.7) * 0.28
            + Math.sin(i * cfg.freq * 0.37 + phase * 0.3) * 0.6;
      walk += (r() - 0.5) * 0.35;
      walk *= 0.94;
      hs.push(Math.round((base + (n + walk) * amp) / step) * step);
    }

    /* 山体：整块多边形 + 由上到下的渐隐 */
    var top = Math.min.apply(null, hs);
    var body = g.createLinearGradient(0, top, 0, h);
    body.addColorStop(0, cfg.bodyTop);
    body.addColorStop(0.55, cfg.bodyMid);
    body.addColorStop(1, cfg.bodyBottom);

    g.beginPath();
    g.moveTo(0, hs[0]);
    for (var x = 1; x < cols; x++) {
      g.lineTo(x * step, hs[x - 1]);
      g.lineTo(x * step, hs[x]);
    }
    g.lineTo(w, hs[cols - 1]);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fillStyle = body;
    g.fill();

    /* 山脊高光 */
    g.beginPath();
    g.moveTo(0, hs[0]);
    for (var k = 1; k < cols; k++) {
      g.lineTo(k * step, hs[k - 1]);
      g.lineTo(k * step, hs[k]);
    }
    g.strokeStyle = cfg.edge;
    g.lineWidth = Math.max(1.2, step * 0.11);
    g.lineJoin = 'miter';
    g.shadowColor = cfg.edge;
    g.shadowBlur = step * 1.5;
    g.stroke();
    g.shadowBlur = 0;

    /* 稀疏的方块树 */
    if (cfg.trees) {
      for (var t = 0; t < cols; t++) {
        if (r() > 0.972) {
          var th = step * (2 + Math.floor(r() * 4));
          g.fillStyle = cfg.tree;
          g.fillRect(t * step + step * 0.34, hs[t] - th, Math.max(3, step * 0.32), th);
        }
      }
    }

    /* 底部压暗，融进页面背景 */
    var fade = g.createLinearGradient(0, h * 0.72, 0, h);
    fade.addColorStop(0, 'rgba(4,6,12,0)');
    fade.addColorStop(1, 'rgba(4,6,12,0.35)');
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);

    return c;
  }

  function readViewport() {
    W = document.documentElement.clientWidth || window.innerWidth;
    H = document.documentElement.clientHeight || window.innerHeight;
  }

  function build() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    readViewport();
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#070a12');
    skyGrad.addColorStop(0.42, '#060811');
    skyGrad.addColorStop(1, '#04050a');

    var sCount = reduce ? 40 : Math.min(190, Math.round(W * H / 11000));
    stars = [];
    for (var i = 0; i < sCount; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.72,
        r: Math.random() < 0.86 ? 1 : 1.8,
        a: 0.2 + Math.random() * 0.65,
        ph: Math.random() * Math.PI * 2,
        sp: 0.4 + Math.random() * 1.6,
        hue: Math.random() < 0.22 ? '169,123,255' : '120,210,255'
      });
    }

    var bCount = reduce ? 0 : Math.min(26, Math.round(W / 70));
    blocks = [];
    for (var j = 0; j < bCount; j++) {
      blocks.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: 3 + Math.random() * 8,
        vy: -(6 + Math.random() * 18) / 60,
        vx: (Math.random() - 0.5) * 0.25,
        a: 0.12 + Math.random() * 0.4,
        rot: Math.random() * Math.PI
      });
    }

    var exW = W + 240;
    /* 底部只需一条隐约的像素地平线：描边为主，不要厚雾 */
    layers = [
      {
        depth: 0.22,
        cv: buildTerrain(exW, H, { seed: 4477, step: 22, base: 0.885, amp: 0.042, freq: 0.03,
          bodyTop: 'rgba(6,10,20,0)', bodyMid: 'rgba(6,10,20,0)', bodyBottom: 'rgba(6,10,20,0)',
          edge: 'rgba(67,230,255,0.55)', tree: 'rgba(67,230,255,0.35)', trees: false })
      },
      {
        depth: 0.46,
        cv: buildTerrain(exW, H, { seed: 991, step: 14, base: 0.945, amp: 0.028, freq: 0.042,
          bodyTop: 'rgba(4,6,12,0)', bodyMid: 'rgba(4,6,12,0)', bodyBottom: 'rgba(4,6,12,0)',
          edge: 'rgba(169,123,255,0.6)', tree: 'rgba(169,123,255,0.4)', trees: false })
      }
    ];
  }

  /* ---------- 绘制 ---------- */
  function frame() {
    if (!ctx) return;
    t += 0.016;
    easeX += (mouseX - easeX) * 0.045;
    easeY += (mouseY - easeY) * 0.045;

    ctx.clearRect(0, 0, W, H);

    /* 天空 */
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    /* 顶部光晕 */
    var glow = ctx.createRadialGradient(W * (0.5 + easeX * 0.12), H * 0.1, 0,
                                        W * (0.5 + easeX * 0.12), H * 0.1, H * 0.8);
    glow.addColorStop(0, 'rgba(50,120,255,0.10)');
    glow.addColorStop(0.5, 'rgba(90,60,200,0.05)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    /* 星星 */
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = 0.55 + 0.45 * Math.sin(t * s.sp + s.ph);
      var px = s.x + easeX * 12;
      var py = s.y + easeY * 8;
      ctx.fillStyle = 'rgba(' + s.hue + ',' + (s.a * tw).toFixed(3) + ')';
      ctx.fillRect(px, py, s.r, s.r);
      if (s.r > 1.5) {
        ctx.fillStyle = 'rgba(' + s.hue + ',' + (s.a * tw * 0.16).toFixed(3) + ')';
        ctx.fillRect(px - 3, py - 3, 7, 7);
      }
    }

    /* 地平线光 */
    var hy = H * 0.74;
    var hor = ctx.createLinearGradient(0, H * 0.3, 0, H);
    hor.addColorStop(0, 'rgba(20,50,120,0)');
    hor.addColorStop(0.52, 'rgba(26,78,160,0.10)');
    hor.addColorStop(0.78, 'rgba(46,126,216,0.30)');
    hor.addColorStop(0.93, 'rgba(58,70,178,0.22)');
    hor.addColorStop(1, 'rgba(24,18,54,0.05)');
    ctx.fillStyle = hor;
    ctx.fillRect(0, 0, W, H);

    var hg = ctx.createRadialGradient(W * 0.5, hy + H * 0.04, 0, W * 0.5, hy + H * 0.04, W * 0.72);
    hg.addColorStop(0, 'rgba(122,214,255,0.16)');
    hg.addColorStop(0.45, 'rgba(70,110,230,0.11)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, W, H);

    /* 地形层 */
    for (var k = 0; k < layers.length; k++) {
      var L = layers[k];
      var off = -L.depth * easeX * 60 - slideShift * L.depth * 40 - 120;
      ctx.drawImage(L.cv, off, 0, L.cv.width, L.cv.height);
    }

    /* 漂浮方块 */
    for (var b = 0; b < blocks.length; b++) {
      var p = blocks[b];
      p.y += p.vy;
      p.x += p.vx;
      p.rot += 0.002;
      if (p.y < -20) { p.y = H + 20; p.x = Math.random() * W; }
      if (p.x < -20) p.x = W + 20;
      if (p.x > W + 20) p.x = -20;

      ctx.save();
      ctx.translate(p.x + easeX * 20, p.y + easeY * 12);
      ctx.rotate(p.rot * 0.35);
      ctx.fillStyle = 'rgba(90,200,255,' + p.a.toFixed(2) + ')';
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
      ctx.fillStyle = 'rgba(169,123,255,' + (p.a * 0.5).toFixed(2) + ')';
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, Math.max(1, p.s * 0.22));
      ctx.restore();
    }

    requestAnimationFrame(frame);
  }

  /* ---------- 光标 ---------- */
  var glowEl = document.getElementById('cursorGlow');
  var dotEl = document.getElementById('cursorDot');
  var gx = window.innerWidth / 2, gy = window.innerHeight / 2;
  var dx = gx, dy = gy;

  function pointerMove(e) {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    dx = e.clientX; dy = e.clientY;
    document.body.classList.add('has-pointer');
  }
  var following = false;
  function followCursor() {
    gx += (dx - gx) * 0.12;
    gy += (dy - gy) * 0.12;
    if (glowEl) glowEl.style.transform = 'translate3d(' + gx + 'px,' + gy + 'px,0)';
    if (dotEl) dotEl.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
    requestAnimationFrame(followCursor);
  }

  var hoverSel = 'a,button,input,.card,.ip-card,.cmd-chip,.mini-card,.stat,.sp,.dot,.chip,code[data-copy]';
  function bindCursor() {
    if (!glowEl || !dotEl) return;
    if (window.matchMedia('(hover:none)').matches) return;
    window.addEventListener('pointermove', pointerMove, { passive: true });
    document.addEventListener('pointerover', function (e) {
      if (e.target.closest && e.target.closest(hoverSel)) {
        document.body.classList.add('is-hovering');
        window.SFX && window.SFX.ready && window.SFX.hover();
      }
    });
    document.addEventListener('pointerout', function (e) {
      if (e.target.closest && e.target.closest(hoverSel)) {
        if (!(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(hoverSel))) {
          document.body.classList.remove('is-hovering');
        }
      }
    });
    document.addEventListener('mouseleave', function () {
      document.body.classList.remove('has-pointer');
    });
    if (!following) { following = true; followCursor(); }
  }

  /* ---------- 卡片倾斜 ---------- */
  function bindTilt() {
    if (window.matchMedia('(hover:none)').matches || reduce) return;
    document.addEventListener('pointermove', function (e) {
      var card = e.target.closest && e.target.closest('.card');
      if (!card) return;
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (px * 100) + '%');
      card.style.setProperty('--my', (py * 100) + '%');
      card.style.transform =
        'perspective(900px) rotateX(' + ((0.5 - py) * 9).toFixed(2) + 'deg) rotateY(' +
        ((px - 0.5) * 11).toFixed(2) + 'deg) translateY(-5px)';
    });
    document.addEventListener('pointerout', function (e) {
      var card = e.target.closest && e.target.closest('.card');
      if (!card) return;
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;
      card.style.transform = '';
    });
  }

  /* ---------- 鼠标视差（3D 方块层） ---------- */
  function bindParallax() {
    var cubes = document.querySelector('.cubes');
    if (!cubes || reduce) return;
    window.addEventListener('pointermove', function (e) {
      var x = (e.clientX / window.innerWidth - 0.5);
      var y = (e.clientY / window.innerHeight - 0.5);
      cubes.style.transform = 'translate3d(' + (x * -26).toFixed(1) + 'px,' + (y * -18).toFixed(1) + 'px,0)';
    }, { passive: true });
  }

  /* ---------- 交互音效绑定 ---------- */
  function bindSounds() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('button,a,.card,.chip');
      if (el && window.SFX && window.SFX.ready) window.SFX.click();
    });
  }

  /* ---------- 启动 ---------- */
  function start() {
    if (!canvas) return;
    build();
    bindCursor();
    bindTilt();
    bindParallax();
    bindSounds();
    requestAnimationFrame(frame);

    var rt;
    function scheduleRebuild() {
      clearTimeout(rt);
      rt = setTimeout(build, 160);
    }
    window.addEventListener('resize', scheduleRebuild);
    window.addEventListener('orientationchange', scheduleRebuild);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleRebuild);
    if (window.ResizeObserver) {
      new ResizeObserver(scheduleRebuild).observe(document.documentElement);
    }

    /* 供 main.js 调用：翻页时地形视差 */
    window.__fxSlide = function (i) { slideShift = i; };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();


