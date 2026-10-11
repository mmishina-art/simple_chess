// ストーリーデータ（story.js）のテスト
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'story.js'), 'utf8'), sandbox);
const Story = sandbox.window.Story;
const SPEAKERS = new Set(['n', 'p', 'me', 'e', 'k']);

test('全10話がそろっている', () => {
  assert.equal(Story.STAGES.length, 10);
  for (const [i, S] of Story.STAGES.entries()) {
    for (const key of ['name', 'title', 'where', 'lose', 'check']) assert.ok(S[key], `第${i + 1}話の ${key}`);
    assert.ok(S.intro.length > 0 && S.outro.length > 0, `第${i + 1}話の会話`);
  }
});

test('会話の話し手と本文が正しい', () => {
  const all = [Story.PROLOGUE, Story.ENDING, ...Story.STAGES.flatMap((S) => [S.intro, S.outro])];
  for (const lines of all) {
    for (const [who, text] of lines) {
      assert.ok(SPEAKERS.has(who), `不明な話し手: ${who}`);
      assert.ok(typeof text === 'string' && text.length > 0);
    }
  }
});

test('全キャラクターの顔イラストを描ける', () => {
  const keys = ['pipi', 'noirKind', ...Story.STAGES.map((_, i) => 's' + (i + 1))];
  for (const k of keys) {
    const stage = k[0] === 's' ? +k.slice(1) : 0;
    const svg = Story.avatar(k, stage);
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/, k);
    assert.doesNotMatch(svg, /undefined/, k);
  }
});
