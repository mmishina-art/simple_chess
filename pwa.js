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

  // ---- インストール方法の説明 ----
  let deferred = null; // ブラウザのインストール案内（Android / パソコンの Chrome・Edge など）
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function detectPlatform() {
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/android/i.test(ua)) return 'android';
    return 'pc';
  }

  function selectTab(name) {
    document.querySelectorAll('#installModal [data-tab]').forEach((b) => {
      const on = b.dataset.tab === name;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on);
    });
    document.querySelectorAll('#installModal [data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  }

  function refreshGuide() {
    $('installDone').hidden = !isStandalone();
    $('installNow').hidden = !deferred || isStandalone();
  }

  let opts = {};
  function openGuide() {
    refreshGuide();
    selectTab(detectPlatform());
    $('installModal').hidden = false;
    if (opts.afterOpen) opts.afterOpen();
  }

  function init(o) {
    opts = o || {};
    if ('serviceWorker' in navigator && location.protocol !== 'file:') initUpdates();
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      refreshGuide();
    });
    window.addEventListener('appinstalled', () => { deferred = null; refreshGuide(); updateHint(); });
    $('installNow').addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      refreshGuide();
    });
    document.querySelectorAll('#installModal [data-tab]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));
    $('installHint').addEventListener('click', (e) => { if (e.target.closest('button')) openGuide(); });
    updateHint();
  }

  // タイトル画面の下に、インストール方法への入口を出す（インストール済みなら出さない）
  function updateHint() {
    const hint = $('installHint');
    hint.hidden = isStandalone();
    hint.innerHTML = '<button type="button" class="link-btn">アプリとしてインストールする方法</button>';
  }

  window.Pwa = { init, openGuide, isStandalone };
})();
