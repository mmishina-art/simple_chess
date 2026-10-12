// 起動できなかったときの復旧（boot.js）が、ちゃんとつながっていること
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('index.html は boot.js をいちばん先に読み込み、復旧の表示（#boot-error / #boot-repair）を持つ', () => {
  const html = read('index.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(scripts[0], 'boot.js', 'boot.js を最初の <script> にしてください');
  assert.match(html, /id="boot-error"/);
  assert.match(html, /id="boot-repair"/);
});

test('app.js は起動できたら window.__appStarted = true にする', () => {
  assert.match(read('app.js'), /window\.__appStarted = true/);
});

test('boot.js は sw.js のキャッシュ対象に入っている', () => {
  assert.match(read('sw.js'), /'boot\.js'/);
});
