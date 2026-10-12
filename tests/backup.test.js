// 記録のバックアップ（backup.js）のテスト
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../backup.js');

const NOW = new Date('2026-10-12T00:00:00Z');

/** localStorage の代わり */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}

test('書き出した内容を、そのまま読み込める', () => {
  const data = { 'simple-chess-story-v1': '{"cleared":3}', 'simple-chess-state-v1': '{"settings":{}}' };
  assert.deepEqual(B.parseBackup(B.createBackup(data, NOW)), data);
});

test('app 名・schemaVersion・日時が入っている', () => {
  const file = JSON.parse(B.createBackup({}, NOW));
  assert.equal(file.app, B.BACKUP_APP);
  assert.equal(file.schemaVersion, B.SCHEMA_VERSION);
  assert.equal(file.exportedAt, NOW.toISOString());
});

test('JSON ではないファイル・別のアプリ・新しすぎる版は読み込まない', () => {
  assert.throws(() => B.parseBackup('これは JSON ではない'), /バックアップファイルではありません/);
  assert.throws(() => B.parseBackup(JSON.stringify({ app: 'other', schemaVersion: 1, data: {} })), /このゲームのバックアップではありません/);
  assert.throws(() => B.parseBackup(JSON.stringify({ app: B.BACKUP_APP, schemaVersion: B.SCHEMA_VERSION + 1, data: {} })), /アプリを更新/);
});

test('中身が壊れているものは読み込まない（文字列でない値、壊れたストーリー・設定）', () => {
  const wrap = (data) => JSON.stringify({ app: B.BACKUP_APP, schemaVersion: 1, data });
  assert.throws(() => B.parseBackup(wrap({ 'simple-chess-story-v1': 1 })), /壊れています/);
  assert.throws(() => B.parseBackup(wrap({ 'simple-chess-story-v1': 'not json' })), /ストーリー/);
  assert.throws(() => B.parseBackup(wrap({ 'simple-chess-state-v1': '[1]' })), /設定/);
});

test('collectEntries: このゲームのキーだけを集め、デバッグモードの印は入れない', () => {
  const storage = fakeStorage({ 'simple-chess-story-v1': '{}', 'simple-chess-debug': '1', 'other-app': 'x' });
  assert.deepEqual(B.collectEntries(storage), { 'simple-chess-story-v1': '{}' });
});

test('mergeStory: クリアした話は大きいほう、星は話ごとに大きいほう、プロローグは見たほう', () => {
  const merged = B.mergeStory(
    { cleared: 4, stars: { 1: 3, 2: 1 }, prologue: false },
    { cleared: 6, stars: { 1: 2, 2: 3, 5: 1 }, prologue: true },
  );
  assert.equal(merged.cleared, 6);
  assert.deepEqual(merged.stars, { 1: 3, 2: 3, 5: 1 });
  assert.equal(merged.prologue, true);
});

test('mergeStory: 不正な星の値は無視し、空の記録どうしでも壊れない', () => {
  assert.deepEqual(B.mergeStory({}, { stars: { 1: 0, 2: 1.5, 3: 'x' } }).stars, {});
  assert.equal(B.mergeStory(null, null).cleared, 0);
});

test('mergeState: 設定はバックアップのもの、対局中の盤は今のものを残す', () => {
  const merged = B.mergeState({ settings: { sound: 'on' }, state: { moves: ['e4'] } }, { settings: { sound: 'off' }, state: { moves: [] } });
  assert.deepEqual(merged.settings, { sound: 'off' });
  assert.deepEqual(merged.state, { moves: ['e4'] });
  // 今の対局がなければ、バックアップの対局を使う
  assert.deepEqual(B.mergeState({ settings: {} }, { state: { moves: ['d4'] } }).state, { moves: ['d4'] });
});

test('applyEntries: ストーリーと対局は合わせ、このゲーム以外のキー・デバッグの印は保存しない', () => {
  const storage = fakeStorage({
    'simple-chess-story-v1': JSON.stringify({ cleared: 5, stars: { 1: 3 } }),
    'simple-chess-state-v1': JSON.stringify({ settings: { sound: 'on' }, state: { moves: ['e4'] } }),
  });
  const count = B.applyEntries({
    'simple-chess-story-v1': JSON.stringify({ cleared: 2, stars: { 1: 1, 2: 2 } }),
    'simple-chess-state-v1': JSON.stringify({ settings: { sound: 'off' }, state: { moves: [] } }),
    'simple-chess-debug': '1',
    'evil-key': 'x',
  }, storage);
  assert.equal(count, 2);
  const story = JSON.parse(storage.getItem('simple-chess-story-v1'));
  assert.equal(story.cleared, 5); // 進んでいる今の進行を戻さない
  assert.deepEqual(story.stars, { 1: 3, 2: 2 });
  const state = JSON.parse(storage.getItem('simple-chess-state-v1'));
  assert.deepEqual(state.settings, { sound: 'off' });
  assert.deepEqual(state.state, { moves: ['e4'] });
  assert.equal(storage.getItem('simple-chess-debug'), null);
  assert.equal(storage.getItem('evil-key'), null);
});
