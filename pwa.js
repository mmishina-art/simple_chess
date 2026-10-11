/* シンプルチェス: PWA まわり（新しいバージョンの通知と更新、ホーム画面への追加） */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // 新しい版が届いたら画面下に「更新」を出し、押されたら切り替えて読み込み直す
  function initUpdates() {
    const sw = navigator.serviceWorker;
    // 「更新」を押した時だけ再読み込みする（初回インストール時の切り替えでは読み込み直さない）
    let wantReload = false;
    sw.addEventListener('controllerchange', () => {
      if (!wantReload) return;
      wantReload = false;
      location.reload();
    });
    sw.register('sw.js').then((reg) => {
      const offer = (worker) => {
        // 初回インストール時（まだ旧版がない）は通知しない
        if (!worker || !sw.controller) return;
        $('updateBar').hidden = false;
        $('updateBtn').onclick = () => {
          $('updateBtn').disabled = true;
          $('updateBtn').textContent = '更新中…';
          wantReload = true;
          worker.postMessage({ type: 'SKIP_WAITING' });
        };
      };
      if (reg.waiting) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => { if (nw.state === 'installed') offer(nw); });
      });
      // アプリを開き直した時や、しばらくぶりに表示した時に新しい版を確認する
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(() => { /* オフライン非対応でも動作 */ });
    $('updateLater').addEventListener('click', () => { $('updateBar').hidden = true; });
  }

  function init() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') initUpdates();
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const hint = $('installHint');
    let deferred = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      hint.hidden = false;
      hint.innerHTML = '<button type="button" class="btn small" id="installBtn">ホーム画面に追加</button>';
      $('installBtn').addEventListener('click', async () => {
        deferred.prompt();
        await deferred.userChoice;
        deferred = null;
        hint.hidden = true;
      });
    });
    if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
      hint.hidden = false;
      hint.textContent = '共有ボタン →「ホーム画面に追加」でアプリとして使えます';
    }
  }

  window.Pwa = { init };
})();
