/* シンプルチェス: ストーリーの会話シーン（文字送り・しゃべり音・顔の切り替え） */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const fx = window.Feedback;
  const TYPE_MS = 32;

  // キャラごとの声の高さ（しゃべり音の周波数）
  const VOICE = {
    pipi: 1150, s1: 900, s2: 1300, s3: 620, s4: 760, s5: 230, s6: 840,
    s7: 400, s8: 340, s9: 280, s10: 210, noirKind: 560, me: 680
  };
  const SILENT_CHARS = /[\s、。！？!?…・「」『』（）()ー～]/;

  let deps = null;   // app.js から受け取る { stageInfo, setMusic, getMusic }
  let scene = null;  // 再生中の会話

  function speaker(who, ctx) {
    if (who === 'p') return { name: Story.PIPI.name, key: 'pipi', stage: 0, voice: VOICE.pipi };
    if (who === 'e') return { name: deps.stageInfo(ctx.stage).name, key: 's' + ctx.stage, stage: ctx.stage, voice: VOICE['s' + ctx.stage] };
    if (who === 'k') return { name: 'ノワール', key: 'noirKind', stage: 0, voice: VOICE.noirKind };
    if (who === 'me') return { name: 'きみ', key: null, me: true, voice: VOICE.me };
    return { name: '', key: null, voice: 0 };
  }

  // lines: [[話し手, せりふ], ...]  ctx: { stage, chapter }  onDone: 終わった後の処理
  function play(lines, ctx, onDone) {
    scene = { lines, ctx, onDone, i: -1, typing: false, timer: 0, key: undefined, prevMusic: deps.getMusic() };
    $('sceneChapter').textContent = ctx.chapter || '';
    $('scene').hidden = false;
    $('scene').className = 'scene' + (ctx.stage >= 9 ? ' dark' : '');
    deps.setMusic(ctx.stage >= 9 ? 'boss' : 'talk');
    $('scenePortrait').innerHTML = '';
    nextLine();
  }

  function nextLine() {
    if (!scene) return;
    if (scene.typing) { finishTyping(); return; }
    scene.i++;
    if (scene.i >= scene.lines.length) { end(); return; }
    const [who, text] = scene.lines[scene.i];
    const sp = speaker(who, scene.ctx);
    const box = $('scene');
    box.classList.toggle('narration', !sp.name);
    box.classList.toggle('me', !!sp.me);
    $('sceneName').textContent = sp.name;
    // 話し手が変わったら顔を入れ替える（ナレーションときみの時は直前の顔を薄く残す）
    const portrait = $('scenePortrait');
    if (sp.key && sp.key !== scene.key) {
      scene.key = sp.key;
      portrait.innerHTML = Story.avatar(sp.key, sp.stage);
      portrait.classList.remove('enter');
      void portrait.offsetWidth;
      portrait.classList.add('enter');
    }
    portrait.classList.toggle('dim', !sp.key);
    const el = $('sceneText');
    el.textContent = '';
    scene.full = text;
    scene.pos = 0;
    scene.typing = true;
    clearInterval(scene.timer);
    scene.timer = setInterval(() => {
      scene.pos++;
      el.textContent = text.slice(0, scene.pos);
      // 文字に合わせて「ポポポ」としゃべる（ナレーションは無音）
      const ch = text[scene.pos - 1];
      if (sp.voice && scene.pos % 2 === 1 && !SILENT_CHARS.test(ch)) fx.blip(sp.voice);
      if (scene.pos >= text.length) finishTyping();
    }, TYPE_MS);
  }

  function finishTyping() {
    clearInterval(scene.timer);
    scene.typing = false;
    $('sceneText').textContent = scene.full;
  }

  function end() {
    if (!scene) return;
    clearInterval(scene.timer);
    const done = scene.onDone;
    const prev = scene.prevMusic;
    scene = null;
    $('scene').hidden = true;
    deps.setMusic(prev); // 会話の前の曲に戻す（次の画面が自分の曲に切り替える）
    if (done) done();
  }

  function init(d) {
    deps = d;
    $('scene').addEventListener('click', (e) => {
      if (e.target.closest('#sceneSkip')) return;
      fx.vibrate('tap');
      nextLine();
    });
    $('sceneSkip').addEventListener('click', end);
  }

  window.Scene = { init, play, isActive: () => !!scene };
})();
