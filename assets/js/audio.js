/* =====================================================================
   audio.js —— 纯 WebAudio 合成音效，零素材文件
   暴露全局：window.SFX
   ===================================================================== */
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var ambient = null;
  var muted = false;
  var started = false;
  var lastHover = 0;
  var reduction = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function now() { return ctx ? ctx.currentTime : 0; }

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 20;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;

    master.connect(comp);
    comp.connect(ctx.destination);

    try {
      var saved = localStorage.getItem('brs-muted');
      if (saved === '1') muted = true;
    } catch (e) {}
    master.gain.value = muted ? 0 : 0.9;

    started = true;
    return ctx;
  }

  function noiseBuffer(seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* 短音：type = 波形 */
  function tone(freq, dur, type, gain, slideTo, delay) {
    if (!ctx || muted) return;
    var t0 = now() + (delay || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.1, t0 + Math.min(0.012, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noiseSweep(dur, f0, f1, gain, q) {
    if (!ctx || muted) return;
    var t0 = now();
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur + 0.05);
    var flt = ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.Q.value = q || 1.2;
    flt.frequency.setValueAtTime(f0, t0);
    flt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + dur * 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.04);
  }

  var SFX = {
    init: init,

    get ready() { return !!ctx; },
    get muted() { return muted; },

    /* 悬停：极轻的木质点击 */
    hover: function () {
      if (!ctx || muted) return;
      var t = performance.now();
      if (t - lastHover < 70) return;
      lastHover = t;
      tone(1180 + Math.random() * 260, 0.045, 'sine', 0.028);
    },

    /* 点击：短促下坠的方块音 */
    click: function () {
      if (!ctx || muted) return;
      tone(620, 0.09, 'triangle', 0.075, 300);
      noiseSweep(0.06, 2400, 900, 0.03, 2);
    },

    /* 翻页：方向性 whoosh */
    whoosh: function (dir) {
      if (!ctx || muted) return;
      var up = dir === 'down';
      noiseSweep(0.42, up ? 320 : 1600, up ? 1900 : 280, 0.085, 1.1);
      tone(up ? 180 : 260, 0.3, 'sine', 0.05, up ? 420 : 120);
    },

    /* 进入/揭示：三音和弦 */
    chime: function () {
      if (!ctx || muted) return;
      var base = 523.25;
      var notes = [1, 1.25, 1.5, 2];
      for (var i = 0; i < notes.length; i++) {
        tone(base * notes[i], 0.9 - i * 0.1, 'triangle', 0.05 - i * 0.007, null, i * 0.07);
      }
    },

    /* 成功 */
    success: function () {
      if (!ctx || muted) return;
      tone(660, 0.14, 'triangle', 0.07);
      tone(990, 0.22, 'triangle', 0.06, null, 0.09);
      tone(1320, 0.3, 'sine', 0.04, null, 0.18);
    },

    /* 失败 / 无效 */
    error: function () {
      if (!ctx || muted) return;
      tone(200, 0.16, 'square', 0.045, 140);
      tone(150, 0.2, 'sawtooth', 0.028, 90, 0.08);
    },

    /* 打字机 */
    type: function () {
      if (!ctx || muted) return;
      tone(1600 + Math.random() * 700, 0.018, 'square', 0.012);
    },

    /* 数字滚动 tick */
    tick: function () {
      if (!ctx || muted) return;
      tone(2200, 0.012, 'sine', 0.008);
    },

    /* 环境底噪层 + 缓慢和弦 */
    startAmbient: function () {
      if (!ctx || ambient) return;
      var g = ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(reduction ? 0.02 : 0.055, ctx.currentTime + 3);
      g.connect(master);

      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 520;
      lp.Q.value = 0.6;
      lp.connect(g);

      var osc = [];
      var freqs = [55, 82.5, 110, 164.81];
      freqs.forEach(function (f, i) {
        var o = ctx.createOscillator();
        o.type = i === 3 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = (i - 1.5) * 6;
        var og = ctx.createGain();
        og.gain.value = i === 3 ? 0.16 : 0.3 / (i + 1);
        o.connect(og); og.connect(lp);
        o.start();
        osc.push(o);
      });

      /* 缓慢滤波器扫动，像远处风声 */
      var lfo = ctx.createOscillator();
      lfo.frequency.value = 0.045;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain); lfoGain.connect(lp.frequency);
      lfo.start();

      /* 极轻的空气噪声 */
      var air = ctx.createBufferSource();
      air.buffer = noiseBuffer(4);
      air.loop = true;
      var airF = ctx.createBiquadFilter();
      airF.type = 'bandpass';
      airF.frequency.value = 900;
      airF.Q.value = 0.5;
      var airG = ctx.createGain();
      airG.gain.value = 0.035;
      air.connect(airF); airF.connect(airG); airG.connect(g);
      air.start();

      ambient = { g: g, nodes: osc.concat([lfo, air]) };

      /* 随机星点音：五声音阶 */
      var scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
      var self = this;
      (function sparkle() {
        if (!ambient) return;
        var wait = 5200 + Math.random() * 9000;
        setTimeout(function () {
          if (!ambient || muted) { sparkle(); return; }
          var f = scale[Math.floor(Math.random() * scale.length)];
          tone(f, 1.6, 'sine', 0.017);
          tone(f * 2, 1.2, 'sine', 0.006, null, 0.05);
          sparkle();
        }, wait);
      })();
    },

    stopAmbient: function () {
      if (!ambient) return;
      var a = ambient;
      ambient = null;
      try {
        a.g.gain.cancelScheduledValues(now());
        a.g.gain.setValueAtTime(a.g.gain.value, now());
        a.g.gain.exponentialRampToValueAtTime(0.0001, now() + 1.2);
        setTimeout(function () {
          a.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} });
        }, 1400);
      } catch (e) {}
    },

    setMuted: function (m) {
      muted = !!m;
      try { localStorage.setItem('brs-muted', muted ? '1' : '0'); } catch (e) {}
      if (master && ctx) {
        master.gain.cancelScheduledValues(now());
        master.gain.setValueAtTime(master.gain.value, now());
        master.gain.linearRampToValueAtTime(muted ? 0 : 0.9, now() + 0.25);
      }
      return muted;
    },

    toggleMute: function () { return SFX.setMuted(!muted); },

    /* 首次手势后调用 */
    unlock: function () {
      var c = init();
      if (c && c.state === 'suspended') c.resume();
      return c;
    }
  };

  window.SFX = SFX;
})();
