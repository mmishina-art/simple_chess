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
  const SLIDE_MS = 170;      // 駒が滑る時間
  const FLIP_DELAY_MS = 450; // 2人対戦: 指した手を見せてから盤を回すまでの間
  const FLIP_MS = 480;       // 盤が回転する時間（style.css と合わせる）
  const DRAG_START_PX = 6;   // これ以上動いたらドラッグ扱い

  const $ = (id) => document.getElementById(id);
  const fx = window.Feedback;

  // ---- 状態 ----
  const settings = { mode: 'cpu', level: '2', color: 'w', sound: 'on', haptic: 'on' };
  let state = null; // { mode, level, human, moves: [uci], flipped, over }
  let game = new Chess();
  let sanList = [];
  let selected = -1;
  let legalFromSelected = [];
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
        applyFeedbackSettings();
        save();
      });
    });
    $('startBtn').addEventListener('click', () => startGame());
    $('resumeBtn').addEventListener('click', () => showGame());
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
    $('resumeBtn').hidden = !(state && state.moves.length > 0 && !state.over);
  }

  function showMenu() {
    cancelAI();
    cancelFlip();
    cancelDrag();
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
    afterMove(null);
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
    return `<span class="piece ${color}">${GLYPH[p.toLowerCase()]}${VS}</span>`;
  }

  function isHumanTurn() {
    return state.mode === 'pvp' || game.turn === state.human;
  }

  function canInteract() {
    return !flipping && !state.over && !thinking && isHumanTurn() && $('promoModal').hidden;
  }

  function render() {
    const last = game.stack.length ? game.stack[game.stack.length - 1].m : null;
    const checkSq = game.inCheck() ? game.kings[game.turn] : -1;
    const targets = new Map(legalFromSelected.map((m) => [m.to, m]));

    for (let v = 0; v < 64; v++) {
      const sq = state.flipped ? 63 - v : v;
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
      if (drag && drag.moved && sq === drag.from) cls.push('dragging');
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
    fx.play('select');
    render();
  }

  function clearSelection() {
    selected = -1;
    legalFromSelected = [];
    render();
  }

  // 選択中の駒を sq へ動かす。動かせたら true
  function moveSelectedTo(sq, animate) {
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
    if (!canInteract()) {
      if (!state.over && thinking) fx.play('error');
      return;
    }
    e.preventDefault();
    const sq = el._sq;
    const p = game.board[sq];

    // 指を置いた瞬間に移動させる（タップ→タップ操作）
    if (selected >= 0 && sq !== selected && moveSelectedTo(sq, true)) return;

    if (p && Chess.colorOf(p) === game.turn) {
      const wasSelected = sq === selected;
      if (!wasSelected) selectSquare(sq);
      drag = { from: sq, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, wasSelected, ghost: null, over: -1 };
      try { $('board').setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ }
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
    sanList.push(game.san(m));
    game.makeMove(m);
    state.moves.push(Chess.uci(m));
    selected = -1;
    legalFromSelected = [];
    const st = game.status();
    const after = () => {
      fx.play(moveSound(m));
      if (game.inCheck() && !st.over) fx.play('check');
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
      if (!resultShown) {
        resultShown = true;
        const r = resultMessage(st);
        $('resultTitle').textContent = r.title;
        $('resultText').textContent = r.text;
        setTimeout(() => {
          $('resultModal').hidden = false;
          let s = 'draw';
          if (st.winner) s = state.mode === 'cpu' && st.winner !== state.human ? 'lose' : 'win';
          fx.play(s);
        }, 450);
      }
      return;
    }
    if (state.mode === 'cpu' && game.turn !== state.human) requestAI();
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

  function undo() {
    if (!state.moves.length || animating) return;
    cancelAI();
    cancelFlip();
    cancelDrag();
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
    $('menuBtn').addEventListener('click', showMenu);
    $('undoBtn').addEventListener('click', undo);
    $('flipBtn').addEventListener('click', () => {
      if (flipping) return;
      state.flipped = !state.flipped;
      save();
      render();
    });
    $('newBtn').addEventListener('click', () => {
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
    $('resultClose').addEventListener('click', () => { $('resultModal').hidden = true; });
    $('resultNew').addEventListener('click', () => { $('resultModal').hidden = true; showMenu(); });

    if (window.ResizeObserver) new ResizeObserver(resizeBoard).observe($('board'));
    else window.addEventListener('resize', resizeBoard);
  }

  // ボタンは指が触れた瞬間に音と振動で応える
  function initButtonFeedback() {
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn.disabled || btn.id === 'soundBtn') return;
      fx.play('tap');
    }, { passive: true });
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
  initButtonFeedback();
  applyFeedbackSettings();
  initPWA();
})();
