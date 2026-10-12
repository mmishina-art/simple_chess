// 画面の拡大（ピンチ）を許可していること。user-scalable=no / maximum-scale を入れない
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('index.html の viewport で拡大を禁止していない', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const viewport = /<meta name="viewport" content="([^"]*)"/.exec(html)[1];
  assert.doesNotMatch(viewport, /user-scalable\s*=\s*(no|0)/);
  assert.doesNotMatch(viewport, /maximum-scale/);
});
