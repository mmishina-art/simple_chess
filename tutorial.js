/* チェスクエスト: チュートリアル「あそびかた」
 * ピピの説明を読みながら、専用の盤で実際に駒を動かしてルールを覚える。
 * 課題の種類:
 *   stars   … 盤上の★をすべて取る（白だけが続けて動ける）
 *   piece   … 指定した種類の駒を動かす
 *   capture … 指定した駒を取る
 *   escape  … チェックから逃げる（合法手なら何でもよい）
 *   mate    … チェックメイトする
 *   castle / promote / ep … キャスリング / プロモーション / アンパッサンをする
 *   read    … 読むだけ
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const fx = window.Feedback;
  const KEY = 'simple-chess-tutorial-v1';

  const LESSONS = [
    {
      title: '盤と駒', icon: 'K', desc: 'チェスの目的と駒の種類',
      fen: Chess.START_FEN,
      lines: [
        'チェスは 8×8＝64マスの盤で、白と黒が1手ずつ交互に動かすゲームだよ。白が先に指すんだ。',
        '駒は6種類。キング・クイーン・ルーク・ビショップ・ナイト・ポーン。それぞれ動き方がちがうよ。',
        '相手のキングを「チェックメイト」（もう逃げられない状態）にしたら勝ち！',
        'まずはポーンを1つ動かしてみよう。白いポーンをタップして、光ったマスをタップしてね。'
      ],
      goal: { type: 'piece', piece: 'P', text: '白いポーンを1つ動かそう' },
      done: 'ばっちり！ 駒をタップ → 行き先をタップ、で動かせるよ。'
    },
    {
      title: 'ポーン', icon: 'P', desc: '前に進み、ななめに取る',
      fen: '4k3/8/8/3p4/8/8/4P3/4K3 w - - 0 1',
      lines: [
        'ポーンは前に1マスずつ進むよ。後ろには戻れないんだ。',
        'でも最初の1回だけは、2マス進むこともできるよ。',
        '相手の駒は「ななめ前」にいるときだけ取れる。まっすぐ前の駒は取れないから気をつけて！'
      ],
      goal: { type: 'stars', squares: ['e4', 'd5'], text: 'ポーンで★を全部取ろう' },
      done: 'すごい！ 2マス進んで、ななめの駒を取れたね。'
    },
    {
      title: 'ルーク', icon: 'R', desc: 'たて・横にまっすぐ',
      fen: '7k/8/8/8/3R4/8/8/K7 w - - 0 1',
      lines: [
        'ルークは、たてと横にまっすぐ、どこまでも進めるよ。',
        'ただし、とちゅうに駒があると、その先には行けないんだ。'
      ],
      goal: { type: 'stars', squares: ['d7', 'a4', 'g4', 'd1'], text: 'ルークで★を全部取ろう' },
      done: 'いいね！ ルークは長い距離を一気に動ける、たのもしい駒だよ。'
    },
    {
      title: 'ビショップ', icon: 'B', desc: 'ななめにどこまでも',
      fen: '8/7k/8/8/3B4/8/K7/8 w - - 0 1',
      lines: [
        'ビショップは、ななめにどこまでも進めるよ。',
        'ずっと同じ色のマスだけを進むのが特ちょう。白マスのビショップは、黒マスには行けないんだ。'
      ],
      goal: { type: 'stars', squares: ['a7', 'f6', 'b2', 'g1'], text: 'ビショップで★を全部取ろう' },
      done: 'その調子！ ★がぜんぶ同じ色のマスだったの、気づいた？'
    },
    {
      title: 'クイーン', icon: 'Q', desc: 'いちばん強い駒',
      fen: '7k/8/8/8/3Q4/8/8/K7 w - - 0 1',
      lines: [
        'クイーンは、ルークとビショップを合わせた動き。たて・横・ななめ、どこまでも進める最強の駒だよ。',
        '強いぶん、取られないように大事にしよう！'
      ],
      goal: { type: 'stars', squares: ['a7', 'h4', 'd1', 'g7'], text: 'クイーンで★を全部取ろう' },
      done: 'さすが！ クイーンはどこへでも行けるね。'
    },
    {
      title: 'キング', icon: 'K', desc: 'いちばん大切な駒',
      fen: '7k/8/8/8/8/8/8/3K4 w - - 0 1',
      lines: [
        'キングは、まわりの8マスのどこかへ1マスだけ動けるよ。',
        'キングを取られる（チェックメイトされる）と負け。いちばん大切な駒なんだ。'
      ],
      goal: { type: 'stars', squares: ['c2', 'd3', 'e2'], text: 'キングで★を全部取ろう' },
      done: 'OK！ キングは1マスずつ、慎重にね。'
    },
    {
      title: 'ナイト', icon: 'N', desc: 'L字にジャンプ',
      fen: 'k7/8/8/8/8/8/PPP5/1N4K1 w - - 0 1',
      lines: [
        'ナイトは「L字」に動くよ。たてに2マス＋横に1マス、または横に2マス＋たてに1マス。',
        'ほかの駒を飛びこえられるのは、ナイトだけの特技なんだ！ 前がふさがっていても大丈夫。'
      ],
      goal: { type: 'stars', squares: ['c3', 'e4', 'f6'], text: 'ナイトで★を全部取ろう' },
      done: 'ジャンプ成功！ ナイトの動きは、慣れるとすごく便利だよ。'
    },
    {
      title: '駒を取る', icon: 'Q', desc: '相手の駒を取ろう',
      fen: 'k7/8/8/3q4/8/8/8/3RK3 w - - 0 1',
      lines: [
        '相手の駒があるマスに動くと、その駒を取れるよ。',
        '駒の強さの目安は、クイーン9・ルーク5・ビショップ3・ナイト3・ポーン1。強い駒を取れたら大チャンス！',
        'あ、黒のクイーンが取れそうだよ！'
      ],
      goal: { type: 'capture', piece: 'q', text: '黒のクイーンを取ろう' },
      done: 'やった！ クイーン（9点）をゲット！'
    },
    {
      title: 'チェック', icon: 'K', desc: 'キングがねらわれたら',
      fen: '4r2k/8/8/8/8/8/3B4/4K3 w - - 0 1',
      lines: [
        'キングが相手の駒にねらわれている状態を「チェック」というよ。今、白のキングが黒のルークにねらわれている！',
        'チェックされたら、必ず次の手でふせがないといけない。',
        'ふせぎ方は3つ。①キングが逃げる ②あいだに駒を置く ③ねらっている駒を取る。どれかでピンチを脱出しよう！'
      ],
      goal: { type: 'escape', text: 'チェックをふせごう' },
      done: 'ピンチ脱出！ チェックは、かならずふせげば大丈夫。'
    },
    {
      title: 'チェックメイト', icon: 'R', desc: 'これで勝ち！',
      fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
      lines: [
        'チェックされて、どうやってもふせげない状態が「チェックメイト」。これで勝ちだよ！',
        '黒のキングは、自分のポーンがじゃまで前に逃げられない……。',
        'ルークで1手でチェックメイトしてみよう！'
      ],
      goal: { type: 'mate', text: '1手でチェックメイトしよう' },
      done: 'チェックメイト！ これでもう、きみは立派なチェスプレイヤーだ！'
    },
    {
      title: 'キャスリング', icon: 'R', desc: 'キングとルークの特別な手',
      fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1',
      lines: [
        'キングとルークを一度に動かす、特別な手「キャスリング」を覚えよう。',
        'キングを横に2マス動かすと、ルークがキングを飛びこえて、となりにやってくるよ。',
        'できる条件：キングもルークもまだ一度も動いていない・あいだに駒がない・チェックされていない・キングが通るマスがねらわれていない。',
        'キングを右か左に2マス動かしてみよう！'
      ],
      goal: { type: 'castle', text: 'キャスリングしよう' },
      done: 'キャスリング成功！ キングを安全な場所に入れて、ルークも活やくできるようになるよ。'
    },
    {
      title: 'プロモーション', icon: 'P', desc: 'ポーンが大変身',
      fen: '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1',
      lines: [
        'ポーンがいちばん奥のマスまでたどり着くと、クイーン・ルーク・ビショップ・ナイトのどれかに変身できるよ！ これを「プロモーション」というんだ。',
        'ふつうは最強のクイーンを選ぶよ。このレッスンでは自動でクイーンになるからね。'
      ],
      goal: { type: 'promote', text: 'ポーンをいちばん奥まで進めよう' },
      done: '大変身！ 小さなポーンも、あきらめなければクイーンになれるんだ。'
    },
    {
      title: 'アンパッサン', icon: 'P', desc: 'ちょっとふしぎなポーンの取り方',
      fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
      lines: [
        '黒のポーンが、今ちょうど d7 から d5 へ2マス進んできて、白のポーンのとなりに並んだところだよ。',
        'こんなとき「その直後の1回だけ」、1マス進んだときと同じように、ななめ前（d6）に進んでそのポーンを取れるんだ。これが「アンパッサン」！',
        '白のポーンを d6 に動かして、となりの黒のポーンを取ってみよう。'
      ],
      goal: { type: 'ep', text: 'アンパッサンで取ろう' },
      done: 'アンパッサン成功！ 知っていると、ちょっと自慢できるルールだよ。'
    },
    {
      title: '引き分け', icon: 'K', desc: '勝ち負けがつかないとき',
      fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
      lines: [
        '最後に「引き分け」を覚えよう。この盤は黒の番。黒のキングはチェックされていないのに、どこに動いても取られてしまう……。',
        'このように、チェックされていないのに動ける手がない状態を「ステイルメイト」といって、引き分けになるんだ。勝っているときは気をつけて！',
        'ほかにも、同じ局面が3回くり返したとき、50手のあいだ駒を取らずポーンも動かなかったとき、おたがいに詰ませる駒が足りないときも引き分けになるよ。',
        'これでルールはばっちり！ ストーリーモードで、影の塔に挑戦してみよう！'
      ],
      goal: { type: 'read', text: '説明を読んだらクリア！' },
      done: 'チュートリアル完了！ おつかれさま！'
    }
  ];

  let deps = null;        // { onlyScreen, setMusic, syncHistory }
  const progress = { done: [] };
  let lesson = null;      // 進行中のレッスン
  const squares = [];

  function load() {
    try { Object.assign(progress, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 無視 */ }
    if (!Array.isArray(progress.done)) progress.done = [];
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* 無視 */ }
  }

  const pieceIcon = (p) => `<span class="piece ${Chess.colorOf(p)}">${Pieces.svg(p)}</span>`;

  // ---- レッスン一覧 ----
  function showList() {
    lesson = null;
    deps.onlyScreen('tutorial');
    deps.setMusic('talk');
    const list = $('lessonList');
    list.innerHTML = '';
    LESSONS.forEach((L, i) => {
      const done = progress.done.includes(i);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'lesson-card' + (done ? ' done' : '');
      card.innerHTML = `<span class="lesson-icon">${pieceIcon(L.icon)}</span>
        <span class="lesson-info"><span class="lesson-no">レッスン${i + 1}</span><strong>${L.title}</strong><small>${L.desc}</small></span>
        <span class="lesson-badge">${done ? '&#10003;&#xFE0E; クリア' : 'やってみる'}</span>`;
      card.addEventListener('click', () => openLesson(i));
      list.appendChild(card);
    });
    $('lessonCount').textContent = `${progress.done.length}/${LESSONS.length}`;
    deps.syncHistory();
  }

  // ---- レッスン本体 ----
  function openLesson(i) {
    const L = LESSONS[i];
    lesson = { i, L, g: new Chess(L.fen), line: 0, sel: -1, targets: [], got: new Set(), clear: false, last: null };
    deps.onlyScreen('lesson');
    $('lessonTitle').textContent = `レッスン${i + 1}　${L.title}`;
    $('lessonNext').hidden = true;
    showLine();
    draw();
    deps.syncHistory();
  }

  function retry() {
    if (lesson) openLesson(lesson.i);
  }

  // ピピの説明（タップで次へ）
  function showLine() {
    const L = lesson.L;
    const reading = lesson.line < L.lines.length;
    $('tutText').textContent = lesson.clear ? L.done : reading ? L.lines[lesson.line] : L.goal.text + '！';
    $('tutMore').hidden = !reading || lesson.clear;
    $('tutTalk').classList.toggle('done', lesson.clear);
    updateGoal();
  }

  function nextLine() {
    if (!lesson || lesson.clear) return;
    if (lesson.line < lesson.L.lines.length) {
      lesson.line++;
      fx.play('tap');
      showLine();
      // 読むだけのレッスンは最後まで読んだらクリア
      if (lesson.L.goal.type === 'read' && lesson.line >= lesson.L.lines.length) finish();
    }
  }

  function updateGoal() {
    const goal = lesson.L.goal;
    let text = '目標：' + goal.text;
    if (goal.type === 'stars') text += `（${lesson.got.size}/${goal.squares.length}）`;
    if (lesson.clear) text = 'クリア！';
    $('lessonGoal').textContent = text;
    $('lessonGoal').classList.toggle('clear', lesson.clear);
  }

  function legalFrom(sq) {
    // 練習用の盤ではキングを取る手は出さない
    return lesson.g.movesFrom(sq).filter((m) => m.captured !== 'k' && m.captured !== 'K');
  }

  function onTap(sq) {
    if (!lesson || lesson.clear || lesson.L.goal.type === 'read') return;
    const g = lesson.g;
    const target = lesson.targets.find((m) => m.to === sq);
    if (lesson.sel >= 0 && target) { play(target); return; }
    const p = g.board[sq];
    if (p && Chess.colorOf(p) === g.turn) {
      lesson.sel = sq;
      lesson.targets = legalFrom(sq);
      if (lesson.L.goal.type === 'promote') lesson.targets = lesson.targets.filter((m) => !m.promo || m.promo === 'Q');
      fx.play('select');
    } else {
      if (lesson.sel >= 0) fx.play('error');
      lesson.sel = -1;
      lesson.targets = [];
    }
    draw();
  }

  function play(m) {
    const L = lesson.L, g = lesson.g, goal = L.goal;
    lesson.sel = -1;
    lesson.targets = [];
    g.makeMove(m);
    lesson.last = m;
    fx.play(m.flag === 'k' || m.flag === 'q' ? 'castle' : m.promo ? 'promote' : m.captured ? 'capture' : 'move');

    let ok = false, wrong = false;
    switch (goal.type) {
      case 'stars': {
        const name = Chess.sqName(m.to);
        if (goal.squares.includes(name) && !lesson.got.has(name)) {
          lesson.got.add(name);
          setTimeout(() => fx.play('confirm'), 120);
        }
        ok = lesson.got.size === goal.squares.length;
        // 白だけが続けて動けるよう、手番を白に戻す
        g.turn = 'w'; g.ep = -1; g.computeHash();
        break;
      }
      case 'piece': ok = m.piece === goal.piece; wrong = !ok; break;
      case 'capture': ok = m.captured === goal.piece; wrong = !ok; break;
      case 'escape': ok = true; break;
      case 'mate': ok = g.status().reason === 'checkmate'; wrong = !ok; break;
      case 'castle': ok = m.flag === 'k' || m.flag === 'q'; wrong = !ok; break;
      case 'promote': ok = !!m.promo; wrong = !ok; break;
      case 'ep': ok = m.flag === 'e'; wrong = !ok; break;
    }
    draw();
    if (ok) finish();
    else if (wrong) {
      // 課題と違う手は「おしい！」と言って1手戻す
      $('tutText').textContent = 'おしい！ もう一度やってみよう。（' + goal.text + '）';
      setTimeout(() => {
        if (!lesson || lesson.clear) return;
        g.undo();
        lesson.last = null;
        draw();
      }, 700);
    }
  }

  function finish() {
    lesson.clear = true;
    if (!progress.done.includes(lesson.i)) { progress.done.push(lesson.i); save(); }
    setTimeout(() => fx.play('win'), 250);
    $('lessonNext').hidden = false;
    $('lessonNext').textContent = lesson.i + 1 < LESSONS.length ? 'つぎのレッスンへ' : 'レッスン一覧へ';
    showLine();
    draw();
  }

  function next() {
    if (!lesson) return;
    if (lesson.i + 1 < LESSONS.length) openLesson(lesson.i + 1);
    else showList();
  }

  // ---- 練習用の盤 ----
  function buildBoard() {
    const board = $('tutBoard');
    for (let i = 0; i < 64; i++) {
      const el = document.createElement('div');
      el.className = 'sq';
      el.addEventListener('click', () => onTap(i));
      board.appendChild(el);
      squares.push(el);
    }
    // 説明やボタンを置いた残りの場所に、収まる最大の正方形で盤を描く
    const wrap = board.parentElement;
    const fit = () => {
      const size = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight));
      if (size <= 0) return;
      board.style.width = board.style.height = size + 'px';
      board.style.setProperty('--sq', (size / 8) + 'px');
    };
    if (window.ResizeObserver) new ResizeObserver(fit).observe(wrap); else window.addEventListener('resize', fit);
  }

  function draw() {
    if (!lesson) return;
    const g = lesson.g, goal = lesson.L.goal;
    const stars = goal.type === 'stars' ? goal.squares.filter((s) => !lesson.got.has(s)).map(Chess.sqIndex) : [];
    const checkSq = goal.type !== 'stars' && g.kings[g.turn] >= 0 && g.inCheck() ? g.kings[g.turn] : -1;
    const tmap = new Map(lesson.targets.map((m) => [m.to, m]));
    for (let sq = 0; sq < 64; sq++) {
      const el = squares[sq], r = sq >> 3, c = sq & 7;
      const cls = ['sq', (r + c) % 2 === 0 ? 'light' : 'dark'];
      if (lesson.last && (sq === lesson.last.from || sq === lesson.last.to)) cls.push('last');
      if (sq === lesson.sel) cls.push('sel');
      if (sq === checkSq) cls.push('check');
      if (tmap.has(sq)) { cls.push('target'); if (tmap.get(sq).captured) cls.push('capture'); }
      el.className = cls.join(' ');
      let html = '';
      const p = g.board[sq];
      if (p) html += pieceIcon(p);
      if (stars.includes(sq) && !p) html += '<span class="tut-star" aria-hidden="true">&#9733;</span>';
      if (c === 0) html += `<span class="coord rank">${8 - r}</span>`;
      if (r === 7) html += `<span class="coord file">${'abcdefgh'[c]}</span>`;
      el.innerHTML = html;
    }
    updateGoal();
  }

  function init(d) {
    deps = d;
    load();
    buildBoard();
    $('tutAv').innerHTML = Story.avatar('pipi', 0);
    $('tutTalk').addEventListener('click', nextLine);
    $('lessonRetry').addEventListener('click', retry);
    $('lessonNext').addEventListener('click', next);
  }

  window.Tutorial = {
    init,
    showList,
    isLesson: () => !!lesson,
    count: () => LESSONS.length,
    doneCount: () => progress.done.length,
    LESSONS
  };
})();
