/* チェスクエスト: 記録のバックアップ（ファイルに書き出す / 読み込む）
 * localStorage の記録は、ブラウザの都合で消えることがある（特に iPhone）ので、ファイルに残せるようにする。
 * ファイルには app 名と schemaVersion を入れ、別のアプリや新しすぎる版のファイルは読み込まない。
 * ブラウザ（window.Backup）と Node（テスト）の両方から読み込まれる。 */
(function (root) {
  'use strict';

  /** 保存データの形（schemaVersion）。保存の形を変えるときは上げ、読み込み側で古い形を変換する。 */
  var SCHEMA_VERSION = 1;
  var BACKUP_APP = 'simple-chess';
  var PREFIX = 'simple-chess-';
  var STATE_KEY = 'simple-chess-state-v1'; // { settings, state }（設定と、対局中の盤）
  var STORY_KEY = 'simple-chess-story-v1'; // ストーリーの進行
  var SKIP = ['simple-chess-debug'];       // デバッグモードの印は、バックアップに入れない

  function parseJson(text, fallback) {
    try { var v = JSON.parse(text); return v === null || v === undefined ? fallback : v; } catch (e) { return fallback; }
  }
  function isObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  /** ストーリーの進行を合わせる: 進んでいるほうを残す（古いバックアップで進行を戻さない） */
  function mergeStory(current, incoming) {
    var cur = isObject(current) ? current : {};
    var inc = isObject(incoming) ? incoming : {};
    var merged = Object.assign({}, inc, cur);
    merged.cleared = Math.max(Number(cur.cleared) || 0, Number(inc.cleared) || 0);
    merged.prologue = !!(cur.prologue || inc.prologue);
    var stars = {};
    [inc.stars, cur.stars].forEach(function (s) {
      if (!isObject(s)) return;
      Object.keys(s).forEach(function (n) {
        var v = Number(s[n]);
        if (Number.isInteger(v) && v >= 1) stars[n] = Math.max(stars[n] || 0, v);
      });
    });
    merged.stars = stars;
    return merged;
  }

  /** 設定と対局を合わせる: 設定はバックアップのもの、対局中の盤は今のものを残す（なければバックアップのもの） */
  function mergeState(current, incoming) {
    var cur = isObject(current) ? current : {};
    var inc = isObject(incoming) ? incoming : {};
    var merged = {};
    if (inc.settings || cur.settings) merged.settings = inc.settings || cur.settings;
    if (cur.state || inc.state) merged.state = cur.state || inc.state;
    return merged;
  }

  function createBackup(data, now) {
    return JSON.stringify({ app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: (now || new Date()).toISOString(), data: data }, null, 2);
  }

  /** ファイルの中身を検査して、保存するデータ（キー → 文字列）を返す。おかしいときは理由つきで例外を投げる。 */
  function parseBackup(text) {
    var file;
    try { file = JSON.parse(text); } catch (e) { throw new Error('バックアップファイルではありません', { cause: e }); }
    if (!isObject(file) || file.app !== BACKUP_APP) throw new Error('このゲームのバックアップではありません');
    if (typeof file.schemaVersion !== 'number' || file.schemaVersion > SCHEMA_VERSION) {
      throw new Error('新しい版のバックアップです。アプリを更新してから読み込んでください');
    }
    if (!isObject(file.data)) throw new Error('バックアップの中身がありません');
    Object.keys(file.data).forEach(function (k) {
      if (typeof file.data[k] !== 'string') throw new Error('バックアップの中身が壊れています: ' + k);
    });
    [[STATE_KEY, 'ゲームの設定'], [STORY_KEY, 'ストーリーの進行']].forEach(function (pair) {
      if (file.data[pair[0]] !== undefined && !isObject(parseJson(file.data[pair[0]], null))) {
        throw new Error('バックアップの中身が壊れています: ' + pair[1]);
      }
    });
    return file.data;
  }

  /** このゲームの保存データ（キー → 文字列）を集める */
  function collectEntries(storage) {
    var data = {};
    for (var i = 0; i < storage.length; i++) {
      var key = storage.key(i);
      if (key && key.indexOf(PREFIX) === 0 && SKIP.indexOf(key) === -1) data[key] = storage.getItem(key) || '';
    }
    return data;
  }

  /** バックアップの中身を保存する。ストーリーと対局は合わせ、それ以外は上書きする。保存した件数を返す。 */
  function applyEntries(data, storage) {
    var count = 0;
    Object.keys(data).forEach(function (key) {
      if (key.indexOf(PREFIX) !== 0 || SKIP.indexOf(key) !== -1) return;
      var value = data[key];
      if (key === STORY_KEY) {
        value = JSON.stringify(mergeStory(parseJson(storage.getItem(key), {}), parseJson(value, {})));
      } else if (key === STATE_KEY) {
        value = JSON.stringify(mergeState(parseJson(storage.getItem(key), {}), parseJson(value, {})));
      }
      storage.setItem(key, value);
      count++;
    });
    return count;
  }

  /** 画面のボタンにつなぐ。読み込めたら、画面を読み込み直して記録を反映する。 */
  function setup(els) {
    els.exportButton.addEventListener('click', function () {
      var blob = new Blob([createBackup(collectEntries(localStorage))], { type: 'application/json' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'simple-chess-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      link.click();
      URL.revokeObjectURL(link.href);
      els.message.textContent = 'ファイルに書き出しました';
    });
    els.importInput.addEventListener('change', function () {
      var file = els.importInput.files[0];
      if (!file) return;
      file.text().then(function (text) {
        var count = applyEntries(parseBackup(text), localStorage);
        els.message.textContent = count + ' 件の記録を読み込みました。画面を読み込み直します…';
        setTimeout(function () { location.reload(); }, 1200);
      }).catch(function (error) {
        els.message.textContent = error instanceof Error ? error.message : '読み込めませんでした';
      }).then(function () { els.importInput.value = ''; });
    });
  }

  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION, BACKUP_APP: BACKUP_APP,
    mergeStory: mergeStory, mergeState: mergeState,
    createBackup: createBackup, parseBackup: parseBackup,
    collectEntries: collectEntries, applyEntries: applyEntries, setup: setup,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Backup = api;
})(typeof self !== 'undefined' ? self : this);
