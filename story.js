/* シンプルチェス: ストーリーモードのデータ（キャラクター・会話・顔イラスト） */
(function () {
  'use strict';

  // ---- 顔イラスト（SVG） ----
  // 話が進むほど枠の色・オーラ・目つきが強くなる
  const TIER = [
    null,
    { frame: '#c08a5a', aura: null },            // 1
    { frame: '#c08a5a', aura: null },            // 2
    { frame: '#c08a5a', aura: null },            // 3
    { frame: '#c9d1d8', aura: null },            // 4
    { frame: '#c9d1d8', aura: '#ffffff', n: 8 }, // 5
    { frame: '#c9d1d8', aura: '#ff8fb1', n: 10 },// 6
    { frame: '#f2c14e', aura: '#ffe14d', n: 12 },// 7
    { frame: '#f2c14e', aura: '#ff7a2f', n: 14 },// 8
    { frame: '#a77bff', aura: '#8a5cff', n: 16 },// 9
    { frame: '#ff3b5c', aura: '#ff1f4b', n: 20 } // 10
  ];

  let uid = 0;

  function spikes(n, r1, r2, color, opacity) {
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI * i) / n - Math.PI / 2;
      const r = i % 2 === 0 ? r2 : r1;
      d += (i ? 'L' : 'M') + (60 + Math.cos(a) * r).toFixed(1) + ' ' + (60 + Math.sin(a) * r).toFixed(1);
    }
    return `<path d="${d}Z" fill="${color}" opacity="${opacity}"/>`;
  }

  const EYES = {
    dot: (c) => `<circle cx="51" cy="60" r="3.6" fill="${c || '#2a2320'}"/><circle cx="69" cy="60" r="3.6" fill="${c || '#2a2320'}"/>
      <circle cx="52.2" cy="58.8" r="1.2" fill="#fff"/><circle cx="70.2" cy="58.8" r="1.2" fill="#fff"/>`,
    big: () => `<ellipse cx="50.5" cy="60" rx="4.6" ry="5.6" fill="#3a2350"/><ellipse cx="69.5" cy="60" rx="4.6" ry="5.6" fill="#3a2350"/>
      <circle cx="52" cy="58" r="1.8" fill="#fff"/><circle cx="71" cy="58" r="1.8" fill="#fff"/>`,
    calm: () => `<path d="M46 61q4.5 3 9 0M65 61q4.5 3 9 0" stroke="#3b2a20" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    sharp: (c) => `<path d="M45 54l11 3M75 54l-11 3" stroke="#2a1d16" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="51" cy="61" rx="3.4" ry="2.8" fill="${c || '#2a2320'}"/><ellipse cx="69" cy="61" rx="3.4" ry="2.8" fill="${c || '#2a2320'}"/>`,
    glow: (c) => `<g filter="url(#glow-ID)"><path d="M44.5 57.5l12 3.5-1 3.2-10-2.2zM75.5 57.5l-12 3.5 1 3.2 10-2.2z" fill="${c}"/></g>`
  };

  const MOUTH = {
    smile: '<path d="M54 69q6 5 12 0" stroke="#5a3226" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    open: '<path d="M53 68q7 9 14 0z" fill="#7a2f2f"/>',
    grin: '<path d="M52 68h16q-1 6-8 6t-8-6z" fill="#fff" stroke="#4a2a20" stroke-width="1.6"/>',
    flat: '<path d="M54 70h12" stroke="#3a2a22" stroke-width="2.2" stroke-linecap="round"/>',
    smirk: '<path d="M54 70q7 2 12-3" stroke="#5a2630" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    lips: '<path d="M55 69q5 3 10 0q-5 4-10 0z" fill="#c2184b" stroke="#c2184b" stroke-width="1.4"/>',
    fang: '<path d="M53 69q7 4 14 0" stroke="#3a1a22" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M56 70l1.5 3.5 1.5-3M61 70.6l1.5 3.5 1.5-3.4" fill="#fff"/>',
    none: ''
  };

  const BLUSH = '<ellipse cx="45" cy="66" rx="4" ry="2.4" fill="#ff7b9c" opacity=".45"/><ellipse cx="75" cy="66" rx="4" ry="2.4" fill="#ff7b9c" opacity=".45"/>';

  // 各キャラクターの見た目
  const LOOKS = {
    pipi: {
      bg: ['#e8f6ff', '#9fd3f5'], frame: '#ffffff',
      back: '<ellipse cx="30" cy="70" rx="14" ry="8" fill="#fff" opacity=".85" transform="rotate(-25 30 70)"/><ellipse cx="90" cy="70" rx="14" ry="8" fill="#fff" opacity=".85" transform="rotate(25 90 70)"/>',
      body: '<path d="M34 120q4-26 26-26t26 26z" fill="#ffffff"/>',
      head: '<path d="M44 36l-4-14 12 9zM76 36l4-14-12 9z" fill="#fff" stroke="#e3d6f0" stroke-width="1.5"/><ellipse cx="60" cy="60" rx="24" ry="25" fill="#fff"/><ellipse cx="60" cy="72" rx="13" ry="9" fill="#f6eefb"/>',
      hair: '<path d="M44 40q8-14 26-8q10 4 8 14q-8-8-18-6q-10 2-16 0z" fill="#ff9ccf"/>',
      eyes: 'big', mouth: 'smile', blush: true
    },
    s1: { // 見習いポーン兵 ポン吉
      bg: ['#e8ffe0', '#8fd18f'],
      body: '<path d="M30 120q2-24 30-24t30 24z" fill="#4f9a4f"/><path d="M52 96h16l-2 8h-12z" fill="#e3c55d"/>',
      head: '<circle cx="60" cy="60" r="23" fill="#ffd9b0"/>',
      hair: '<path d="M35 54q0-24 25-24t25 24q-12-6-25-6t-25 6z" fill="#4f9a4f"/><circle cx="60" cy="27" r="6" fill="#4f9a4f"/><rect x="36" y="51" width="48" height="5" rx="2.5" fill="#3d7d3d"/>',
      eyes: 'dot', mouth: 'smile', blush: true
    },
    s2: { // いたずら妖精 コロン
      bg: ['#fff0fb', '#f6a8e0'],
      back: '<path d="M38 66q-22-22-24 2q4 16 24 6zM82 66q22-22 24 2q-4 16-24 6z" fill="#cdf3ff" opacity=".85" stroke="#9adff5" stroke-width="1.5"/>',
      body: '<path d="M36 120q2-22 24-22t24 22z" fill="#ff8fd3"/>',
      head: '<circle cx="60" cy="61" r="22" fill="#ffe6f2"/>',
      hair: '<path d="M37 58q-2-24 23-24t23 24q-6-10-12-8q-4-8-11-4q-8-6-12 2q-7-2-11 10z" fill="#ffb84d"/><path d="M50 36q-6-14-12-16M70 36q6-14 12-16" stroke="#7a4b8f" stroke-width="2" fill="none"/><circle cx="38" cy="20" r="4" fill="#ffe14d"/><circle cx="82" cy="20" r="4" fill="#ffe14d"/>',
      eyes: 'big', mouth: 'open', blush: true
    },
    s3: { // 暴れ馬のナイト ウマノスケ
      bg: ['#fff3e0', '#e8a86a'],
      body: '<path d="M28 120q4-26 32-26t32 26z" fill="#7a5034"/><path d="M42 102h36v8H42z" fill="#c9a24a"/>',
      head: '<path d="M42 36l-3-14 10 8zM78 36l3-14-10 8z" fill="#a0663a"/><ellipse cx="60" cy="58" rx="22" ry="24" fill="#b4743f"/><ellipse cx="60" cy="74" rx="14" ry="10" fill="#e3b88a"/><circle cx="55" cy="75" r="1.6" fill="#5a3a22"/><circle cx="65" cy="75" r="1.6" fill="#5a3a22"/>',
      hair: '<path d="M48 36q4-10 12-12q8 2 12 12l-6 2-6-6-6 6z" fill="#3b2416"/>',
      eyes: 'sharp', mouth: 'none'
    },
    s4: { // 森の魔女ビショップ シスター・ビビ
      bg: ['#eef8e8', '#6fae7c'],
      body: '<path d="M28 120q4-26 32-26t32 26z" fill="#5b3f8f"/><path d="M57 96h6v24h-6z" fill="#e8d27a"/>',
      head: '<path d="M38 60q0 30 22 30t22-30q-4 30-22 34q-18-4-22-34z" fill="#3f8a5a"/><circle cx="60" cy="61" r="21" fill="#ffe6cc"/>',
      hair: '<path d="M38 56q0-20 22-20t22 20q-10-8-22-8t-22 8z" fill="#3f8a5a"/><path d="M42 44q2-30 18-36q16 6 18 36q-18-6-36 0z" fill="#6b4fa0"/><path d="M60 12l-5 16" stroke="#e8d27a" stroke-width="3"/><circle cx="60" cy="9" r="3" fill="#e8d27a"/>',
      eyes: 'calm', mouth: 'smirk'
    },
    s5: { // 岩の城壁ゴーレム ガンテツ
      bg: ['#eceff3', '#8d96a3'],
      body: '<path d="M22 120v-18q0-8 10-8h56q10 0 10 8v18z" fill="#6f7680"/><path d="M40 100h12v8H40zM62 104h14v8H62z" fill="#5c626b"/>',
      head: '<rect x="36" y="38" width="48" height="50" rx="8" fill="#9aa2ad"/><path d="M44 46l6 10-4 8M76 74l-6-6" stroke="#6f7680" stroke-width="2" fill="none"/>',
      hair: '<path d="M34 42V26h9v8h8v-8h10v8h8v-8h9v16z" fill="#8a929c"/>',
      eyes: 'glow', eyeColor: '#ff9a3c', mouth: 'flat'
    },
    s6: { // 茨の女王 ローザ
      bg: ['#ffe3ec', '#d6456e'],
      body: '<path d="M26 120q4-26 34-26t34 26z" fill="#a3123f"/><path d="M48 96l12 10 12-10" stroke="#ffd166" stroke-width="3" fill="none"/>',
      head: '<path d="M34 58q-2 36 10 40l4-30zM86 58q2 36-10 40l-4-30z" fill="#d6224f"/><circle cx="60" cy="61" r="21" fill="#ffeadf"/>',
      hair: '<path d="M38 60q-2-26 22-26t22 26q-6-14-22-14t-22 14z" fill="#d6224f"/><path d="M40 38l5-14 7 9 8-13 8 13 7-9 5 14z" fill="#ffc83d" stroke="#d99a1a" stroke-width="1.5"/><circle cx="52" cy="31" r="3" fill="#e0144a"/><circle cx="60" cy="27" r="3.4" fill="#e0144a"/><circle cx="68" cy="31" r="3" fill="#e0144a"/>',
      eyes: 'sharp', eyeColor: '#7a1033', mouth: 'lips'
    },
    s7: { // 雷の将軍 ボルト
      bg: ['#e6f0ff', '#3c64b4'],
      body: '<path d="M22 120q2-28 38-28t38 28z" fill="#3a4e7a"/><path d="M22 106q10-12 24-12v10q-14 0-24 8zM98 106q-10-12-24-12v10q14 0 24 8z" fill="#c7d1e3"/>',
      head: '<circle cx="60" cy="62" r="21" fill="#e9b98f"/><path d="M70 66l6 8" stroke="#a5532f" stroke-width="2"/>',
      hair: '<path d="M36 60q-2-28 24-28t24 28h-6q-2-16-18-16t-18 16z" fill="#c7d1e3"/><path d="M38 40L24 14l20 18zM82 40l14-26-20 18z" fill="#ffd400" stroke="#d9a400" stroke-width="1.5"/><path d="M60 30l-4 9h5l-3 9 8-12h-5l3-6z" fill="#ffd400"/>',
      eyes: 'sharp', mouth: 'grin'
    },
    s8: { // 竜騎士 ザイン
      bg: ['#ffe9d6', '#b8431d'],
      back: '<path d="M30 74Q6 52 10 26q12 18 28 22zM90 74q24-22 20-48q-12 18-28 22z" fill="#5a2a1a" stroke="#2e140b" stroke-width="2"/>',
      body: '<path d="M24 120q2-28 36-28t36 28z" fill="#2f5a3a"/><path d="M36 100l24 8 24-8v8l-24 8-24-8z" fill="#c9a24a"/>',
      head: '<circle cx="60" cy="63" r="20" fill="#e6b48a"/>',
      hair: '<path d="M36 64q-4-34 24-34t24 34h-6q0-10-6-12h-24q-6 2-6 12z" fill="#2f5a3a"/><path d="M40 40L28 18l18 14zM80 40l12-22-18 14z" fill="#e8e0c8" stroke="#8f8566" stroke-width="1.5"/><path d="M48 52h24l-12 6z" fill="#22432a"/>',
      eyes: 'glow', eyeColor: '#ffb020', mouth: 'flat'
    },
    s9: { // 影の魔導士 ゼロ
      bg: ['#2b2140', '#120a22'],
      back: '<circle cx="60" cy="60" r="44" fill="none" stroke="#8a5cff" stroke-width="1.5" stroke-dasharray="3 5" opacity=".8"/>',
      body: '<path d="M22 120q4-34 38-34t38 34z" fill="#2a1f45"/>',
      head: '<path d="M32 88q-4-56 28-58q32 2 28 58q-12-10-28-10t-28 10z" fill="#3a2c62"/><ellipse cx="60" cy="64" rx="18" ry="20" fill="#0b0716"/>',
      hair: '<path d="M60 30q-6 10 0 18q6-8 0-18z" fill="#8a5cff" opacity=".8"/>',
      eyes: 'glow', eyeColor: '#43f0ff', mouth: 'none'
    },
    s10: { // 黒の帝王 ノワール
      bg: ['#2a0710', '#050104'],
      back: '<path d="M18 120Q14 70 34 60l26 30 26-30q20 10 16 60z" fill="#3a0612"/><path d="M30 96q-8-30 6-40l8 26zM90 96q8-30-6-40l-8 26z" fill="#1a0207" stroke="#ff2a4f" stroke-width="1"/>',
      body: '<path d="M26 120q4-28 34-28t34 28z" fill="#140208"/><path d="M50 94l10 14 10-14" stroke="#ff2a4f" stroke-width="2.5" fill="none"/>',
      head: '<path d="M36 58q-4 38 8 44l4-34zM84 58q4 38-8 44l-4-34z" fill="#cfd3dc"/><circle cx="60" cy="62" r="20" fill="#f0e6ea"/>',
      hair: '<path d="M38 62q-2-26 22-26t22 26q-8-14-22-14t-22 14z" fill="#cfd3dc"/><path d="M36 44L32 14l12 14 8-20 8 16 8-16 8 20 12-14-4 30z" fill="#16060b" stroke="#ff2a4f" stroke-width="1.6"/><circle cx="60" cy="30" r="4" fill="#ff1f4b"/><circle cx="45" cy="34" r="2.6" fill="#ff1f4b"/><circle cx="75" cy="34" r="2.6" fill="#ff1f4b"/>',
      eyes: 'glow', eyeColor: '#ff2a4f', mouth: 'smirk'
    },
    noirKind: { // 影が晴れたノワール
      bg: ['#fff4e0', '#f2c14e'], frame: '#ffffff',
      body: '<path d="M30 120q4-26 30-26t30 26z" fill="#3a3f5a"/>',
      head: '<circle cx="60" cy="62" r="20" fill="#ffe9dc"/>',
      hair: '<path d="M38 62q-2-26 22-26t22 26q-8-14-22-14t-22 14z" fill="#d8dbe3"/><path d="M48 40l2-10 5 6 5-8 5 8 5-6 2 10z" fill="#ffc83d"/>',
      eyes: 'dot', mouth: 'smile', blush: true
    }
  };

  function avatar(key, stage) {
    const L = LOOKS[key];
    const t = TIER[stage || 0] || { frame: L.frame || '#fff', aura: null };
    const id = 'av' + (++uid);
    const eyes = EYES[L.eyes](L.eyeColor).replace(/ID/g, id);
    const aura = t.aura ? spikes(t.n, 44, 58, t.aura, 0.35) + spikes(t.n, 40, 50, t.aura, 0.35) : '';
    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="bg-${id}" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="${L.bg[0]}"/><stop offset="1" stop-color="${L.bg[1]}"/></radialGradient>
        <clipPath id="clip-${id}"><circle cx="60" cy="60" r="56"/></clipPath>
        <filter id="glow-${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx="60" cy="60" r="56" fill="url(#bg-${id})"/>
      <g clip-path="url(#clip-${id})">
        ${aura}${L.back || ''}${L.body}${L.head}${L.hair}${eyes}${MOUTH[L.mouth]}${L.blush ? BLUSH : ''}
      </g>
      <circle cx="60" cy="60" r="56" fill="none" stroke="${t.frame}" stroke-width="5"/>
      ${stage >= 7 ? `<circle cx="60" cy="60" r="52" fill="none" stroke="${t.frame}" stroke-width="1" opacity=".6"/>` : ''}
    </svg>`;
  }

  // ---- キャラクターと会話 ----
  // 話者: n = ナレーション, p = ピピ, me = きみ, e = その話の相手, k = 影が晴れたノワール
  const PIPI = { name: 'ピピ', look: 'pipi' };

  const PROLOGUE = [
    ['n', '放課後。きみは物置で、ほこりをかぶった古いチェス盤を見つけた。'],
    ['n', '駒をひとつ置いたその瞬間――盤がまぶしく光って、きみの体はふわりと吸いこまれた！'],
    ['p', 'やったぁ！ 本当に来てくれたんだね！'],
    ['me', 'うわっ、しゃべる……子馬？'],
    ['p', 'ボクはピピ。ここは盤の上の国「チェッカリア」だよ。'],
    ['p', 'でも今、国は大ピンチなんだ。「黒の帝王ノワール」が、世界から色をうばっていってるの。'],
    ['n', '見わたすと、空も森も、少しずつ灰色にしずんでいく。'],
    ['p', '帝王がいるのは「影の塔」のてっぺん。塔には10人の守り手がいて、みんな影にあやつられてる。'],
    ['p', 'この国では、チェスで勝てば影が晴れるんだ。おねがい、ボクといっしょに塔をのぼって！'],
    ['me', '……わかった。やってみる！'],
    ['p', 'ありがとう！ じゃあ出発だ！ 最初の相手は塔の入口にいるよ。']
  ];

  const STAGES = [
    {
      name: 'ポン吉', title: '見習いポーン兵', where: '影の塔 入口',
      intro: [
        ['n', '影の塔の入口。小さな兵士が、やりを持って通せんぼしている。'],
        ['e', 'ストーップ！ ここを通りたければ、オイラにチェスで勝ってみな！'],
        ['p', 'あの子、目がちょっと灰色だ。影にあやつられてるんだよ。'],
        ['e', 'オイラだって毎日練習してるんだ。……えっと、ナイトってどう動くんだっけ？'],
        ['me', '（だ、大丈夫かな……）'],
        ['p', '最初の勝負だね。落ち着いていこう！']
      ],
      outro: [
        ['e', 'うわぁ、まいった！ きみ、強いなぁ！'],
        ['n', 'ポン吉の目から灰色が消えて、ほっぺに赤みがもどった。'],
        ['e', 'あれ？ オイラ、なんでこんなところに……。そうか、影にあやつられてたんだ。'],
        ['e', 'ありがとう！ ポーンは一歩ずつしか進めないけど、一番奥までたどり着けばクイーンにだってなれるんだ。'],
        ['e', 'きみも一歩ずつ、てっぺんを目指してね！'],
        ['p', 'いいこと言うね、ポン吉！ さあ、次の階へ行こう！']
      ],
      lose: 'へへーん！ 一歩ずつ出直してきな！',
      check: 'チェックだぞー！ ……あってるよね？'
    },
    {
      name: 'コロン', title: 'いたずら妖精', where: '影の塔 1階',
      intro: [
        ['n', '階段をのぼると、きらきらした粉がまい落ちてきた。'],
        ['e', 'キャハハ！ 新しいオモチャがきた～！'],
        ['p', '気をつけて！ いたずら妖精のコロンだ！'],
        ['e', 'ねぇねぇ、アタシと遊ぼ？ 負けたら、きみの駒ぜーんぶ隠しちゃうから！'],
        ['me', 'それは困る……！ 負けないよ！']
      ],
      outro: [
        ['e', 'ちぇーっ、負けちゃった！ つまんないのー！'],
        ['n', 'コロンの羽が、灰色から虹色にかがやきはじめた。'],
        ['e', '……でもね、ほんとはすっごく楽しかった。影の中にいる間、ずーっとひとりだったから。'],
        ['e', 'これあげる！ 「光のかけら」。帝王の影を晴らすのに、きっと役に立つよ！'],
        ['p', 'ありがとう、コロン！'],
        ['e', 'また遊んでね！ 約束だよー！']
      ],
      lose: 'キャハハ！ 駒はぜーんぶ没収～！',
      check: 'チェーック！ びっくりした？'
    },
    {
      name: 'ウマノスケ', title: '暴れ馬のナイト', where: '影の塔 2階',
      intro: [
        ['n', 'ドドドッ！ 地面がゆれて、鎧をつけた馬の騎士が飛びこんできた。'],
        ['e', 'ヒヒーン！ オレ様はウマノスケ！ この階で一番速い男よ！'],
        ['e', 'オレ様のジャンプについてこられるかな？'],
        ['p', 'ナイトはL字に動いて、ほかの駒を飛びこえられるんだ。どこから来るか、よく見てね！'],
        ['me', 'よし、ナイトの動きに注意だ！']
      ],
      outro: [
        ['e', 'ブルルッ……オレ様のジャンプが、読まれていただと……！？'],
        ['n', 'ウマノスケの鎧から、黒いもやがすうっと消えていった。'],
        ['e', 'いやぁ、すっきりした！ 影のせいで、ずっと頭がモヤモヤしてたんだ。'],
        ['e', '仲間を飛びこえられるのは、ナイトだけの特技さ。きみもピンチのときは、思いきってジャンプしてみな！'],
        ['p', 'ありがとう、ウマノスケ！ 次はもっと上の階だよ。']
      ],
      lose: 'ヒヒーン！ オレ様の勝ちだ！ 出直してきな！',
      check: 'ジャンプでチェックだ！ ヒヒーン！'
    },
    {
      name: 'シスター・ビビ', title: '森の魔女ビショップ', where: '影の塔 3階',
      intro: [
        ['n', '3階は、なぜか森になっていた。木々のあいだに、背の高い帽子の魔女が立っている。'],
        ['e', 'あらあら、かわいいお客さま。わたくし、まっすぐな道は信じないの。'],
        ['e', '信じるのは、ななめの道だけ。ふふふ……。'],
        ['p', 'ビショップはななめに、どこまでも進める。遠くからねらわれないよう気をつけて！'],
        ['me', 'ななめのラインだね。わかった！']
      ],
      outro: [
        ['e', 'まあ……。ななめの道まで、ぜんぶお見通しだったのね。'],
        ['n', '灰色だった森に、緑の色がもどっていく。'],
        ['e', 'ありがとう。ひとつ、教えてあげるわ。'],
        ['e', 'わたくしが影にのまれる前……塔の上から、帝王の声が聞こえたの。'],
        ['e', '「なぜ、だれも来てくれないのだ」って。とてもさみしそうな声だったわ。'],
        ['me', '帝王が……さみしそう？'],
        ['p', 'どういうことだろう……。とにかく、上を目指そう！']
      ],
      lose: 'ふふふ。ななめの道は、まだ早かったようね。',
      check: 'ななめから、チェックよ。ふふふ。'
    },
    {
      name: 'ガンテツ', title: '岩の城壁ゴーレム', where: '影の塔 4階',
      intro: [
        ['n', 'ズシン……ズシン……。重い足音とともに、岩でできた巨人が現れた。'],
        ['e', '…………ここは……通さぬ……。'],
        ['p', 'うわぁ、大きい！ ルークの力を持つゴーレム、ガンテツだ！'],
        ['p', 'ルークはたてと横にまっすぐ、どこまでも進める。あいた列には要注意！'],
        ['me', '大きくたって、こわくない！'],
        ['n', 'ガンテツの体から、白い光がもれだした。ここから先の相手は、本気だ。']
      ],
      outro: [
        ['e', '…………まいった……。'],
        ['n', 'ガンテツの目の光が、こわいオレンジから、あたたかい黄色に変わった。'],
        ['e', '……ありがとう……。長い……長い夢を……見ていた……。'],
        ['e', '……ここで塔の半分だ……。この先の守り手は……もっと強い……。'],
        ['e', '……だが……おまえなら……行ける……。'],
        ['p', 'ガンテツ、ありがとう！ いよいよ後半戦だ！']
      ],
      lose: '…………出直せ……。',
      check: '…………チェック……。'
    },
    {
      name: 'ローザ', title: '茨の女王クイーン', where: '影の塔 5階',
      intro: [
        ['n', 'バラの香り。部屋いっぱいに、黒いイバラが広がっている。'],
        ['e', 'わたくしの庭に土足で入るなんて、美しくないわね。'],
        ['e', 'わたくしは女王ローザ。盤上で一番強い駒は、だれだか知っていて？'],
        ['p', 'クイーンだ……！ たて、横、ななめ、どこへでも動ける最強の駒だよ。'],
        ['me', 'でも、こっちには仲間の駒がいる！'],
        ['e', 'あら、言うじゃない。では見せてちょうだい。']
      ],
      outro: [
        ['e', '……負けたのね、このわたくしが。'],
        ['n', '黒いイバラが、赤いバラの花へと変わっていく。'],
        ['e', 'ふふ……クイーンはたしかに一番強い駒。でもね、一人きりで戦っても勝てないの。'],
        ['e', 'あなたの駒たちは、みんなで支え合っていた。それが、あなたの強さよ。'],
        ['e', '帝王にも……そういう仲間がいれば、よかったのにね。'],
        ['p', 'ローザ……帝王のこと、何か知ってるの？'],
        ['e', '上に行けばわかるわ。さあ、行きなさい。']
      ],
      lose: 'おーほっほ！ 出直してらっしゃい！',
      check: 'チェックよ。美しいでしょう？'
    },
    {
      name: 'ボルト', title: '雷の将軍', where: '影の塔 6階',
      intro: [
        ['n', 'ゴロゴロ……ピシャーン！ 部屋に雷が落ちた。'],
        ['e', 'ガッハッハ！ よくぞここまで来た、ちびっこ！'],
        ['e', 'ワシは雷の将軍ボルト！ 戦はスピードが命じゃ！'],
        ['p', 'この人はこれまでの相手とちがう。先の先まで読んでくるよ！'],
        ['me', 'あせらず、相手のねらいを考えよう。'],
        ['e', 'ほう、良い目をしておる。ならば全力でいくぞ！']
      ],
      outro: [
        ['e', 'ぐぬぬ……雷より速い一手じゃった……！'],
        ['n', 'ボルトの鎧から黒いいなずまが抜けて、空に消えた。'],
        ['e', 'ガッハッハ！ 負けたというのに、なんとも気持ちがいい！'],
        ['e', '昔話をしてやろう。黒の帝王ノワールはな、かつてこの国一番のチャンピオンだったのじゃ。'],
        ['me', 'チャンピオン？'],
        ['e', 'うむ。だれよりも強く、だれよりもチェスを愛しておった。……だが、ある日を境に、姿を消したのじゃ。'],
        ['p', 'そんな過去があったなんて……。']
      ],
      lose: 'ガッハッハ！ まだまだ修行が足りんのう！',
      check: 'ピシャーン！ 雷のチェックじゃ！'
    },
    {
      name: 'ザイン', title: '竜騎士', where: '影の塔 7階',
      intro: [
        ['n', '強い風。巨大な翼を広げた竜騎士が、行く手をふさいでいる。'],
        ['e', '我が名はザイン。帝王さまに仕える竜騎士だ。'],
        ['e', 'ここまで来たことはほめてやろう。だが、我が竜の炎は止められぬ。'],
        ['p', 'す、すごいオーラ……！ でも、ここまで来たきみなら大丈夫！'],
        ['me', 'いくぞ！']
      ],
      outro: [
        ['e', '……見事だ。我が炎を、正面から打ち破るとは。'],
        ['n', 'ザインのかぶとから、暗いほのおが消えていく。'],
        ['e', '帝王さまはあまりに強すぎた。挑む者はみな負け、やがてだれも挑まなくなった。'],
        ['e', '勝負の相手がいない王は、ずっと一人で盤に向かっておられた……。'],
        ['me', 'だから、さみしくて……。'],
        ['e', '頼む。帝王さまを、救ってさしあげてくれ。']
      ],
      lose: '我が炎の前では、まだ力不足だ。',
      check: '竜の炎よ、王をつらぬけ！ チェック！'
    },
    {
      name: 'ゼロ', title: '影の魔導士', where: '影の塔 8階',
      intro: [
        ['n', '真っ暗な部屋。青く光る目だけが、こちらを見つめている。'],
        ['e', '……ようこそ。私は影の魔導士ゼロ。帝王さまの右腕だ。'],
        ['e', '国から色をうばう魔法をかけたのは、この私だ。'],
        ['p', 'こいつが……！'],
        ['e', '帝王さまの望みのためなら、私は何でもする。邪魔はさせない。'],
        ['me', '帝王に会わなくちゃいけないんだ。そこをどいて！']
      ],
      outro: [
        ['e', '……私の負けだ。'],
        ['n', '部屋をおおっていた影が、ゆっくりと晴れていく。'],
        ['e', '帝王さまは言った。「世界が灰色なら、だれも私をうらやまない。私と同じになる」と。'],
        ['e', 'だが……本当は、待っておられたのかもしれない。本気で勝負できる相手を。'],
        ['e', 'きみのような相手を。'],
        ['p', '次が最上階……帝王の部屋だ。'],
        ['me', '行こう、ピピ。']
      ],
      lose: '影にのまれて、出直すがいい。',
      check: '影よ、王をしばれ。チェック。'
    },
    {
      name: 'ノワール', title: '黒の帝王', where: '影の塔 最上階',
      intro: [
        ['n', '塔のてっぺん。灰色の玉座に、黒い王冠をかぶった帝王が座っていた。'],
        ['e', '……よく来た。この部屋に客が来るのは、何百年ぶりだろうな。'],
        ['e', '私は強すぎた。だれも私に勝てず、やがてだれも、私と遊ばなくなった。'],
        ['e', 'だから世界から色をうばった。みんな、私と同じ灰色になればいい。'],
        ['me', 'そんなの、まちがってる！'],
        ['p', 'みんな、きみが楽しくチェスをしていたころを覚えてるよ！'],
        ['e', '……ならば、盤の上で証明してみせよ。'],
        ['e', '最後の勝負だ。私の全力を、受けてみるがいい！']
      ],
      outro: [
        ['e', '……負けた、のか。この私が。'],
        ['n', '帝王の体から、真っ黒な影がほどけるように消えていく。'],
        ['n', 'そこに立っていたのは、きみと同じくらいの年の、銀色の髪の少年だった。'],
        ['k', '……ふしぎだ。負けたのに、胸があたたかい。'],
        ['k', 'こんなに楽しい勝負は、ひさしぶりだった。'],
        ['me', 'すっごく楽しかったよ！'],
        ['k', '……また、遊んでくれるか？'],
        ['me', 'もちろん！ 何回だって！'],
        ['n', 'その瞬間、塔の窓から光があふれ出した。']
      ],
      lose: 'まだだ。私を楽しませるには、まだ足りぬ。',
      check: 'チェック。……さあ、どうする？'
    }
  ];

  const ENDING = [
    ['n', '空に青が、森に緑が、花に赤がもどっていく。チェッカリアに、色が帰ってきた。'],
    ['p', 'やったぁ！ 国が元にもどったよ！ 本当にありがとう！'],
    ['n', '塔の下では、ポン吉が、コロンが、ウマノスケが……今まで戦ったみんなが、手をふっていた。'],
    ['k', 'きみが来てくれなかったら、私はずっと一人だった。ありがとう。'],
    ['p', '……そろそろ、元の世界に帰る時間みたい。'],
    ['me', 'また来られるかな？'],
    ['p', 'もちろん！ チェス盤があれば、いつでもつながってるよ。'],
    ['n', '光につつまれて――気がつくと、きみは物置にいた。'],
    ['n', 'チェス盤の上には、見覚えのない小さな黒いキングの駒がひとつ。'],
    ['n', 'その駒は、ほんの少しだけ、笑っているように見えた。'],
    ['n', '～ おしまい ～　全10話クリア、おめでとう！']
  ];

  window.Story = { STAGES, PROLOGUE, ENDING, PIPI, avatar };
})();
