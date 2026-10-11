/* シンプルチェス: 駒のイラスト（SVG）
 * 端末のフォントに左右されないよう、駒は自前の SVG で描く。
 * 色は CSS 変数（--pf 塗り / --ps 縁 / --pd 模様）で白黒を切り替える。
 */
(function () {
  'use strict';

  const BASE = '<path d="M10 40h25v-2.6c0-2.2-1.6-3.6-3.8-3.6H13.8c-2.2 0-3.8 1.4-3.8 3.6z"/>';

  const SHAPES = {
    p: BASE +
      '<path d="M15.5 34c.6-5.6 2.6-9.2 5-11.4h4c2.4 2.2 4.4 5.8 5 11.4z"/>' +
      '<circle cx="22.5" cy="16" r="6"/>',
    r: BASE +
      '<path d="M14 34l1.6-15.5h13.8L31 34z"/>' +
      '<path d="M12 18.5V10h4.6v3.2h3.6V10h4.6v3.2h3.6V10H33v8.5z"/>' +
      '<path class="d" d="M15.6 22h13.8M15 30h15" fill="none"/>',
    n: BASE +
      '<path d="M13 34c0-6.5 3.6-9.8 7-12.6-3 .2-5.8 1.6-8.2 3.2-1.6 1-3.2.1-2.8-1.6 1.4-5.2 6-10.4 10-12.4l.6-4.4 3.2 3.4c6.8.6 11.2 6.6 11.2 16.2V34z"/>' +
      '<circle class="e" cx="19" cy="15" r="1.4"/>' +
      '<path class="d" d="M27 11.5c2.6 2.4 4 6.4 4 11.5" fill="none"/>',
    b: BASE +
      '<path d="M15 34c.8-5.6 3-9.4 4.6-11.4h5.8c1.6 2 3.8 5.8 4.6 11.4z"/>' +
      '<path d="M22.5 7.5c-5.6 4.4-8 9.6-6 15.1h12c2-5.5-.4-10.7-6-15.1z"/>' +
      '<circle cx="22.5" cy="6" r="2.2"/>' +
      '<path class="d" d="M25.4 11.6l-4.4 5.2" fill="none"/>',
    q: BASE +
      '<path d="M13 34L10 16.5l6.6 8.6-.4-13 6.3 11 6.3-11-.4 13 6.6-8.6L32 34z"/>' +
      '<circle cx="10" cy="15" r="2.2"/><circle cx="16.2" cy="11" r="2.2"/><circle cx="22.5" cy="9.6" r="2.2"/>' +
      '<circle cx="28.8" cy="11" r="2.2"/><circle cx="35" cy="15" r="2.2"/>' +
      '<path class="d" d="M14 29.5h17" fill="none"/>',
    k: BASE +
      '<path d="M13 34c-.8-5.4-4-9-2.2-13.4 1.8-4.2 8-3.4 11.7 2.6 3.7-6 9.9-6.8 11.7-2.6 1.8 4.4-1.4 8-2.2 13.4z"/>' +
      '<path d="M22.5 22.6v-6" fill="none"/>' +
      '<path class="x" d="M22.5 5v10.5M18.2 9.4h8.6" fill="none"/>' +
      '<path class="d" d="M14 29.5h17" fill="none"/>'
  };

  // 全種類をまとめた SVG スプライトを一度だけ文書に入れ、<use> で参照する
  function injectSprite() {
    if (document.getElementById('piece-sprite')) return;
    const symbols = Object.keys(SHAPES).map((t) => `<symbol id="pc-${t}" viewBox="0 0 45 45">${SHAPES[t]}</symbol>`).join('');
    const holder = document.createElement('div');
    holder.innerHTML = `<svg id="piece-sprite" xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">${symbols}</svg>`;
    document.body.prepend(holder.firstChild);
  }

  // p: 'P','n' など。白は大文字
  function svg(p) {
    return `<svg class="piece-svg" viewBox="4 3 37 38.5" aria-hidden="true"><use href="#pc-${p.toLowerCase()}" x="0" y="0" width="45" height="45"/></svg>`;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectSprite);
  else injectSprite();

  window.Pieces = { svg, SHAPES };
})();
