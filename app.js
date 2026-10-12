/* シンプルチェス: 画面制御 */
(function () {
  'use strict';

  const STORAGE_KEY = 'simple-chess-state-v1';
  const STORY_KEY = 'simple-chess-story-v1';
  const DEBUG_KEY = 'simple-chess-debug';
  const LEVEL_NAME = { 1: 'やさしい', 2: 'ふつう', 3: 'つよい' };
  const COLOR_NAME = { w: '白', b: '黒' };
  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const CPU_MIN_DELAY = 450;
  const SLIDE_MS = 170;      // 駒が滑る時間
  const FLIP_DELAY_MS = 450; // 2人対戦: 指した手を見せてから盤を回すまでの間
  const FLIP_MS = 480;       // 盤が回転する時間（style.css と合わせる）
  const DRAG_START_PX = 6;   // これ以上動いたらドラッグ扱い

  const $ = (id) => document.getElementById(id);
  const vsCPU = () => state.mode === 'cpu' || state.mode === 'story';
  let music = null;
  function setMusic(name) { music = name; fx.bgm(name); }
  const fx = window.Feedback;

  // ---- 状態 ----
  const settings = { mode: 'cpu', level: '2', color: 'w', sound: 'on', haptic: 'on', bgm: 'on' };
  let state = null; // { mode, level, human, moves: [uci], flipped, over }
  let game = new Chess();
  let sanList = [];
  let selected = -1;
  let legalFromSelected = [];
  let peeking = false; // 相手の駒をタッチして、動けるマスを見ているだけのとき
  let thinking = false;
  let aiRequestId = 0;
  let worker = null;
  let resultShown = false;
  let drag = null;
  let animating = 0;
  let flipping = false;
  let flipTimers = [];

  // ---- 保存 ----
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, state })); } catch (e) { /* 保存できなくても続行 */ }
  }
  let story = { cleared: 0, prologue: false, stars: {} };
  // ストーリーでは「待った」と「ヒント」は1局3回まで（フリー対戦は無制限）
  const STORY_LIMIT = 3;
  const totalStars = () => Object.values(story.stars || {}).reduce((a, b) => a + b, 0);
  // 使った回数（待った＋ヒント）から星の数: 0回 ★★★ / 1〜2回 ★★ / 3回以上 ★
  const starsFor = (used) => (used === 0 ? 3 : used <= 2 ? 2 : 1);
  const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

  // ---- デバッグモード（タイトルを5回タップ、または ?debug=1 で切替） ----
  let debug = false;
  function setDebug(on) {
    debug = on;
    try { if (on) localStorage.setItem(DEBUG_KEY, '1'); else localStorage.removeItem(DEBUG_KEY); } catch (e) { /* 無視 */ }
  }
  function initDebug() {
    try { debug = localStorage.getItem(DEBUG_KEY) === '1'; } catch (e) { /* 無視 */ }
    const q = new URLSearchParams(location.search).get('debug');
    if (q !== null) setDebug(q !== '0');
    let taps = 0, last = 0;
    $('titleLogo').addEventListener('click', () => {
      const now = Date.now();
      taps = now - last < 600 ? taps + 1 : 1;
      last = now;
      if (taps >= 5) {
        taps = 0;
        setDebug(!debug);
        fx.play(debug ? 'win' : 'draw');
        $('storyBannerSub').textContent = debug ? 'デバッグモード ON：全話を確認できます' : 'デバッグモード OFF';
      }
    });
  }
  function saveStory() {
    try { localStorage.setItem(STORY_KEY, JSON.stringify(story)); } catch (e) { /* 無視 */ }
  }
  function loadStory() {
    try { Object.assign(story, JSON.parse(localStorage.getItem(STORY_KEY) || '{}')); } catch (e) { /* 無視 */ }
    if (!story.stars) story.stars = {};
    // 星評価が無かった頃にクリアした話は ★1 として記録する（表示と合計をそろえる）
    for (let n = 1; n <= story.cleared; n++) if (!story.stars[n]) story.stars[n] = 1;
  }

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!data) return;
      if (data.settings) Object.assign(settings, data.settings);
      if (data.state && Array.isArray(data.state.moves)) state = data.state;
    } catch (e) { /* 無視 */ }
  }

  function applyFeedbackSettings() {
    fx.setSound(settings.sound !== 'off');
    fx.setHaptic(settings.haptic !== 'off');
    fx.setBgm(settings.bgm !== 'off');
    const btn = $('soundBtn');
    btn.classList.toggle('off', settings.sound === 'off');
    btn.setAttribute('aria-label', settings.sound === 'off' ? '効果音をオンにする' : '効果音をオフにする');
  }

  // ---- メニュー ----
  function initMenu() {
    document.querySelectorAll('.seg').forEach((seg) => {
      const name = seg.dataset.name;
      seg.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        settings[name] = btn.dataset.value;
        syncMenu();
        if (name === 'sound' || name === 'bgm' || name === 'haptic') applyFeedbackSettings();
        save();
      });
    });
    $('startBtn').addEventListener('click', () => startGame());
    $('resumeBtn').addEventListener('click', () => showGame());
    $('menuBackBtn').addEventListener('click', goBack);
    $('hapticSection').hidden = !fx.hapticSupported;
    syncMenu();
  }

  function syncMenu() {
    document.querySelectorAll('.seg').forEach((seg) => {
      seg.querySelectorAll('button').forEach((b) => {
        const on = b.dataset.value === settings[seg.dataset.name];
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on);
        b.setAttribute('role', 'radio');
      });
    });
    // 2人対戦ではCPU設定を薄く表示して無効化する（消すとレイアウトがずれるため）
    const cpuOff = settings.mode !== 'cpu';
    const cpuBox = $('cpuOptions');
    cpuBox.classList.toggle('inactive', cpuOff);
    cpuBox.querySelectorAll('[role=radiogroup]').forEach((g) => g.setAttribute('aria-disabled', cpuOff));
    cpuBox.querySelectorAll('button').forEach((b) => { b.disabled = cpuOff; });
    $('resumeBtn').hidden = !(state && state.mode !== 'story' && state.moves.length > 0 && !state.over);
  }

  function showMenu() {
    cancelAI();
    cancelFlip();
    cancelDrag();
    hideBubble();
    $('tutorial').hidden = true;
    $('lesson').hidden = true;
    $('game').hidden = true;
    $('story').hidden = true;
    $('title').hidden = true;
    $('menu').hidden = false;
    setMusic('title');
    syncMenu();
    storyBannerUpdate();
    syncHistory();
    lockScroll();
  }

  // ---- 「もどる」の統一（画面のボタンと、Android の戻る操作・ブラウザの戻る） ----
  // タイトル以外の画面にいる間は履歴を1つ積んでおき、戻る操作をアプリ内の「もどる」に置き換える
  let ignorePop = false;
  function onlyScreen(id) {
    document.querySelectorAll('main.screen').forEach((m) => { m.hidden = m.id !== id; });
    lockScroll();
  }

  // タイトル画面ではページのスクロールと iPhone の引っぱり（ラバーバンド）を止める
  function lockScroll() {
    document.documentElement.classList.toggle('lock', !$('title').hidden);
  }

  function syncHistory() {
    const atTitle = !$('title').hidden && $('settingsModal').hidden && $('installModal').hidden;
    const pushed = !!(history.state && history.state.chessApp);
    if (!atTitle && !pushed) history.pushState({ chessApp: 1 }, '');
    else if (atTitle && pushed) { ignorePop = true; history.back(); }
  }

  function goBack() {
    if (transitioning || Scene.isActive() || !$('promoModal').hidden || !$('resultModal').hidden) { syncHistory(); return; }
    if (!$('movesModal').hidden) { $('movesModal').hidden = true; syncHistory(); return; }
    if (!$('installModal').hidden) { $('installModal').hidden = true; syncHistory(); return; }
    if (!$('settingsModal').hidden) { $('settingsModal').hidden = true; syncHistory(); return; }
    if (!$('confirmModal').hidden) { $('confirmModal').hidden = true; syncHistory(); return; }
    if (!$('debugModal').hidden) { $('debugModal').hidden = true; syncHistory(); return; }
    if (!$('game').hidden) { if (state.mode === 'story') showStory(); else showMenu(); return; }
    if (!$('lesson').hidden) { Tutorial.showList(); return; }
    if (!$('story').hidden || !$('menu').hidden || !$('tutorial').hidden) { showTitle(); return; }
    syncHistory();
  }

  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop = false; return; }
    goBack();
  });

  // ---- タイトル画面 ----
  function canContinue() {
    return !!(state && state.moves.length > 0 && !state.over);
  }

  function showTitle() {
    cancelAI();
    cancelFlip();
    cancelDrag();
    hideBubble();
    $('tutorial').hidden = true;
    $('lesson').hidden = true;
    $('game').hidden = true;
    $('story').hidden = true;
    $('menu').hidden = true;
    $('title').hidden = false;
    document.documentElement.classList.add('lock');
    setMusic('title');
    updateTitle();
    syncHistory();
  }

  function updateTitle() {
    const cont = canContinue();
    $('continueBtn').hidden = !cont;
    if (cont) {
      $('continueSub').textContent = state.mode === 'story'
        ? `第${state.stage}話 vs ${stageInfo().name}（${state.moves.length}手目）`
        : `${state.mode === 'cpu' ? 'CPU対戦' : '2人対戦'}（${state.moves.length}手目）`;
    }
    storyBannerUpdate();
    const td = Tutorial.doneCount();
    $('tutorialSub').textContent = td === 0 ? 'はじめての人はここから！'
      : td >= Tutorial.count() ? 'ぜんぶクリア！ ふく習もできるよ' : `レッスン ${td}/${Tutorial.count()} クリア`;
    setCursor(document.querySelector('.title-menu .rpg-item:not([hidden])'));
  }

  // RPG風カーソル（▶）
  function setCursor(item) {
    if (transitioning) return; // 切り替え演出中はカーソルを動かさない
    document.querySelectorAll('.title-menu .rpg-item').forEach((b) => b.classList.toggle('cur', b === item));
  }

  // タイトルからの画面切り替え演出: 決定 → 選んだ位置から暗転 → 切り替え → 明転
  const CHOSEN_MS = 380, CLOSE_MS = 450, OPEN_MS = 450;
  let transitioning = false;
  function titleGo(btn, action) {
    if (transitioning) return;
    setCursor(btn);
    transitioning = true;
    fx.play('confirm');
    btn.classList.add('chosen');
    const r = btn.getBoundingClientRect();
    const curtain = $('curtain');
    curtain.style.setProperty('--x', (r.left + r.width / 2) + 'px');
    curtain.style.setProperty('--y', (r.top + r.height / 2) + 'px');
    setTimeout(() => {
      curtain.hidden = false;
      curtain.className = 'curtain closing';
    }, CHOSEN_MS);
    setTimeout(() => {
      btn.classList.remove('chosen');
      action();
      curtain.className = 'curtain opening';
    }, CHOSEN_MS + CLOSE_MS);
    setTimeout(() => {
      curtain.hidden = true;
      curtain.className = 'curtain';
      transitioning = false;
    }, CHOSEN_MS + CLOSE_MS + OPEN_MS);
  }

  function initTitle() {
    document.querySelectorAll('.title-menu .rpg-item').forEach((b) => {
      b.addEventListener('pointerenter', () => setCursor(b));
      b.addEventListener('focus', () => setCursor(b));
      b.addEventListener('pointerdown', () => setCursor(b));
    });
    $('continueBtn').addEventListener('click', (e) => titleGo(e.currentTarget, showGame));
    $('storyBtn').addEventListener('click', (e) => titleGo(e.currentTarget, enterStory));
    $('freeBtn').addEventListener('click', (e) => titleGo(e.currentTarget, showMenu));
    $('tutorialBtn').addEventListener('click', (e) => titleGo(e.currentTarget, Tutorial.showList));
    $('tutorialBack').addEventListener('click', goBack);
    $('lessonBack').addEventListener('click', goBack);
    $('settingsInstall').addEventListener('click', () => Pwa.openGuide());
    Backup.setup({ exportButton: $('backupExport'), importInput: $('backupImport'), message: $('backupMessage') });
    $('installItem').addEventListener('click', () => Pwa.openGuide());
    $('installBack').addEventListener('click', goBack);
    $('installModal').addEventListener('click', (e) => { if (e.target === $('installModal')) goBack(); });
    $('settingsBtn').addEventListener('click', () => { syncMenu(); $('settingsModal').hidden = false; syncHistory(); });
    $('settingsBack').addEventListener('click', goBack);
    $('settingsModal').addEventListener('click', (e) => { if (e.target === $('settingsModal')) goBack(); });
    updateTitle();
  }

  function startGame() {
    let human = settings.color;
    if (human === 'r') human = Math.random() < 0.5 ? 'w' : 'b';
    state = {
      mode: settings.mode,
      level: +settings.level,
      human: settings.mode === 'cpu' ? human : null,
      moves: [],
      flipped: settings.mode === 'cpu' && human === 'b',
      over: false,
      undos: 0,
      hints: 0
    };
    save();
    showGame();
  }

  function showGame() {
    $('title').hidden = true;
    $('menu').hidden = true;
    $('story').hidden = true;
    $('tutorial').hidden = true;
    $('lesson').hidden = true;
    $('game').hidden = false;
    const isStory = state.mode === 'story';
    $('gameTitle').textContent = isStory
      ? `第${state.stage}話 vs ${stageInfo().name}`
      : state.mode === 'cpu' ? `CPU（${LEVEL_NAME[state.level]}）と対戦` : '2人で対戦';
    $('menuBtn').setAttribute('aria-label', isStory ? 'ストーリーにもどる' : 'フリー対戦メニューにもどる');
    $('newBtn').textContent = isStory ? 'やり直す' : '新しい対局';
    setMusic(isStory && !state.over ? (state.stage >= 9 ? 'boss' : 'battle') : null);
    rebuild();
    resultShown = state.over; // 終局済みの対局を開き直した時は結果を再表示しない
    resizeBoard();
    render();
    afterMove(null);
    syncHistory();
    lockScroll();
  }

  // 棋譜（UCIの列）から局面を再構築
  function rebuild() {
    clearHint();
    viewPly = null;
    viewGame = null;
    game = new Chess();
    sanList = [];
    const valid = [];
    for (const u of state.moves) {
      const m = game.moveFromUci(u);
      if (!m) break;
      sanList.push(game.san(m));
      game.makeMove(m);
      valid.push(u);
    }
    state.moves = valid;
    selected = -1;
    legalFromSelected = [];
    peeking = false;
  }

  // ---- 盤面 ----
  const squares = [];
  function buildBoard() {
    const board = $('board');
    for (let v = 0; v < 64; v++) {
      const el = document.createElement('div');
      el.className = 'sq';
      el.setAttribute('role', 'gridcell');
      board.appendChild(el);
      squares.push(el);
    }
    board.addEventListener('pointerdown', onPointerDown);
    board.addEventListener('pointermove', onPointerMove);
    board.addEventListener('pointerup', onPointerUp);
    board.addEventListener('pointercancel', cancelDrag);
    board.addEventListener('lostpointercapture', () => { if (drag) cancelDrag(); });
    board.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function sqSize() { return $('board').clientWidth / 8; }

  function resizeBoard() {
    const w = $('board').clientWidth;
    if (w) document.documentElement.style.setProperty('--sq', (w / 8) + 'px');
  }

  const viewIndex = (sq) => (state.flipped ? 63 - sq : sq);

  function pieceHtml(p) {
    const color = Chess.colorOf(p);
    return `<span class="piece ${color}">${Pieces.svg(p)}</span>`;
  }

  function isHumanTurn() {
    return state.mode === 'pvp' || game.turn === state.human;
  }

  // ---- 対局の振り返り（棋譜の好きな局面を表示） ----
  let viewPly = null, viewGame = null; // null = 最新の局面
  function shownGame() { return viewPly === null ? game : viewGame; }

  function setView(ply) {
    if (ply === null || ply >= state.moves.length) { viewPly = null; viewGame = null; }
    else {
      viewPly = Math.max(0, ply);
      viewGame = new Chess();
      for (const u of state.moves.slice(0, viewPly)) viewGame.makeMove(viewGame.moveFromUci(u));
    }
    selected = -1;
    legalFromSelected = [];
    peeking = false;
    render();
  }

  function initReview() {
    $('reviewBar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-rv]');
      if (!b) return;
      const cur = viewPly === null ? state.moves.length : viewPly;
      const to = { first: 0, prev: cur - 1, next: cur + 1, last: null }[b.dataset.rv];
      if (to !== null && (to < 0 || to > state.moves.length)) { fx.play('error'); return; }
      fx.play('select');
      setView(to);
    });
    $('moveList').addEventListener('click', (e) => {
      const mv = e.target.closest('[data-ply]');
      if (!mv) return;
      fx.play('select');
      setView(+mv.dataset.ply);
      goBack(); // 窓を閉じて、選んだ局面を盤で見せる
    });
    $('moveStrip').addEventListener('click', openMoves);
    $('reviewPos').addEventListener('click', openMoves);
    $('movesBack').addEventListener('click', goBack);
    $('movesModal').addEventListener('click', (e) => { if (e.target === $('movesModal')) goBack(); });
  }

  function canInteract() {
    return viewPly === null && !flipping && !state.over && !thinking && isHumanTurn() && $('promoModal').hidden;
  }

  function render() {
    const g = shownGame();
    const last = g.stack.length ? g.stack[g.stack.length - 1].m : null;
    const checkSq = g.inCheck() ? g.kings[g.turn] : -1;
    const targets = new Map(legalFromSelected.map((m) => [m.to, m]));

    for (let v = 0; v < 64; v++) {
      const sq = state.flipped ? 63 - v : v;
      const el = squares[v];
      el._sq = sq;
      const r = sq >> 3, c = sq & 7;
      const cls = ['sq', (r + c) % 2 === 0 ? 'light' : 'dark'];
      if (last && (sq === last.from || sq === last.to)) cls.push('last');
      if (sq === selected) cls.push('sel');
      if (peeking && (sq === selected || targets.has(sq))) cls.push('peek');
      if (sq === checkSq) cls.push('check');
      if (hintMove && sq === hintMove.from) cls.push('hint-from');
      if (hintMove && sq === hintMove.to) cls.push('hint-to');
      if (targets.has(sq)) {
        cls.push('target');
        if (targets.get(sq).captured) cls.push('capture');
      }
      if (drag && drag.moved && sq === drag.from) cls.push('dragging');
      el.className = cls.join(' ');

      let html = '';
      const p = g.board[sq];
      if (p) html += pieceHtml(p);
      if (v % 8 === 0) html += `<span class="coord rank">${8 - r}</span>`;
      if (v >= 56) html += `<span class="coord file">${'abcdefgh'[c]}</span>`;
      el.innerHTML = html;
      const name = Chess.sqName(sq);
      el.setAttribute('aria-label', p ? `${name} ${COLOR_NAME[Chess.colorOf(p)]}${pieceName(p)}` : name);
    }

    renderPlayers();
    renderStatus();
    renderMoves();
    updateControls();
  }

  function updateControls() {
    const isStory = state.mode === 'story';
    const ru = remaining('undos'), rh = remaining('hints');
    $('undoBtn').innerHTML = isStory ? `待った<small>のこり${ru}</small>` : '待った';
    $('hintBtn').innerHTML = hintBusy ? 'ヒント<small>考え中…</small>' : isStory ? `ヒント<small>のこり${rh}</small>` : 'ヒント';
    $('undoBtn').disabled = state.moves.length === 0 || ru <= 0;
    $('hintBtn').disabled = hintBusy || rh <= 0 || state.over;
  }

  // ---- ヒント（強めのCPUにおすすめの一手を聞いて光らせる） ----
  let hintWorker = null, hintBusy = false, hintMove = null, hintReq = 0;
  function requestHint() {
    if (hintBusy || !canInteract() || remaining('hints') <= 0) { fx.play('error'); return; }
    if (!hintWorker) {
      hintWorker = new Worker('ai.js');
      hintWorker.onerror = () => { hintBusy = false; hintWorker = null; render(); };
    }
    hintBusy = true;
    const id = ++hintReq, ply = state.moves.length;
    hintWorker.onmessage = (e) => {
      if (e.data.id !== id) return;
      hintBusy = false;
      const m = e.data.uci && state.moves.length === ply && game.moveFromUci(e.data.uci);
      if (m) {
        state.hints = (state.hints || 0) + 1;
        save();
        hintMove = { from: m.from, to: m.to };
        fx.play('confirm');
      }
      render();
    };
    hintWorker.postMessage({ id, fen: Chess.START_FEN, moves: state.moves.slice(), level: 's8' });
    render();
  }
  function clearHint() {
    hintMove = null;
    if (hintBusy) { hintReq++; hintBusy = false; }
  }

  function pieceName(p) {
    return { k: 'キング', q: 'クイーン', r: 'ルーク', b: 'ビショップ', n: 'ナイト', p: 'ポーン' }[p.toLowerCase()];
  }

  function renderPlayers() {
    const bottomColor = state.flipped ? 'b' : 'w';
    const topColor = state.flipped ? 'w' : 'b';
    // 盤上に残っていない駒 = 取られた駒
    const counts = { w: { p: 8, n: 2, b: 2, r: 2, q: 1 }, b: { p: 8, n: 2, b: 2, r: 2, q: 1 } };
    const material = { w: 0, b: 0 };
    const g = shownGame();
    for (const p of g.board) {
      if (!p) continue;
      const t = p.toLowerCase(), c = Chess.colorOf(p);
      if (t === 'k') continue;
      material[c] += VALUE[t];
      if (counts[c][t] > 0) counts[c][t]--;
      else counts[c].p--; // 成った駒はポーンが減ったものとして数える
    }
    const setPlayer = (el, color) => {
      el.className = 'player ' + (color === 'w' ? 'white' : 'black') +
        (!state.over && g.turn === color ? ' active' : '');
      let name = COLOR_NAME[color];
      if (state.mode === 'story') name = (color === state.human ? 'きみ' : stageInfo().name) + `（${name}）`;
      else if (state.mode === 'cpu') name = (color === state.human ? 'あなた' : 'CPU') + `（${name}）`;
      el.querySelector('.name').textContent = name;
      // ストーリーでは相手の顔を表示（描き直しは相手が変わった時だけ）
      const av = el.querySelector('.avatar');
      const avKey = state.mode === 'story' && color !== state.human ? 's' + state.stage : '';
      if (av.dataset.key !== avKey) {
        av.dataset.key = avKey;
        av.innerHTML = avKey ? Story.avatar(avKey, state.stage) : '';
      }
      av.hidden = !avKey;
      el.querySelector('.dot').hidden = !!avKey;
      const enemy = color === 'w' ? 'b' : 'w';
      let caps = '';
      for (const t of ['q', 'r', 'b', 'n', 'p']) caps += pieceHtml(enemy === 'w' ? t.toUpperCase() : t).repeat(Math.max(0, counts[enemy][t]));
      const capEl = el.querySelector('.captured');
      if (capEl.dataset.html !== caps) { capEl.dataset.html = caps; capEl.innerHTML = caps; }
      const diff = material[color] - material[enemy];
      el.querySelector('.adv').textContent = diff > 0 ? `+${diff}` : '';
    };
    setPlayer($('playerTop'), topColor);
    setPlayer($('playerBottom'), bottomColor);
  }

  function resultMessage(st) {
    const reasons = {
      checkmate: 'チェックメイト',
      stalemate: 'ステイルメイト（引き分け）',
      insufficient: '駒不足のため引き分け',
      fifty: '50手ルールにより引き分け',
      repetition: '同一局面3回により引き分け'
    };
    let title;
    if (st.winner) {
      if (vsCPU()) title = st.winner === state.human ? 'あなたの勝ち！' : 'CPUの勝ち';
      else title = `${COLOR_NAME[st.winner]}の勝ち！`;
    } else title = '引き分け';
    return { title, text: reasons[st.reason] };
  }

  function renderStatus() {
    const el = $('status');
    el.className = 'status';
    const showBar = state.moves.length > 0 && (state.over || viewPly !== null);
    $('reviewBar').hidden = !showBar;
    $('moveStrip').hidden = showBar; // 振り返り中は、同じ場所に操作バーを出す
    if (showBar) $('reviewPos').textContent = `${viewPly === null ? state.moves.length : viewPly} / ${state.moves.length} 手目`;
    if (viewPly !== null) {
      el.textContent = state.over ? '振り返り中（» で最後の局面へ）' : '振り返り中（盤をタップで最新へ）';
      el.classList.add('review');
      return;
    }
    const st = game.status();
    if (st.over) {
      const r = resultMessage(st);
      el.textContent = `${r.title}（${r.text}）`;
      return;
    }
    let text;
    if (thinking) {
      text = state.mode === 'story' ? `${stageInfo().name}が考え中` : 'CPUが考え中';
      el.classList.add('thinking');
    } else if (vsCPU()) {
      text = state.mode === 'story' ? 'きみの番だ！' : 'あなたの番です';
    } else {
      text = `${COLOR_NAME[game.turn]}の番です`;
    }
    if (game.inCheck()) {
      text = 'チェック！ ' + text;
      el.classList.add('alert');
    }
    el.textContent = text;
  }

  function renderMoves() {
    const el = $('moveList');
    const cur = (viewPly === null ? sanList.length : viewPly) - 1; // 表示中の局面に至った手
    const mv = (i) => `<span class="mv${i === cur ? ' cur' : ''}" data-ply="${i + 1}">${sanList[i]}</span>`;
    let html = '';
    for (let i = 0; i < sanList.length; i += 2) {
      html += `<span class="no">${i / 2 + 1}.</span>`;
      html += mv(i);
      html += sanList[i + 1] !== undefined ? mv(i + 1) : '<span></span>';
    }
    el.innerHTML = html;
    if (!$('movesModal').hidden) scrollMovesToCur();
    // 盤の下の帯には直近の4手だけを表示する
    const n = sanList.length, start = Math.max(0, n - 4);
    const parts = [];
    for (let i = start; i < n; i++) {
      let t = sanList[i];
      if (i % 2 === 0) t = `${i / 2 + 1}. ${t}`;
      else if (i === start) t = `${(i + 1) / 2}… ${t}`;
      parts.push(i === n - 1 ? `<b>${t}</b>` : t);
    }
    $('moveStripText').innerHTML = n === 0 ? '棋譜はここに表示されます' : (start > 0 ? '… ' : '') + parts.join(' ');
  }

  function scrollMovesToCur() {
    const el = $('moveList'), c = el.querySelector('.cur');
    if (c) c.scrollIntoView({ block: 'center' }); else el.scrollTop = el.scrollHeight;
  }

  function openMoves() {
    $('movesModal').hidden = false;
    scrollMovesToCur();
    syncHistory();
  }

  // ---- 盤の操作（タップ・ドラッグ） ----
  function squareAt(x, y) {
    const rect = $('board').getBoundingClientRect();
    const c = Math.floor((x - rect.left) / (rect.width / 8));
    const r = Math.floor((y - rect.top) / (rect.height / 8));
    if (c < 0 || c > 7 || r < 0 || r > 7) return -1;
    return viewIndex(r * 8 + c);
  }

  function selectSquare(sq) {
    selected = sq;
    legalFromSelected = game.movesFrom(sq);
    peeking = false;
    fx.play('select');
    render();
  }

  function clearSelection() {
    selected = -1;
    legalFromSelected = [];
    peeking = false;
    render();
  }

  // 相手の駒か（CPU戦なら CPU の駒、2人対戦なら手番でない側の駒）
  function isEnemyPiece(p) {
    return !!p && Chess.colorOf(p) !== (vsCPU() ? state.human : game.turn);
  }

  // 自分の手番に、相手の駒が動けるマスを見せる（どこかをタッチすると消える）
  function peekSquare(sq) {
    // 相手の手番だったら、として合法手を調べる
    const g = new Chess(game.fen());
    g.turn = Chess.colorOf(game.board[sq]); g.ep = -1; g.computeHash();
    const list = g.movesFrom(sq).filter((m) => !m.captured || m.captured.toLowerCase() !== 'k');
    selected = sq;
    legalFromSelected = list;
    peeking = true;
    fx.play('select');
    render();
  }

  // 選択中の駒を sq へ動かす。動かせたら true
  function moveSelectedTo(sq, animate) {
    if (peeking) return false;
    const candidates = legalFromSelected.filter((m) => m.to === sq);
    if (!candidates.length) return false;
    if (candidates.length > 1) choosePromotion(candidates, animate);
    else playMove(candidates[0], animate);
    return true;
  }

  function onPointerDown(e) {
    if (e.button > 0 || drag) return;
    const el = e.target.closest('.sq');
    if (!el || animating) return;
    if (viewPly !== null && !state.over) { fx.play('select'); setView(null); return; }
    const sq = el._sq;
    const p = game.board[sq];
    if (!canInteract()) {
      if (!state.over && thinking) fx.play('error');
      return;
    }
    e.preventDefault();

    // 相手の駒の動けるマスを表示中なら、どこをタッチしても消すだけ
    if (peeking) { clearSelection(); return; }

    // 指を置いた瞬間に移動させる（タップ→タップ操作）
    if (selected >= 0 && sq !== selected && moveSelectedTo(sq, true)) return;

    if (p && Chess.colorOf(p) === game.turn) {
      const wasSelected = sq === selected;
      if (!wasSelected) selectSquare(sq);
      drag = { from: sq, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, wasSelected, ghost: null, over: -1 };
      try { $('board').setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ }
    } else if (isEnemyPiece(p)) {
      peekSquare(sq);
    } else if (selected >= 0) {
      fx.play('error');
      clearSelection();
    }
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_START_PX) return;
      drag.moved = true;
      const ghost = document.createElement('div');
      ghost.className = 'ghost';
      ghost.innerHTML = pieceHtml(game.board[drag.from]);
      ghost.style.width = ghost.style.height = sqSize() + 'px';
      document.body.appendChild(ghost);
      drag.ghost = ghost;
      squares[viewIndex(drag.from)].classList.add('dragging');
    }
    const s = sqSize();
    // 指で駒が隠れないよう、少し上に浮かせる
    const lift = e.pointerType === 'touch' ? s * 0.45 : 0;
    drag.ghost.style.transform = `translate(${e.clientX - s / 2}px, ${e.clientY - s / 2 - lift}px) scale(1.18)`;

    const over = squareAt(e.clientX, e.clientY - lift);
    if (over !== drag.over) {
      if (drag.over >= 0) squares[viewIndex(drag.over)].classList.remove('hover');
      drag.over = over;
      if (over >= 0 && over !== drag.from) {
        squares[viewIndex(over)].classList.add('hover');
        if (legalFromSelected.some((m) => m.to === over)) fx.vibrate('tap');
      }
    }
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    if (d.moved) {
      const target = d.over;
      cleanupDrag();
      if (target >= 0 && target !== d.from && moveSelectedTo(target, false)) return;
      if (target >= 0 && target !== d.from) fx.play('error');
      render(); // 元の位置に戻す
    } else {
      cleanupDrag();
      // 選択済みの駒をもう一度タップしたら選択解除
      if (d.wasSelected) clearSelection();
    }
  }

  function cleanupDrag() {
    if (!drag) return;
    if (drag.ghost) drag.ghost.remove();
    if (drag.over >= 0) squares[viewIndex(drag.over)].classList.remove('hover');
    squares[viewIndex(drag.from)].classList.remove('dragging');
    try { $('board').releasePointerCapture(drag.id); } catch (err) { /* 無視 */ }
    drag = null;
  }

  function cancelDrag() {
    if (!drag) return;
    cleanupDrag();
    render();
  }

  function choosePromotion(candidates, animate) {
    const box = $('promoChoices');
    box.innerHTML = '';
    for (const t of ['q', 'r', 'b', 'n']) {
      const m = candidates.find((x) => x.promo.toLowerCase() === t);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = pieceHtml(m.promo);
      btn.setAttribute('aria-label', pieceName(t));
      btn.addEventListener('click', () => { $('promoModal').hidden = true; playMove(m, animate); });
      box.appendChild(btn);
    }
    $('promoModal').hidden = false;
  }

  // 指し手に応じた効果音
  function moveSound(m) {
    if (m.promo) return 'promote';
    if (m.flag === 'k' || m.flag === 'q') return 'castle';
    if (m.captured) return 'capture';
    return 'move';
  }

  // 駒を移動元から滑らせる
  function slide(m) {
    const s = sqSize();
    const pairs = [[m.from, m.to]];
    if (m.flag === 'k') pairs.push([m.to + 1, m.to - 1]);
    if (m.flag === 'q') pairs.push([m.to - 2, m.to + 1]);
    for (const [from, to] of pairs) {
      const vf = viewIndex(from), vt = viewIndex(to);
      const piece = squares[vt].querySelector('.piece');
      if (!piece) continue;
      const dx = ((vf & 7) - (vt & 7)) * s, dy = ((vf >> 3) - (vt >> 3)) * s;
      piece.style.transition = 'none';
      piece.style.transform = `translate(${dx}px, ${dy}px)`;
      piece.classList.add('moving');
      piece.getBoundingClientRect(); // リフローを強制
      piece.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(.2,.8,.3,1)`;
      piece.style.transform = '';
    }
  }

  function playMove(m, animate) {
    clearHint();
    sanList.push(game.san(m));
    game.makeMove(m);
    state.moves.push(Chess.uci(m));
    selected = -1;
    legalFromSelected = [];
    peeking = false;
    const st = game.status();
    const byCPU = vsCPU() && Chess.colorOf(m.piece) !== state.human;
    const after = () => {
      fx.play(moveSound(m));
      if (game.inCheck() && !st.over) {
        fx.play('check');
        if (byCPU && state.mode === 'story') say(stageInfo().check);
      }
    };
    if (animate) {
      render();
      slide(m);
      animating++;
      setTimeout(() => { animating--; after(); afterMove(st); }, SLIDE_MS - 20);
    } else {
      after();
      afterMove(st);
    }
  }

  function afterMove(status) {
    const st = status || game.status();
    state.over = st.over;
    save();
    render();
    if (st.over) {
      if (!resultShown && state.mode === 'story') {
        resultShown = true;
        storyResult(st);
      } else if (!resultShown) {
        resultShown = true;
        $('resultAv').hidden = true;
        $('resultStars').hidden = true;
        $('resultClose').hidden = false;
        $('resultClose').textContent = '盤面を見る';
        $('resultNew').textContent = 'もう一局';
        $('resultClose').onclick = () => { $('resultModal').hidden = true; };
        $('resultNew').onclick = () => { $('resultModal').hidden = true; showMenu(); };
        const r = resultMessage(st);
        $('resultTitle').textContent = r.title;
        $('resultText').textContent = r.text;
        setTimeout(() => {
          $('resultModal').hidden = false;
          let s = 'draw';
          if (st.winner) s = vsCPU() && st.winner !== state.human ? 'lose' : 'win';
          fx.play(s);
        }, 450);
      }
      return;
    }
    if (vsCPU() && game.turn !== state.human) requestAI();
    if (state.mode === 'pvp') autoFlip();
  }

  // ---- 2人対戦: 手番側が手前に来るよう盤を回す ----
  function autoFlip() {
    cancelFlip();
    const want = game.turn === 'b';
    if (state.flipped === want) return;
    flipping = true;
    render();
    const board = $('board');
    flipTimers.push(setTimeout(() => {
      board.classList.add('flipping'); // 盤を180°回転（駒は逆回転して正立のまま）
      flipTimers.push(setTimeout(() => {
        board.classList.remove('flipping');
        state.flipped = want;
        flipping = false;
        flipTimers = [];
        save();
        render();
      }, FLIP_MS));
    }, FLIP_DELAY_MS));
  }

  function cancelFlip() {
    flipTimers.forEach(clearTimeout);
    flipTimers = [];
    $('board').classList.remove('flipping');
    flipping = false;
  }

  // ---- ストーリーモード ----
  const stageInfo = (n) => Story.STAGES[(n || state.stage) - 1];

  function storyBannerUpdate() {
    const next = Math.min(story.cleared + 1, 10);
    const all = story.cleared >= 10;
    $('storyBannerAv').innerHTML = all ? Story.avatar('noirKind', 0) : Story.avatar('s' + next, next);
    $('storyBannerSub').textContent = all ? (totalStars() === 30 ? '全話 ★3 達成！ おめでとう！' : `全10話クリア！ ★3 をめざそう（★ ${totalStars()}/30）`)
      : story.cleared === 0 ? '影の塔の10人の守り手に挑め！'
        : `第${next}話「${stageInfo(next).name}」に挑戦中（★ ${totalStars()}/30）`;
  }

  function showStory() {
    cancelAI();
    cancelFlip();
    cancelDrag();
    hideBubble();
    $('title').hidden = true;
    $('menu').hidden = true;
    $('tutorial').hidden = true;
    $('lesson').hidden = true;
    $('game').hidden = true;
    $('story').hidden = false;
    setMusic('map');
    $('storyCount').textContent = `★ ${totalStars()}/30`;
    $('endingBtn').hidden = !debug && story.cleared < 10;
    $('resetStoryBtn').hidden = !debug;
    $('debugBadge').hidden = !debug;
    const list = $('storyList');
    list.innerHTML = '';
    Story.STAGES.forEach((S, i) => {
      const n = i + 1;
      const locked = !debug && n > story.cleared + 1;
      const cleared = n <= story.cleared;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'stage-card' + (locked ? ' locked' : '') + (cleared ? ' cleared' : '') +
        (n === story.cleared + 1 ? ' next' : '');
      card.disabled = locked;
      card.innerHTML = `<span class="stage-av">${Story.avatar('s' + n, n)}</span>
        <span class="stage-info"><span class="stage-no">第${n}話・${S.where}</span>
        <strong>${locked ? '？？？' : S.name}</strong><small>${locked ? '前の話をクリアすると挑戦できる' : S.title}</small></span>
        <span class="stage-side"><span class="stage-badge">${cleared ? 'クリア' : locked ? '&#128274;&#xFE0E;' : '挑戦！'}</span>
        ${cleared ? `<span class="stage-stars">${starText(story.stars[n] || 1)}</span>` : ''}</span>`;
      card.addEventListener('click', () => (debug ? openDebug(n) : openStage(n)));
      list.appendChild(card);
    });
    const next = list.querySelector('.next');
    if (next) setTimeout(() => next.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
    syncHistory();
    lockScroll();
  }

  // タイトルから「ストーリーモード」: 初めての時はプロローグ → 第1話へそのまま進む
  function enterStory() {
    if (!story.prologue && story.cleared === 0) {
      Scene.play(Story.PROLOGUE, { stage: 0, chapter: 'プロローグ' }, () => {
        story.prologue = true;
        saveStory();
        openStage(1);
      });
    } else showStory();
  }

  function openStage(n) {
    const S = stageInfo(n);
    const go = () => Scene.play(S.intro, { stage: n, chapter: `第${n}話　${S.title} ${S.name}` }, () => startStoryGame(n));
    if (n === 1 && !story.prologue) {
      Scene.play(Story.PROLOGUE, { stage: 0, chapter: 'プロローグ' }, () => { story.prologue = true; saveStory(); go(); });
    } else go();
  }

  function openDebug(n) {
    const S = stageInfo(n);
    const chapter = `第${n}話　${S.title} ${S.name}`;
    $('debugAv').innerHTML = Story.avatar('s' + n, n);
    $('debugTitle').textContent = chapter;
    $('debugLose').textContent = S.lose;
    $('debugCheck').textContent = S.check;
    const modal = $('debugModal');
    modal.hidden = false;
    modal.onclick = (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      modal.hidden = true;
      const a = act.dataset.act;
      if (a === 'intro') Scene.play(S.intro, { stage: n, chapter }, () => openDebug(n));
      if (a === 'outro') Scene.play(S.outro, { stage: n, chapter }, () => openDebug(n));
      if (a === 'play') startStoryGame(n);
      if (a === 'clear') {
        story.cleared = Math.max(story.cleared, n);
        saveStory();
        showStory();
      }
    };
  }

  function startStoryGame(n) {
    cancelAI();
    cancelFlip();
    hideBubble();
    $('resultModal').hidden = true;
    state = { mode: 'story', stage: n, level: 's' + n, human: 'w', moves: [], flipped: false, over: false, undos: 0, hints: 0 };
    save();
    showGame();
  }

  function storyResult(st) {
    setMusic(null);
    const S = stageInfo();
    const win = st.winner === state.human;
    const n = state.stage;
    const used = (state.undos || 0) + (state.hints || 0);
    const stars = win ? starsFor(used) : 0;
    if (win) {
      if (n > story.cleared) story.cleared = n;
      story.stars[n] = Math.max(story.stars[n] || 0, stars);
      saveStory();
    }
    $('resultStars').hidden = !win;
    if (win) {
      $('resultStars').innerHTML = `<span class="star-row">${'<b>★</b>'.repeat(stars)}${'<i>★</i>'.repeat(3 - stars)}</span>` +
        `<small>${used === 0 ? '待った・ヒントなしで勝利！' : `待った・ヒント ${used}回`}</small>`;
    }
    $('resultAv').hidden = false;
    $('resultAv').innerHTML = Story.avatar('s' + n, n);
    $('resultTitle').textContent = win ? '勝利！' : st.winner ? '負けてしまった…' : '引き分け…';
    $('resultText').textContent = win ? `${S.name}に勝った！（${resultMessage(st).text}）`
      : `${S.name}「${S.lose}」`;
    $('resultClose').hidden = false;
    if (win) {
      $('resultClose').hidden = true;
      $('resultNew').textContent = 'つづきを見る';
      $('resultNew').onclick = () => {
        $('resultModal').hidden = true;
        Scene.play(S.outro, { stage: n, chapter: `第${n}話　${S.title} ${S.name}` }, () => {
          if (n === 10) Scene.play(Story.ENDING, { stage: 0, chapter: 'エンディング' }, showStory);
          else showStory();
        });
      };
    } else {
      $('resultClose').textContent = 'ストーリーへ';
      $('resultClose').onclick = () => { $('resultModal').hidden = true; showStory(); };
      $('resultNew').textContent = 'もう一度挑戦';
      $('resultNew').onclick = () => startStoryGame(n);
    }
    setTimeout(() => {
      $('resultModal').hidden = false;
      fx.play(win ? 'win' : st.winner ? 'lose' : 'draw');
    }, 450);
  }

  // 相手の吹き出し
  let bubbleTimer = 0;
  function say(text) {
    const b = $('bubble');
    b.textContent = text;
    b.hidden = false;
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(hideBubble, 2600);
  }
  function hideBubble() {
    clearTimeout(bubbleTimer);
    $('bubble').hidden = true;
  }

  function initStory() {
    $('storyBackBtn').addEventListener('click', goBack);
    $('prologueBtn').addEventListener('click', () =>
      Scene.play(Story.PROLOGUE, { stage: 0, chapter: 'プロローグ' }, () => { story.prologue = true; saveStory(); }));
    $('endingBtn').addEventListener('click', () =>
      Scene.play(Story.ENDING, { stage: 0, chapter: 'エンディング' }, null));
    Scene.init({ stageInfo, setMusic, getMusic: () => music });
    $('resetStoryBtn').addEventListener('click', () => confirmBox('ストーリーの進行をリセットしますか？', () => {
      story = { cleared: 0, prologue: false, stars: {} };
      saveStory();
      showStory();
    }));
    storyBannerUpdate();
  }

  // ---- CPU ----
  function getWorker() {
    if (!worker) {
      worker = new Worker('ai.js');
      worker.onmessage = onAIMessage;
      worker.onerror = () => { thinking = false; worker = null; render(); };
    }
    return worker;
  }

  let aiStarted = 0;
  function requestAI() {
    thinking = true;
    aiStarted = Date.now();
    const id = ++aiRequestId;
    render();
    getWorker().postMessage({ id, fen: Chess.START_FEN, moves: state.moves.slice(), level: state.level });
  }

  function onAIMessage(e) {
    const { id, uci } = e.data;
    if (id !== aiRequestId) return;
    const wait = Math.max(0, CPU_MIN_DELAY - (Date.now() - aiStarted));
    setTimeout(() => {
      if (id !== aiRequestId) return;
      thinking = false;
      const m = uci && game.moveFromUci(uci);
      if (m) playMove(m, true);
      else render();
    }, wait);
  }

  function cancelAI() {
    aiRequestId++;
    if (thinking && worker) { worker.terminate(); worker = null; }
    thinking = false;
  }

  function remaining(kind) {
    return state.mode === 'story' ? Math.max(0, STORY_LIMIT - (state[kind] || 0)) : Infinity;
  }

  function undo() {
    if (!state.moves.length || animating) return;
    if (remaining('undos') <= 0) { fx.play('error'); return; }
    state.undos = (state.undos || 0) + 1;
    clearHint();
    cancelAI();
    cancelFlip();
    cancelDrag();
    state.moves.pop();
    if (vsCPU()) {
      rebuild();
      while (state.moves.length && game.turn !== state.human) {
        state.moves.pop();
        rebuild();
      }
    }
    rebuild();
    state.over = false;
    resultShown = false;
    $('resultModal').hidden = true;
    afterMove(null);
  }

  // ---- 確認ダイアログ ----
  function confirmBox(text, onYes) {
    $('confirmText').textContent = text;
    $('confirmModal').hidden = false;
    $('confirmYes').onclick = () => { $('confirmModal').hidden = true; onYes(); };
    $('confirmNo').onclick = () => { $('confirmModal').hidden = true; };
  }

  function initGameControls() {
    $('menuBtn').addEventListener('click', goBack);
    $('undoBtn').addEventListener('click', undo);
    $('hintBtn').addEventListener('click', requestHint);
    $('flipBtn').addEventListener('click', () => {
      if (flipping) return;
      state.flipped = !state.flipped;
      save();
      render();
    });
    $('newBtn').addEventListener('click', () => {
      if (state.mode === 'story') {
        const restart = () => startStoryGame(state.stage);
        if (state.over || state.moves.length === 0) restart();
        else confirmBox('最初からやり直しますか？', restart);
        return;
      }
      if (state.over || state.moves.length === 0) { showMenu(); return; }
      confirmBox('対局を終了してメニューに戻りますか？', () => { state.over = true; save(); showMenu(); });
    });
    $('soundBtn').addEventListener('click', () => {
      settings.sound = settings.sound === 'off' ? 'on' : 'off';
      applyFeedbackSettings();
      syncMenu();
      save();
      if (settings.sound === 'on') fx.sound('tap');
    });
    $('promoCancel').addEventListener('click', () => {
      $('promoModal').hidden = true;
      clearSelection();
    });

    if (window.ResizeObserver) new ResizeObserver(resizeBoard).observe($('board'));
    else window.addEventListener('resize', resizeBoard);
  }

  // ボタンは指が触れた瞬間に音と振動で応える
  function initButtonFeedback() {
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn.disabled || btn.id === 'soundBtn' || btn.classList.contains('rpg-item')) return;
      fx.play('tap');
    }, { passive: true });
  }

  load();
  loadStory();
  buildBoard();
  initMenu();
  initGameControls();
  initStory();
  Tutorial.init({ onlyScreen, setMusic, syncHistory });
  initTitle();
  initReview();
  initDebug();
  initButtonFeedback();
  applyFeedbackSettings();
  setMusic('title');
  lockScroll();
  // バージョン表記（更新が反映されたかすぐ分かるように）
  $('appVersion').textContent = 'Ver ' + self.APP_VERSION;
  $('settingsVersion').textContent = 'バージョン ' + self.APP_VERSION;
  // 中身が組み上がってから表示する（起動時のガクつき防止）
  requestAnimationFrame(() => document.documentElement.classList.remove('booting'));
  // ピンチ拡大は許可する（アクセシビリティ）。ダブルタップでの誤拡大だけ、CSS の touch-action と dblclick で止める
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  Pwa.init({ afterOpen: syncHistory });
  // ここまで来たら起動成功（boot.js が見ている）
  window.__appStarted = true;
})();
