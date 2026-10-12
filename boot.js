/* シンプルチェス: 起動係
 * app.js などとは別の、ふつうのスクリプト。メインが読み込めなくても必ず動く。
 * 起動できなかったとき（キャッシュのファイルの食い違いなど）に、キャッシュを消して読み込み直す。
 *  ・保存データ（localStorage）は消さない
 *  ・1回目は自動でなおす。2分以内の2回目は、ボタン（#boot-repair）を出す
 * アプリが起動できたら、app.js が window.__appStarted = true にする。 */
(function () {
  'use strict';
  var REPAIR_KEY = 'simple-chess:repaired-at';
  var WAIT_MS = window.__bootWaitMs || 8000; // テストでは短くできる
  var failed = false;

  function repair() {
    var jobs = [];
    if ('serviceWorker' in navigator) {
      jobs.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); }));
      }));
    }
    if (window.caches) {
      jobs.push(caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }));
    }
    return Promise.all(jobs).catch(function () {}).then(function () { location.reload(); });
  }

  function showBox() {
    var box = document.getElementById('boot-error');
    if (!box) return;
    box.hidden = false;
    document.getElementById('boot-repair').onclick = function () {
      box.textContent = 'なおしています…';
      repair();
    };
  }

  function onStartFailed() {
    if (failed || window.__appStarted) return;
    failed = true;
    var last = 0;
    try { last = Number(sessionStorage.getItem(REPAIR_KEY)) || 0; } catch (e) { /* 保存できなくても続ける */ }
    if (Date.now() - last > 2 * 60 * 1000) {
      try { sessionStorage.setItem(REPAIR_KEY, String(Date.now())); } catch (e) { /* 同上 */ }
      repair();
    } else {
      showBox();
    }
  }

  // 読み込みエラーが起きたとき
  window.addEventListener('error', function () {
    if (!window.__appStarted) setTimeout(onStartFailed, 300);
  });
  // エラーが出なくても、しばらく待って起動していなければ
  window.addEventListener('load', function () { setTimeout(onStartFailed, WAIT_MS); });
})();
