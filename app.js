/* シンプルチェス: 画面制御 */
(function () {
  'use strict';

  const STORAGE_KEY = 'simple-chess-state-v1';
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const VS = '︎'; // 絵文字ではなく文字として表示させる
  const LEVEL_NAME = { 1: 'やさしい', 2: 'ふつう', 3: 'つよい' };
  const COLOR_NAME = { w: '白', b: '黒' };
  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const CPU_MIN_DELAY = 450;

  const $ = (id) => document.getElementById(id);

  // ---- 状態 ----
  const settings = { mode: 'cpu', level: '2', color: 'w' };
  let state = null; // { mode, level, human, moves: [uci], flipped, over }
  let game = new Chess();
  let sanList = [];
  let selected = -1;
  let legalFromSelected = [];
  let thinking = false;
  let aiRequestId = 0;
  let worker = null;
  let resultShown = false;

  // ---- 保存 ----
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, state })); } catch (e) { /* 保存できなくても続行 */ }
  }
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!data) return;
      if (data.settings) Object.assign(settings, data.settings);
      if (data.state && Array.isArray(data.state.moves)) state = data.state;
    } catch (e) { /* 無視 */ }
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
        save();
      });
    });
    $('startBtn').addEventListener('click', () => startGame());
    $('resumeBtn').addEventListener('click', () => showGame());
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
    $('cpuOptions').hidden = settings.mode !== 'cpu';
    $('resumeBtn').hidden = !(state && state.moves.length > 0 && !state.over);
  }

  function showMenu() {
    cancelAI();
    $('game').hidden = true;
    $('menu').hidden = false;
    syncMenu();
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
      over: false
    };
    save();
    showGame();
  }

  function showGame() {
    $('menu').hidden = true;
    $('game').hidden = false;
    $('gameTitle').textContent = state.mode === 'cpu'
      ? `CPU（${LEVEL_NAME[state.level]}）と対戦`
      : '2人で対戦';
    rebuild();
    resultShown = state.over; // 終局済みの対局を開き直した時は結果を再表示しない
    resizeBoard();
    render();
    afterMove();
  }

  // 棋譜（UCIの列）から局面を再構築
  function rebuild() {
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
  }

  // ---- 盤面 ----
  const squares = [];
  function buildBoard() {
    const board = $('board');
    for (let v = 0; v < 64; v++) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'sq';
      el.setAttribute('role', 'gridcell');
      el.addEventListener('click', () => onSquare(el._sq));
      board.appendChild(el);
      squares.push(el);
    }
  }

  function resizeBoard() {
    const w = $('board').clientWidth;
    if (w) document.documentElement.style.setProperty('--sq', (w / 8) + 'px');
  }

  function pieceHtml(p) {
    const color = Chess.colorOf(p);
    return `<span class="piece ${color}">${GLYPH[p.toLowerCase()]}${VS}</span>`;
  }

  function isHumanTurn() {
    return state.mode === 'pvp' || game.turn === state.human;
  }

  function render() {
    const flipped = state.flipped;
    const last = game.stack.length ? game.stack[game.stack.length - 1].m : null;
    const checkSq = game.inCheck() ? game.kings[game.turn] : -1;
    const targets = new Map(legalFromSelected.map((m) => [m.to, m]));

    for (let v = 0; v < 64; v++) {
      const sq = flipped ? 63 - v : v;
      const el = squares[v];
      el._sq = sq;
      const r = sq >> 3, c = sq & 7;
      const cls = ['sq', (r + c) % 2 === 0 ? 'light' : 'dark'];
      if (last && (sq === last.from || sq === last.to)) cls.push('last');
      if (sq === selected) cls.push('sel');
      if (sq === checkSq) cls.push('check');
      if (targets.has(sq)) {
        cls.push('target');
        if (targets.get(sq).captured) cls.push('capture');
      }
      el.className = cls.join(' ');

      let html = '';
      const p = game.board[sq];
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
    $('undoBtn').disabled = state.moves.length === 0;
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
    for (const p of game.board) {
      if (!p) continue;
      const t = p.toLowerCase(), c = Chess.colorOf(p);
      if (t === 'k') continue;
      material[c] += VALUE[t];
      if (counts[c][t] > 0) counts[c][t]--;
      else counts[c].p--; // 成った駒はポーンが減ったものとして数える
    }
    const setPlayer = (el, color) => {
      el.className = 'player ' + (color === 'w' ? 'white' : 'black') +
        (!state.over && game.turn === color ? ' active' : '');
      let name = COLOR_NAME[color];
      if (state.mode === 'cpu') name = (color === state.human ? 'あなた' : 'CPU') + `（${name}）`;
      el.querySelector('.name').textContent = name;
      const enemy = color === 'w' ? 'b' : 'w';
      let caps = '';
      for (const t of ['q', 'r', 'b', 'n', 'p']) caps += (GLYPH[t] + VS).repeat(Math.max(0, counts[enemy][t]));
      el.querySelector('.captured').textContent = caps;
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
      if (state.mode === 'cpu') title = st.winner === state.human ? 'あなたの勝ち！' : 'CPUの勝ち';
      else title = `${COLOR_NAME[st.winner]}の勝ち！`;
    } else title = '引き分け';
    return { title, text: reasons[st.reason] };
  }

  function renderStatus() {
    const el = $('status');
    el.className = 'status';
    const st = game.status();
    if (st.over) {
      const r = resultMessage(st);
      el.textContent = `${r.title}（${r.text}）`;
      return;
    }
    let text;
    if (thinking) {
      text = 'CPUが考え中';
      el.classList.add('thinking');
    } else if (state.mode === 'cpu') {
      text = 'あなたの番です';
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
    let html = '';
    for (let i = 0; i < sanList.length; i += 2) {
      html += `<span class="no">${i / 2 + 1}.</span>`;
      html += `<span class="mv${i === sanList.length - 1 ? ' cur' : ''}">${sanList[i]}</span>`;
      html += sanList[i + 1] !== undefined
        ? `<span class="mv${i + 1 === sanList.length - 1 ? ' cur' : ''}">${sanList[i + 1]}</span>`
        : '<span></span>';
    }
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  }

  // ---- 操作 ----
  function onSquare(sq) {
    if (state.over || thinking || !isHumanTurn()) return;
    const p = game.board[sq];

    if (selected >= 0) {
      const candidates = legalFromSelected.filter((m) => m.to === sq);
      if (candidates.length === 1) { playMove(candidates[0]); return; }
      if (candidates.length > 1) { choosePromotion(candidates); return; }
    }
    if (p && Chess.colorOf(p) === game.turn && sq !== selected) {
      selected = sq;
      legalFromSelected = game.movesFrom(sq);
    } else {
      selected = -1;
      legalFromSelected = [];
    }
    render();
  }

  function choosePromotion(candidates) {
    const box = $('promoChoices');
    box.innerHTML = '';
    for (const t of ['q', 'r', 'b', 'n']) {
      const m = candidates.find((x) => x.promo.toLowerCase() === t);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = pieceHtml(m.promo);
      btn.setAttribute('aria-label', pieceName(t));
      btn.addEventListener('click', () => { $('promoModal').hidden = true; playMove(m); });
      box.appendChild(btn);
    }
    $('promoModal').hidden = false;
  }

  function playMove(m) {
    sanList.push(game.san(m));
    game.makeMove(m);
    state.moves.push(Chess.uci(m));
    selected = -1;
    legalFromSelected = [];
    afterMove();
  }

  function afterMove() {
    const st = game.status();
    state.over = st.over;
    save();
    render();
    if (st.over) {
      if (!resultShown) {
        resultShown = true;
        const r = resultMessage(st);
        $('resultTitle').textContent = r.title;
        $('resultText').textContent = r.text;
        setTimeout(() => { $('resultModal').hidden = false; }, 350);
      }
      return;
    }
    if (state.mode === 'cpu' && game.turn !== state.human) requestAI();
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
      if (m) playMove(m);
      else render();
    }, wait);
  }

  function cancelAI() {
    aiRequestId++;
    if (thinking && worker) { worker.terminate(); worker = null; }
    thinking = false;
  }

  function undo() {
    if (!state.moves.length) return;
    cancelAI();
    state.moves.pop();
    if (state.mode === 'cpu') {
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
    afterMove();
  }

  // ---- 確認ダイアログ ----
  function confirmBox(text, onYes) {
    $('confirmText').textContent = text;
    $('confirmModal').hidden = false;
    $('confirmYes').onclick = () => { $('confirmModal').hidden = true; onYes(); };
    $('confirmNo').onclick = () => { $('confirmModal').hidden = true; };
  }

  function initGameControls() {
    $('menuBtn').addEventListener('click', showMenu);
    $('undoBtn').addEventListener('click', undo);
    $('flipBtn').addEventListener('click', () => {
      state.flipped = !state.flipped;
      save();
      render();
    });
    $('newBtn').addEventListener('click', () => {
      if (state.over || state.moves.length === 0) { showMenu(); return; }
      confirmBox('対局を終了してメニューに戻りますか？', () => { state.over = true; save(); showMenu(); });
    });
    $('promoCancel').addEventListener('click', () => {
      $('promoModal').hidden = true;
      selected = -1; legalFromSelected = [];
      render();
    });
    $('resultClose').addEventListener('click', () => { $('resultModal').hidden = true; });
    $('resultNew').addEventListener('click', () => { $('resultModal').hidden = true; showMenu(); });

    if (window.ResizeObserver) new ResizeObserver(resizeBoard).observe($('board'));
    else window.addEventListener('resize', resizeBoard);
  }

  // ---- PWA ----
  function initPWA() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => { /* オフライン非対応でも動作 */ });
    }
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const hint = $('installHint');
    let deferred = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      hint.hidden = false;
      hint.innerHTML = '<button type="button" class="btn small" id="installBtn">ホーム画面に追加</button>';
      $('installBtn').addEventListener('click', async () => {
        deferred.prompt();
        await deferred.userChoice;
        deferred = null;
        hint.hidden = true;
      });
    });
    if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
      hint.hidden = false;
      hint.textContent = '共有ボタン →「ホーム画面に追加」でアプリとして使えます';
    }
  }

  load();
  buildBoard();
  initMenu();
  initGameControls();
  initPWA();
})();
