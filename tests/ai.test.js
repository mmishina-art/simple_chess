// CPU（ai.js）のテスト
const test = require('node:test');
const assert = require('node:assert/strict');
const Chess = require('../chess.js');
const ai = require('../ai.js');

const POSITIONS = [
  Chess.START_FEN,
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
  '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'
];

// 時間のかからないレベルは複数局面で、合法手を返すことを確認
for (const level of [1, 2, 's1', 's2', 's3', 's4', 's5', 's6']) {
  test(`レベル ${level} は合法手を指す`, () => {
    for (const fen of POSITIONS) {
      const uci = ai.think(fen, [], level);
      assert.ok(new Chess(fen).moveFromUci(uci), `${fen} → ${uci}`);
    }
  });
}

// 1手詰めを見逃さない（ランダム性のない強いレベル）
const MATE_IN_1 = [
  ['r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'f3f7'],
  ['6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'd1d8']
];
for (const level of [2, 's7', 's8', 's10']) {
  test(`レベル ${level} は1手詰めを見つける`, () => {
    for (const [fen, best] of MATE_IN_1) assert.equal(ai.think(fen, [], level), best, fen);
  });
}

test('指し手の列から局面を再現して考える', () => {
  const moves = ['e2e4', 'e7e5', 'g1f3'];
  const uci = ai.think(Chess.START_FEN, moves, 's4');
  const g = new Chess();
  for (const u of moves) g.makeMove(g.moveFromUci(u));
  assert.ok(g.moveFromUci(uci));
});
