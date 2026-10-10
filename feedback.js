/* シンプルチェス: 効果音（Web Audio で合成）と振動フィードバック */
(function () {
  'use strict';

  let ctx = null, master = null, noiseBuffer = null;
  let soundOn = true, hapticOn = true;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const canVibrate = typeof navigator.vibrate === 'function';

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
      // 木の打撃音に使うホワイトノイズ
      const len = Math.floor(ctx.sampleRate * 0.25);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // iOS などは最初のユーザー操作で音声を有効化する必要がある
  function unlock() {
    const c = ensureContext();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  }
  ['pointerdown', 'touchend', 'keydown'].forEach((ev) =>
    window.addEventListener(ev, unlock, { capture: true, passive: true }));

  function tone(freq, dur, opt) {
    const o = Object.assign({ type: 'sine', gain: 0.2, attack: 0.004, when: 0, slideTo: null }, opt);
    const t = ctx.currentTime + o.when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + o.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, opt) {
    const o = Object.assign({ freq: 1500, q: 1, gain: 0.4, when: 0 }, opt);
    const t = ctx.currentTime + o.when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = o.freq;
    f.Q.value = o.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // 駒を盤に置く「コトッ」という音
  function knock(when, strength) {
    const s = strength || 1;
    noise(0.06, { freq: 2200, q: 1.4, gain: 0.35 * s, when });
    noise(0.09, { freq: 900, q: 1.2, gain: 0.45 * s, when });
    tone(210, 0.1, { gain: 0.35 * s, slideTo: 120, when });
  }

  const SOUNDS = {
    tap() { tone(1250, 0.035, { type: 'triangle', gain: 0.07 }); noise(0.02, { freq: 4000, q: 2, gain: 0.08 }); },
    select() { tone(720, 0.05, { type: 'triangle', gain: 0.09 }); noise(0.025, { freq: 3000, q: 2, gain: 0.1 }); },
    move() { knock(0, 1); },
    capture() { knock(0, 1.25); knock(0.035, 0.8); },
    castle() { knock(0, 0.9); knock(0.12, 0.9); },
    promote() { knock(0, 1); [784, 988, 1319].forEach((f, i) => tone(f, 0.18, { type: 'triangle', gain: 0.1, when: 0.06 + i * 0.07 })); },
    check() { tone(988, 0.14, { type: 'triangle', gain: 0.12, when: 0.07 }); tone(1319, 0.22, { type: 'triangle', gain: 0.1, when: 0.15 }); },
    error() { tone(150, 0.09, { type: 'square', gain: 0.04 }); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { type: 'triangle', gain: 0.13, when: i * 0.11 })); },
    lose() { [523, 415, 330].forEach((f, i) => tone(f, 0.4, { type: 'sine', gain: 0.15, when: i * 0.16 })); },
    draw() { tone(523, 0.3, { type: 'triangle', gain: 0.12 }); tone(659, 0.4, { type: 'triangle', gain: 0.12, when: 0.18 }); }
  };

  const VIBRATION = {
    tap: 8, select: 10, move: 18, capture: [28], castle: [14, 60, 14],
    promote: [18, 40, 18], check: [12, 50, 25], error: [8, 40, 8],
    win: [30, 60, 30, 60, 60], lose: [80], draw: [30, 60, 30]
  };

  // iOS Safari は vibrate 非対応のため、スイッチ型チェックボックスの触覚フィードバックを利用する（iOS 18 以降）
  let hapticLabel = null;
  function iosTick() {
    if (!hapticLabel) {
      hapticLabel = document.createElement('label');
      hapticLabel.setAttribute('aria-hidden', 'true');
      hapticLabel.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      hapticLabel.appendChild(input);
      document.body.appendChild(hapticLabel);
    }
    hapticLabel.click();
  }

  function vibrate(name) {
    if (!hapticOn) return;
    if (canVibrate) {
      try { navigator.vibrate(VIBRATION[name] || 10); } catch (e) { /* 無視 */ }
    } else if (isIOS) {
      try { iosTick(); } catch (e) { /* 無視 */ }
    }
  }

  function sound(name) {
    if (!soundOn || !SOUNDS[name]) return;
    try { if (ensureContext()) SOUNDS[name](); } catch (e) { /* 無視 */ }
  }

  window.Feedback = {
    play(name) { sound(name); vibrate(name); },
    sound,
    vibrate,
    setSound(on) { soundOn = on; },
    setHaptic(on) { hapticOn = on; },
    hapticSupported: canVibrate || isIOS
  };
})();
