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
    // 画面が隠れている間は音を止めたままにする（CPU の指し手の音などで鳴り出さないように）
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
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
    const o = Object.assign({ type: 'sine', gain: 0.2, attack: 0.004, when: 0, slideTo: null, at: null, out: null }, opt);
    const t = o.at !== null ? o.at : ctx.currentTime + o.when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + o.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(o.out || master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // ---- BGM（8bit風の自作曲をその場で演奏） ----
  // 1トークン = 8分音符。'-' は前の音をのばす、'.' は休符。'|' は小節の区切り（読みやすさ用）
  const TRACKS = {
    // タイトル（メニュー）: 冒険の始まりを感じる堂々としたテーマ
    title: {
      bpm: 112,
      voices: [
        { type: 'square', gain: 0.045, notes: 'G4 - B4 - D5 - G5 - | F#5 - - E5 D5 - - - | E5 - C5 - A4 - C5 - | D5 - - - - - . . | G4 - B4 - D5 - G5 - | A5 - G5 - F#5 - E5 - | D5 - B4 - C5 - A4 - | G4 - - - - - . .' },
        { type: 'triangle', gain: 0.09, notes: 'G2 - D3 - G2 - D3 - | D2 - A2 - D2 - A2 - | C3 - G2 - A2 - E2 - | D2 - A2 - D2 - D3 - | G2 - D3 - G2 - D3 - | C3 - G2 - D3 - A2 - | B2 - G2 - C3 - D3 - | G2 - D3 - G2 - - -' }
      ]
    },
    // ステージ選択: 軽快に歩いていくような曲
    map: {
      bpm: 108,
      voices: [
        { type: 'square', gain: 0.04, notes: 'F5 . C5 . A4 . C5 . | D5 . C5 . A4 - - - | Bb4 . D5 . F5 . D5 . | C5 - - - - - . . | F5 . C5 . A4 . C5 . | D5 . F5 . G5 - - - | A5 . G5 . F5 . E5 . | F5 - - - - - . .' },
        { type: 'triangle', gain: 0.09, notes: 'F2 . C3 . F2 . C3 . | D2 . A2 . D2 . A2 . | Bb2 . F2 . Bb2 . F2 . | C3 . G2 . C3 . G2 .' }
      ]
    },
    // 会話中: せりふの邪魔をしない、ゆったりした曲
    talk: {
      bpm: 84,
      voices: [
        { type: 'triangle', gain: 0.07, notes: 'B4 - - - G4 - - - | A4 - B4 - D5 - - - | C5 - - - B4 - - - | A4 - - - - - - - | G4 - - - E4 - - - | F#4 - G4 - A4 - - - | B4 - A4 - G4 - F#4 - | G4 - - - - - - -' },
        { type: 'triangle', gain: 0.07, notes: 'G2 - - - D3 - - - | D2 - - - A2 - - - | C3 - - - G2 - - - | D2 - - - A2 - - - | E2 - - - B2 - - - | D2 - - - A2 - - - | C3 - - - D3 - - - | G2 - - - D3 - - -' }
      ]
    },
    battle: {
      bpm: 140,
      voices: [
        { type: 'square', gain: 0.04, notes: 'A4 . A4 C5 E5 - D5 C5 | B4 - G4 - B4 - - - | C5 . C5 E5 A5 - G5 E5 | F5 - E5 - D5 - - - | A4 . A4 C5 E5 - D5 C5 | B4 - G4 - E5 - - - | F5 - E5 - D5 - C5 B4 | A4 - - - - - . .' },
        { type: 'triangle', gain: 0.09, notes: 'A2 A3 A2 A3 A2 A3 A2 A3 | G2 G3 G2 G3 G2 G3 G2 G3 | F2 F3 F2 F3 F2 F3 F2 F3 | E2 E3 E2 E3 E2 E3 E2 E3' }
      ]
    },
    boss: {
      bpm: 120,
      voices: [
        { type: 'square', gain: 0.04, notes: 'D5 - - - F5 - E5 - | D5 - C#5 - D5 - - - | A4 - - - Bb4 - A4 - | G4 - F4 - E4 - - - | D5 - - - F5 - A5 - | G#5 - - - A5 - - - | Bb5 - A5 - G5 - F5 - | E5 - C#5 - D5 - - -' },
        { type: 'triangle', gain: 0.1, notes: 'D2 - D3 - D2 - D3 - | D2 - D3 - D2 - D3 - | Bb1 - Bb2 - Bb1 - Bb2 - | A1 - A2 - A1 - A2 -' }
      ]
    }
  };

  const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteFreq(n) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(n);
    const semi = NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
    return 440 * Math.pow(2, (semi - 69) / 12);
  }
  // 各声部を「その拍で鳴らす音（周波数と長さ）」の配列に変換
  function compile(track) {
    return track.voices.map((v) => {
      const toks = v.notes.split(/\s+/).filter((t) => t && t !== '|');
      return { type: v.type, gain: v.gain, steps: toks.map((t, i) => {
        if (t === '-' || t === '.') return null;
        let len = 1;
        while (toks[i + len] === '-') len++;
        return { f: noteFreq(t), len };
      }) };
    });
  }

  let bgmOn = true, bgmName = null, bgmTimer = 0, bgmBus = null, bgmVoices = null, bgmStep = 0, bgmNext = 0, bgmStepDur = 0;

  function bgmTick() {
    const now = ctx.currentTime;
    if (bgmNext < now - 0.1) bgmNext = now + 0.05; // バックグラウンドから戻った時に一気に鳴らさない
    while (bgmNext < now + 0.25) {
      for (const v of bgmVoices) {
        const st = v.steps[bgmStep % v.steps.length];
        if (st) tone(st.f, st.len * bgmStepDur * 0.92, { type: v.type, gain: v.gain, attack: 0.01, at: bgmNext, out: bgmBus });
      }
      bgmStep++;
      bgmNext += bgmStepDur;
    }
  }

  function stopBgm() {
    if (!bgmBus) return;
    clearInterval(bgmTimer);
    const bus = bgmBus;
    bgmBus = null;
    try {
      bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
      setTimeout(() => bus.disconnect(), 800);
    } catch (e) { /* 無視 */ }
  }

  function playBgm(name) {
    if (name === bgmName && bgmBus) return;
    stopBgm();
    bgmName = name;
    if (!name || !soundOn || !bgmOn || !TRACKS[name] || !ensureContext()) return;
    const track = TRACKS[name];
    bgmVoices = compile(track);
    bgmStepDur = 60 / track.bpm / 2;
    bgmStep = 0;
    bgmBus = ctx.createGain();
    bgmBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bgmBus.gain.setTargetAtTime(1, ctx.currentTime, 0.3); // ふわっと始める
    bgmBus.connect(master);
    bgmNext = ctx.currentTime + 0.08;
    bgmTick();
    bgmTimer = setInterval(bgmTick, 60);
  }

  // アプリが裏に回ったら音を止め、戻ったら再開する（裏で BGM が鳴り続けないように）
  function onVisibility() {
    if (!ctx) return;
    if (document.hidden) {
      clearInterval(bgmTimer);
      bgmTimer = 0;
      ctx.suspend().catch(() => {});
    } else {
      ctx.resume().catch(() => {});
      if (bgmBus && !bgmTimer) bgmTimer = setInterval(bgmTick, 60);
    }
  }
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onVisibility);

  // 会話の「しゃべり音」
  function blip(freq) {
    if (!soundOn || !ensureContext()) return;
    tone(freq * (0.94 + Math.random() * 0.12), 0.04, { type: 'square', gain: 0.035, attack: 0.002 });
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
    confirm() { tone(988, 0.07, { type: 'square', gain: 0.06 }); tone(1480, 0.16, { type: 'square', gain: 0.06, when: 0.07 }); },
    error() { tone(150, 0.09, { type: 'square', gain: 0.04 }); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { type: 'triangle', gain: 0.13, when: i * 0.11 })); },
    lose() { [523, 415, 330].forEach((f, i) => tone(f, 0.4, { type: 'sine', gain: 0.15, when: i * 0.16 })); },
    draw() { tone(523, 0.3, { type: 'triangle', gain: 0.12 }); tone(659, 0.4, { type: 'triangle', gain: 0.12, when: 0.18 }); }
  };

  const VIBRATION = {
    tap: 8, select: 10, confirm: [12, 40, 20], move: 18, capture: [28], castle: [14, 60, 14],
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
    blip,
    bgm(name) { try { playBgm(name); } catch (e) { /* 無視 */ } },
    setBgm(on) {
      if (on === bgmOn) return; // 変化がなければ流れている曲をそのまま続ける
      bgmOn = on;
      const name = bgmName;
      if (!on) { stopBgm(); bgmName = name; } else if (name) { bgmName = null; this.bgm(name); }
    },
    setSound(on) {
      if (on === soundOn) return;
      soundOn = on;
      const name = bgmName;
      if (!on) { stopBgm(); bgmName = name; } else if (name) { bgmName = null; this.bgm(name); }
    },
    setHaptic(on) { hapticOn = on; },
    hapticSupported: canVibrate || isIOS
  };
})();
