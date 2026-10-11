// チュートリアル（tutorial.js）のレッスンが、実際にクリアできることを確かめる
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Chess = require('../chess.js');

const sandbox = { window: {}, Chess, Pieces: { svg: () => '' }, document: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'tutorial.js'), 'utf8'), sandbox);
const LESSONS = sandbox.window.Tutorial.LESSONS;

// レッスンごとの模範解答（UCI）
const SOLUTIONS = {
  '盤と駒': ['e2e4'],
  'ポーン': ['e2e4', 'e4d5'],
  'ルーク': ['d4d7', 'd7a7', 'a7a4', 'a4g4', 'g4d4', 'd4d1'],
  'ビショップ': ['d4a7', 'a7d4', 'd4f6', 'f6d4', 'd4b2', 'b2g7', 'g7d4', 'd4g1'],
  'クイーン': ['d4a7', 'a7h7', 'h7h4', 'h4d4', 'd4d1', 'd1g4', 'g4g7'],
  'キング': ['d1c2', 'c2d3', 'd3e2'],
  'ナイト': ['b1c3', 'c3e4', 'e4f6'],
  '駒を取る': ['d1d5'],
  'チェック': ['d2e3'],
  'チェックメイト': ['a1a8'],
  'キャスリング': ['e1g1'],
  'プロモーション': ['b7b8q'],
  'アンパッサン': ['e5d6'],
  '引き分け': []
};

for (const L of LESSONS) {
  test(`レッスン「${L.title}」はクリアできる`, () => {
    const g = new Chess(L.fen);
    const goal = L.goal;
    const got = new Set();
    let last = null;
    for (const u of SOLUTIONS[L.title]) {
      const m = g.moveFromUci(u);
      assert.ok(m, `合法手であること: ${u}`);
      assert.ok(m.captured !== 'k' && m.captured !== 'K', 'キングは取らない');
      g.makeMove(m);
      last = m;
      if (goal.type === 'stars') {
        if (goal.squares.includes(Chess.sqName(m.to))) got.add(Chess.sqName(m.to));
        g.turn = 'w'; g.ep = -1; g.computeHash();
      }
    }
    const ok = {
      stars: () => got.size === goal.squares.length,
      piece: () => last.piece === goal.piece,
      capture: () => last.captured === goal.piece,
      escape: () => !!last,
      mate: () => g.status().reason === 'checkmate',
      castle: () => last.flag === 'k' || last.flag === 'q',
      promote: () => !!last.promo,
      ep: () => last.flag === 'e',
      read: () => true
    }[goal.type]();
    assert.ok(ok, `目標を達成できること: ${goal.text}`);
    assert.ok(L.lines.length > 0 && L.done, '説明とクリア時のせりふがあること');
  });
}

test('チェックのレッスンは最初からチェックされている', () => {
  const L = LESSONS.find((x) => x.goal.type === 'escape');
  assert.ok(new Chess(L.fen).inCheck());
});

test('引き分けのレッスンはステイルメイトの局面', () => {
  const L = LESSONS.find((x) => x.title === '引き分け');
  assert.equal(new Chess(L.fen).status().reason, 'stalemate');
});
