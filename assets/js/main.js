/* =====================================================================
   main.js —— 幻灯片导航、开机动画、终端、计数器、复制、音效控制
   ===================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var slides = $$('.slide');
  var total = slides.length;
  var current = -1;
  var animating = false;
  var autoTimer = null;
  var autoOn = false;
  var tipTimer = null;

  /* ==================================================================
     1. 开机
     ================================================================== */
  var boot = $('#boot');
  var bootBar = $('#bootBar');
  var bootTip = $('#bootTip');
  var enterBtn = $('#enterBtn');
  var tips = [
    '正在加载区块…',
    '正在生成地形…',
    '正在校准红石频率…',
    '正在唤醒假人…',
    '正在用扳手敲一下机箱…',
    '就绪。'
  ];

  function runBoot() {
    var p = 0;
    var i = 0;
    var tick = setInterval(function () {
      p += 4 + Math.random() * 9;
      if (p >= 100) { p = 100; clearInterval(tick); ready(); }
      bootBar.style.width = p + '%';
      var idx = Math.min(tips.length - 1, Math.floor(p / 100 * tips.length));
      if (idx !== i) { i = idx; bootTip.textContent = tips[idx]; }
    }, 110);
  }

  function ready() {
    bootTip.textContent = tips[tips.length - 1];
    enterBtn.classList.add('is-ready');
    enterBtn.focus({ preventScroll: true });
  }

  function enter() {
    if (!enterBtn.classList.contains('is-ready') || boot.classList.contains('is-gone')) return;
    window.SFX.unlock();
    if (!window.SFX.muted) {
      window.SFX.chime();
      window.SFX.startAmbient();
    }
    syncSoundBtn();
    if (window.SFX.muted) window.SFX.stopAmbient();
    boot.classList.add('is-gone');
    document.body.classList.remove('is-locked');
    document.body.classList.add('is-started');
    document.body.classList.add('has-pointer');
    setTimeout(function () { boot.style.display = 'none'; }, 1100);
    goTo(0, true);
    setTimeout(function () { window.SFX.whoosh('down'); }, 260);
  }

  enterBtn.addEventListener('click', enter);
  document.addEventListener('keydown', function (e) {
    if (!document.body.classList.contains('is-started') &&
        (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')) {
      if (enterBtn.classList.contains('is-ready')) { e.preventDefault(); enter(); }
    }
  });
  runBoot();

  /* ==================================================================
     2. 导航
     ================================================================== */
  var progressBar = $('#progressBar');
  var dotsWrap = $('#dots');
  var slideIndexEl = $('#slideIndex');

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // 构建导航点
  slides.forEach(function (s, i) {
    var b = document.createElement('button');
    b.className = 'dot';
    b.setAttribute('aria-label', '第 ' + (i + 1) + ' 页：' + (s.dataset.title || ''));
    b.innerHTML = '<em>' + pad(i + 1) + ' ' + (s.dataset.title || '') + '</em><i></i>';
    b.addEventListener('click', function () { goTo(i); });
    dotsWrap.appendChild(b);
  });
  var dots = $$('.dot');

  function goTo(i, instant) {
    if (i < 0) i = 0;
    if (i > total - 1) i = total - 1;
    if (i === current) return;

    var dir = i > current ? 'down' : 'up';

    slides.forEach(function (s, j) {
      if (j === i) {
        s.classList.remove('is-left', 'is-past');
        void s.offsetWidth;         // 强制重排，让入场动画重播
        s.classList.add('is-active');
      } else {
        s.classList.remove('is-active');
        s.classList.add('is-left');
        s.classList.toggle('is-past', j < i);
      }
    });

    current = i;

    if (!instant) window.SFX.whoosh(dir);

    progressBar.style.width = ((i + 1) / total * 100) + '%';
    slideIndexEl.textContent = pad(i + 1);
    dots.forEach(function (d, j) {
      d.classList.toggle('is-active', j === i);
      d.classList.toggle('is-done', j < i);
    });
    if (window.__fxSlide) window.__fxSlide(i);

    // 页面内滚动复位
    var body = $('.slide-body', slides[i]);
    if (body) body.scrollTop = 0;

    runCounters(slides[i]);
    onSlideEnter(i);
  }

  function next() { if (current < total - 1) goTo(current + 1); }
  function prev() { if (current > 0) goTo(current - 1); }

  /* 滚轮 */
  var wheelAcc = 0, wheelLock = 0;
  window.addEventListener('wheel', function (e) {
    if (!document.body.classList.contains('is-started')) return;
    if ($('#help').classList.contains('is-open')) return;

    // 内容可滚动时优先滚内容
    var scroller = e.target.closest && e.target.closest('.slide-body');
    if (scroller && scroller.scrollHeight > scroller.clientHeight + 4) {
      var atTop = scroller.scrollTop <= 1;
      var atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
      if (!(atBottom && e.deltaY > 0) && !(atTop && e.deltaY < 0)) return;
    }

    var now = Date.now();
    if (now < wheelLock) return;
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) < 42) return;
    if (wheelAcc > 0) next(); else prev();
    wheelAcc = 0;
    wheelLock = now + 820;
  }, { passive: true });

  /* 键盘 */
  document.addEventListener('keydown', function (e) {
    if (e.target.matches && e.target.matches('input,textarea')) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (!document.body.classList.contains('is-started')) return;

    switch (e.key) {
      case 'ArrowDown': case 'PageDown': case ' ': case 'Spacebar':
        e.preventDefault(); next(); break;
      case 'ArrowUp': case 'PageUp':
        e.preventDefault(); prev(); break;
      case 'ArrowRight': case 'Enter':
        next(); break;
      case 'ArrowLeft':
        prev(); break;
      case 'Home': goTo(0); break;
      case 'End': goTo(total - 1); break;
      case 'm': case 'M': toggleSound(); break;
      case 'p': case 'P': toggleAuto(); break;
      case 'f': case 'F': toggleFull(); break;
      case '?': case '/': toggleHelp(); break;
      case 'Escape': closeHelp(); break;
    }
  });

  /* 触摸 */
  var tsX = 0, tsY = 0, tsT = 0;
  window.addEventListener('touchstart', function (e) {
    tsX = e.touches[0].clientX; tsY = e.touches[0].clientY; tsT = Date.now();
  }, { passive: true });
  window.addEventListener('touchend', function (e) {
    if (!document.body.classList.contains('is-started')) return;
    if (Date.now() - tsT > 800) return;
    var dx = e.changedTouches[0].clientX - tsX;
    var dy = e.changedTouches[0].clientY - tsY;

    // 内容还能滚动时，先让内容滚
    var scroller = e.target.closest && e.target.closest('.slide-body');
    if (scroller && scroller.scrollHeight > scroller.clientHeight + 8) {
      var atTop = scroller.scrollTop <= 1;
      var atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
      if (!(atBottom && dy < 0) && !(atTop && dy > 0)) return;
    }

    if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx) * 1.4) {
      if (dy < 0) next(); else prev();
    } else if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      if (dx < 0) next(); else prev();
    }
  }, { passive: true });

  /* 页内按钮跳转 */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-goto]');
    if (!t) return;
    var id = t.getAttribute('data-goto');
    var idx = slides.findIndex(function (s) { return s.dataset.id === id; });
    if (idx >= 0) goTo(idx);
  });

  /* ==================================================================
     3. 计数器
     ================================================================== */
  function runCounters(slide) {
    $$('[data-count]', slide).forEach(function (el) {
      if (el.dataset.done === '1') return;
      el.dataset.done = '1';
      var raw = el.dataset.count;
      var dec = parseInt(el.dataset.decimals || '0', 10);

      // 像 1.21.8 这种多段版本号，直接落字
      if ((raw.match(/\./g) || []).length > 1) {
        el.textContent = raw;
        el.classList.add('pop');
        return;
      }

      var target = parseFloat(raw) || 0;
      var t0 = performance.now();
      var dur = 1500;
      var lastTick = 0;

      function step(now) {
        var p = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        var v = target * e;
        el.textContent = dec > 0 ? v.toFixed(dec) : Math.round(v).toString();
        if (now - lastTick > 90 && p < 1) { lastTick = now; window.SFX.tick(); }
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = dec > 0 ? target.toFixed(dec) : target.toString();
      }
      requestAnimationFrame(step);
    });
  }

  /* ==================================================================
     4. 进入某页的特殊处理
     ================================================================== */
  var cmdBooted = false;
  function onSlideEnter(i) {
    var id = slides[i].dataset.id;
    if (id === 'cmd' && !cmdBooted) {
      cmdBooted = true;
      setTimeout(function () { runCommand('help', true); }, 900);
    }
    if (id === 'ledger') {
      setTimeout(function () { window.SFX.chime(); }, 400);
    }
  }

  /* ==================================================================
     5. 终端
     ================================================================== */
  var termBody = $('#termBody');
  var termForm = $('#termForm');
  var termInput = $('#termInput');
  var cmdQueue = [];
  var busy = false;

  var CMDS = {
    help: function () {
      return [
        ['t-info', '可用指令：home / warp / spawn / back / flyplayer / workbench / enderchest / anvil'],
        ['t-info', '　　　　　tps / mspt / gc / bot / co / tpa / tell / afk / realname / reg / l'],
        ['t-dim', '点右侧的指令按钮，或直接在这里敲。']
      ];
    },
    home: function () {
      return [
        ['t-ok', '→ 已传送到家：温暖的木屋 (312, 68, -104)'],
        ['t-dim', '/sethome 名称 可以新设一个家，最多 20 个。']
      ];
    },
    warp: function () {
      return [
        ['t-info', '路径点 UI 已打开：生活区 / 刷怪塔 / 交易所 / 界外之地'],
        ['t-dim', '/warp 名称 可直接传送，/spawn 回出生点。']
      ];
    },
    spawn: function () { return [['t-ok', '→ 已返回出生点 (0, 72, 0)。欢迎回来。']]; },
    back: function () { return [['t-ok', '→ 已回到上一个位置。下界摔下去也能捡回东西。']]; },
    flyplayer: function () {
      return [
        ['t-ok', '范围飞行已启用：以当前位置为中心 50 格。'],
        ['t-dim', '出范围会自动落下，记得带水桶。']
      ];
    },
    workbench: function () { return [['t-ok', '工作台已打开（远程）。']]; },
    enderchest: function () { return [['t-ok', '末影箱已打开（远程）。']]; },
    anvil: function () { return [['t-ok', '铁砧已打开（远程）。']]; },
    disposal: function () { return [['t-ok', '垃圾桶已打开。丢进去的东西不会回来，想清楚。']]; },
    tps: function () {
      return [
        ['t-ok', 'TPS: 20.00 (1m) / 19.98 (5m) / 19.95 (15m)'],
        ['t-dim', '20 是满值，掉到 15 以下就该有人在群里喊了。']
      ];
    },
    mspt: function () {
      return [
        ['t-ok', 'MSPT: 8.42ms (avg) · 12.10ms (max)'],
        ['t-dim', '每游戏刻耗时，超过 50ms 就是真卡。']
      ];
    },
    gc: function () {
      return [
        ['t-info', '运行时长：62d 07h 12m'],
        ['t-info', '实体：1,842 · 区块：12,663 · 内存：11.2G / 32G'],
        ['t-dim', '数据仅供展示，实际情况以游戏内为准。']
      ];
    },
    bot: function () {
      return [
        ['t-info', '假人列表：AFK_Gate（挂机中）· Iron_Golem（攻击中）'],
        ['t-ok', '服务端自带假人：不会饿死、重启不丢、空手右键看背包。'],
        ['t-warn', '注意：移除假人时会爆浆，别拿它当箱子。']
      ];
    },
    co: function () {
      return [
        ['t-ok', '查询模式已开启（/co i）。'],
        ['t-info', '左键方块查放置 / 破坏记录，右键容器查互动记录。'],
        ['t-dim', '适用于发现家被炸、东西被偷——抓贼用。']
      ];
    },
    tpa: function () { return [['t-info', '传送请求已发送，等待对方 /tpaccept。']]; },
    tell: function () { return [['t-info', '私聊已发送。']]; },
    afk: function () { return [['t-ok', '你已进入挂机状态，移动或说话即可恢复。']]; },
    realname: function () { return [['t-info', '你的真实名称：Steve（昵称：方块人）']]; },
    reg: function () { return [['t-ok', '注册成功。下次进服用 /l 密码 登录。']]; },
    l: function () { return [['t-ok', '登录成功，欢迎回来。']]; },
    linkaccount: function () {
      return [
        ['t-warn', '账号绑定请按顺序：基岩版先清空物品栏 → Java 版 /linkaccount <基岩名>（不带 BE.）'],
        ['t-info', '把聊天框里返回的命令，拿去基岩版里执行，被踢出后即绑定成功。']
      ];
    },
    tpsreset: function () { return [['t-dim', '没有这个指令。']]; }
  };

  function pushLine(cls, text) {
    var div = document.createElement('div');
    div.className = 't-line ' + cls;
    div.textContent = text;
    termBody.appendChild(div);
    termBody.scrollTop = termBody.scrollHeight;
    return div;
  }

  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  async function typeLine(text) {
    var div = document.createElement('div');
    div.className = 't-line t-cmd';
    termBody.appendChild(div);
    for (var i = 0; i < text.length; i++) {
      div.textContent = text.slice(0, i + 1);
      if (i % 2 === 0) window.SFX.type();
      termBody.scrollTop = termBody.scrollHeight;
      await wait(16 + Math.random() * 22);
    }
    await wait(120);
  }

  async function execCommand(raw) {
    var cmd = raw.trim();
    if (!cmd) return;
    if (cmd.charAt(0) === '/') cmd = cmd.slice(1);
    var parts = cmd.split(/\s+/);
    var head = parts[0].toLowerCase();
    var sub = (parts[1] || '').toLowerCase();

    await typeLine('/' + cmd);

    var out = null;

    if (head === 'flyplayer') {
      out = sub === 'off'
        ? [['t-ok', '范围飞行已关闭。']]
        : [['t-ok', '范围飞行已启用：50 格。']];
    } else if (head === 'bot' && sub === 'list') {
      out = CMDS.bot();
    } else if (head === 'op' || head === 'sudo' || head === 'give' || head === 'gamemode' || head === 'creative') {
      out = [['t-err', '想得美。这服务器没有那种东西。']];
      window.SFX.error();
    } else if (CMDS[head]) {
      out = CMDS[head]();
    } else if (head === 'clear' || head === 'cls') {
      termBody.innerHTML = '';
      return;
    } else {
      out = [['t-err', '未知指令：「' + cmd + '」。输入 help 看看能用什么。']];
      window.SFX.error();
    }

    for (var i = 0; i < out.length; i++) {
      await wait(i === 0 ? 130 : 110);
      pushLine(out[i][0], out[i][1]);
    }
    await wait(60);
  }

  function drain() {
    if (busy || !cmdQueue.length) return;
    busy = true;
    var cmd = cmdQueue.shift();
    execCommand(cmd).then(function () {
      busy = false;
      drain();
    });
  }

  function runCommand(cmd, silent) {
    cmdQueue.push(cmd);
    if (!silent) window.SFX.click();
    drain();
  }

  if (termForm) {
    termForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = termInput.value;
      if (!v.trim()) { window.SFX.error(); return; }
      runCommand(v);
      termInput.value = '';
    });
  }

  $$('.cmd-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var c = chip.dataset.cmd || '';
      if (termInput) {
        termInput.value = c;
        termInput.focus({ preventScroll: true });
      }
      runCommand(c);
    });
  });

  /* ==================================================================
     6. 赞助名单跑马灯
     ================================================================== */
  var sponsors = [
    ['尤金', '333.33'], ['三玖', '230'], ['猫猫', '100'], ['青', '80'],
    ['默小武', '46.28'], ['Rare_exe', '35'], ['z1X_delete', '30.66'], ['SiYue4', '30'],
    ['御风', '30'], ['一年之冬', '20'], ['火力覆盖真君', '20'], ['梦神', '20'],
    ['好大一只zzk', '13.14'], ['DRC', '7.22']
  ];
  var track = $('#marqueeTrack');
  if (track) {
    var html = '';
    sponsors.forEach(function (s, i) {
      html += '<span class="sp"' + (i === 0 ? ' data-top="1"' : '') + '>' + s[0] +
              '<b>¥' + s[1] + '</b></span>';
    });
    track.innerHTML = html + html; // 复制一份，实现无缝循环
  }

  /* ==================================================================
     7. 复制
     ================================================================== */
  var toast = $('#toast');
  var toastText = $('#toastText');
  var toastTimer = null;

  function showToast(text, ok) {
    toastText.textContent = text;
    toast.className = 'toast is-show' + (ok ? ' is-ok' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.className = 'toast'; }, 2000);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (e) { return false; }
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-copy]');
    if (!el) return;
    var text = el.getAttribute('data-copy');
    copyText(text).then(function () {
      showToast('已复制：' + text, true);
      window.SFX.success();
      el.classList.add('copied');
      setTimeout(function () { el.classList.remove('copied'); }, 700);
    });
  });

  /* ==================================================================
     8. 控制按钮
     ================================================================== */
  var btnSound = $('#btnSound');
  var btnAuto = $('#btnAuto');
  var btnFull = $('#btnFull');
  var btnHelp = $('#btnHelp');

  function syncSoundBtn() {
    btnSound.setAttribute('aria-pressed', window.SFX.muted ? 'false' : 'true');
  }
  function toggleSound() {
    window.SFX.unlock();
    var m = window.SFX.toggleMute();
    syncSoundBtn();
    if (!m) { window.SFX.click(); window.SFX.startAmbient(); }
    showToast(m ? '已静音' : '声音已开启', !m);
  }
  btnSound.addEventListener('click', toggleSound);
  syncSoundBtn();

  function toggleAuto() {
    autoOn = !autoOn;
    btnAuto.setAttribute('aria-pressed', autoOn ? 'true' : 'false');
    clearInterval(autoTimer);
    if (autoOn) {
      autoTimer = setInterval(function () {
        if (current >= total - 1) { toggleAuto(); return; }
        next();
      }, 13000);
      showToast('自动播放已开启 · 每 13 秒翻页', false);
    } else {
      showToast('自动播放已关闭', false);
    }
  }
  btnAuto.addEventListener('click', toggleAuto);

  function toggleFull() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen && document.exitFullscreen();
    }
  }
  btnFull.addEventListener('click', toggleFull);

  var help = $('#help');
  function toggleHelp() {
    help.classList.toggle('is-open');
    help.setAttribute('aria-hidden', help.classList.contains('is-open') ? 'false' : 'true');
  }
  function closeHelp() {
    help.classList.remove('is-open');
    help.setAttribute('aria-hidden', 'true');
  }
  btnHelp.addEventListener('click', toggleHelp);
  $('#helpClose').addEventListener('click', closeHelp);
  help.addEventListener('click', function (e) {
    if (e.target === help) closeHelp();
  });

  $('#replay').addEventListener('click', function () {
    window.SFX.chime();
    goTo(0);
  });

  /* ==================================================================
     9. 杂项
     ================================================================== */
  // 自动播放时鼠标操作暂停
  ['pointerdown', 'keydown'].forEach(function (evt) {
    window.addEventListener(evt, function () {
      if (autoOn && evt === 'pointerdown') { /* 保留自动播放，只重置间隔 */ }
    });
  });

  // 任何一次手势都确保音频上下文被唤醒（deep link 直接进入时可能仍挂起）
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
    window.addEventListener(evt, function () {
      if (!window.SFX.ready) { window.SFX.unlock(); return; }
      window.SFX.init();
    }, { once: true, passive: true });
  });

  // 失焦时暂停环境音，回来再开
  document.addEventListener('visibilitychange', function () {
    if (!window.SFX.ready) return;
    if (document.hidden) { window.SFX.stopAmbient(); }
    else if (!window.SFX.muted) { window.SFX.startAmbient(); }
  });

  // 调试 / 直达：#skip 跳过开机，#s=3 直接到第 3 页
  (function devHook() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    var m = h.match(/s=(\d+)/);
    if (h.indexOf('skip') >= 0) {
      ready();
      setTimeout(function () {
        enter();
        if (m) setTimeout(function () { goTo(parseInt(m[1], 10) - 1, true); }, 60);
      }, 120);
    }
  })();

  // 首屏提示
  window.addEventListener('load', function () {
    setTimeout(function () {
      if (!document.body.classList.contains('is-started')) {
        bootTip.textContent = tips[tips.length - 1];
      }
    }, 2400);
  });
})();
