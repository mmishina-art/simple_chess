// ルールエンジン（chess.js）のテスト
const test = require('node:test');
const assert = require('node:assert/strict');
const Chess = require('../chess.js');

function perft(g, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of g.moves()) { g.makeMove(m); n += perft(g, depth - 1); g.undo(); }
  return n;
}

// 標準的な検証局面と、深さごとの合法手の総数
const PERFT = [
  ['初期配置', Chess.START_FEN, [20, 400, 8902, 197281]],
  ['Kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['ポジション3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['ポジション4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['ポジション5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]]
];

for (const [name, fen, counts] of PERFT) {
  test(`perft: ${name}`, () => {
    const g = new Chess(fen);
    const before = g.fen();
    counts.forEach((expected, i) => assert.equal(perft(g, i + 1), expected, `深さ${i + 1}`));
    assert.equal(g.fen(), before, '探索後に局面が元に戻ること');
  });
}

test('ハッシュは差分更新と再計算で一致する', () => {
  const g = new Chess(PERFT[1][1]);
  for (const m of g.moves()) {
    g.makeMove(m);
    const k = g.key();
    g.computeHash();
    assert.equal(g.key(), k, Chess.uci(m));
    g.undo();
  }
});

test('ヌルムーブ（探索用のパス）は局面を元に戻す', () => {
  const g = new Chess();
  g.makeMove(g.moveFromUci('e2e4'));
  const fen = g.fen(), key = g.key();
  g.makeNull();
  assert.equal(g.turn, 'w');
  g.undoNull();
  assert.equal(g.fen(), fen);
  assert.equal(g.key(), key);
});

function play(ucis, fen) {
  const g = new Chess(fen);
  const sans = [];
  for (const u of ucis) {
    const m = g.moveFromUci(u);
    assert.ok(m, `合法手であること: ${u}`);
    sans.push(g.san(m));
    g.makeMove(m);
  }
  return { g, sans };
}

test('棋譜（SAN）: チェックメイト・キャスリング・成り・あいまいさ回避', () => {
  assert.deepEqual(play(['f2f3', 'e7e5', 'g2g4', 'd8h4']).sans, ['f3', 'e5', 'g4', 'Qh4#']);
  assert.deepEqual(play(['e1g1'], 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1').sans, ['O-O']);
  assert.deepEqual(play(['e1c1'], 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1').sans, ['O-O-O']);
  assert.deepEqual(play(['a7a8q'], '8/P7/8/8/8/8/8/k3K3 w - - 0 1').sans, ['a8=Q+']);
  assert.deepEqual(play(['a7a8q'], '8/P7/8/8/8/8/8/k1K5 w - - 0 1').sans, ['a8=Q#']);
  assert.deepEqual(play(['b1d2'], '4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1').sans, ['Nbd2']);
});

test('不正な手は受け付けない', () => {
  const g = new Chess();
  assert.equal(g.moveFromUci('e2e5'), null);
  assert.equal(g.moveFromUci('e1e2'), null);
});

test('終局判定', () => {
  assert.deepEqual(play(['f2f3', 'e7e5', 'g2g4', 'd8h4']).g.status(), { over: true, reason: 'checkmate', winner: 'b' });
  assert.equal(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').status().reason, 'stalemate');
  assert.equal(new Chess('8/8/4k3/8/8/3NK3/8/8 w - - 0 1').status().reason, 'insufficient');
  assert.equal(new Chess('8/8/4k3/8/8/3RK3/8/8 w - - 100 80').status().reason, 'fifty');
  const rep = play(['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']).g;
  assert.equal(rep.status().reason, 'repetition');
  assert.equal(new Chess().status().over, false);
});

test('アンパッサン', () => {
  const { g, sans } = play(['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6']);
  assert.equal(sans[4], 'exd6');
  assert.equal(g.board[Chess.sqIndex('d5')], null, '取られたポーンが消えること');
});
