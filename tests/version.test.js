// バージョン番号が version.js と sw.js（キャッシュ名）でそろっていること
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('version.js と sw.js のバージョンが同じ', () => {
  const v = /APP_VERSION = '([0-9.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', 'version.js'), 'utf8'))[1];
  const c = /const CACHE = 'simple-chess-v([0-9.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'))[1];
  assert.equal(c, v, 'sw.js の CACHE を version.js と同じ番号にしてください');
});

test('sw.js がキャッシュするファイルは、すべて存在する', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const list = /const ASSETS = \[([\s\S]*?)\];/.exec(sw)[1].match(/'([^']+)'/g).map((x) => x.slice(1, -1)).filter((x) => x !== './');
  for (const f of list) assert.ok(fs.existsSync(path.join(__dirname, '..', f)), `見つからない: ${f}`);
});
