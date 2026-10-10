/* シンプルチェス: ルールエンジン（盤面・合法手生成・終局判定）
 * 盤面インデックス: 0 = a8, 7 = h8, 56 = a1, 63 = h1
 * 駒: 大文字 = 白 (PNBRQK), 小文字 = 黒 (pnbrqk)
 * メインスレッドと Web Worker の両方から読み込まれる。
 */
(function (root) {
  'use strict';

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const FILES = 'abcdefgh';
  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  // キャスリング権: 1 = 白キング側, 2 = 白クイーン側, 4 = 黒キング側, 8 = 黒クイーン側
  const CASTLE_MASK = new Array(64).fill(15);
  CASTLE_MASK[0] = 15 & ~8;
  CASTLE_MASK[4] = 15 & ~12;
  CASTLE_MASK[7] = 15 & ~4;
  CASTLE_MASK[56] = 15 & ~2;
  CASTLE_MASK[60] = 15 & ~3;
  CASTLE_MASK[63] = 15 & ~1;

  // ゾブリストハッシュ（千日手判定用）。2つの32bit値で衝突をほぼ無くす。
  const PIECE_INDEX = { P: 0, N: 1, B: 2, R: 3, Q: 4, K: 5, p: 6, n: 7, b: 8, r: 9, q: 10, k: 11 };
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) >>> 0;
    };
  }
  function makeZobrist(seed) {
    const rnd = mulberry32(seed);
    const z = { piece: [], castle: [], ep: [], side: rnd() };
    for (let i = 0; i < 12 * 64; i++) z.piece.push(rnd());
    for (let i = 0; i < 16; i++) z.castle.push(rnd());
    for (let i = 0; i < 8; i++) z.ep.push(rnd());
    return z;
  }
  const Z1 = makeZobrist(0x1234567);
  const Z2 = makeZobrist(0x7654321);

  function colorOf(p) { return p ? (p < 'a' ? 'w' : 'b') : null; }
  function sqName(i) { return FILES[i & 7] + (8 - (i >> 3)); }
  function sqIndex(name) { return (8 - parseInt(name[1], 10)) * 8 + FILES.indexOf(name[0]); }
  function other(color) { return color === 'w' ? 'b' : 'w'; }

  class Chess {
    constructor(fen) { this.load(fen || START_FEN); }

    load(fen) {
      const parts = fen.trim().split(/\s+/);
      this.board = new Array(64).fill(null);
      this.kings = { w: -1, b: -1 };
      let i = 0;
      for (const ch of parts[0]) {
        if (ch === '/') continue;
        if (ch >= '1' && ch <= '8') { i += +ch; continue; }
        this.board[i] = ch;
        if (ch === 'K') this.kings.w = i;
        if (ch === 'k') this.kings.b = i;
        i++;
      }
      this.turn = parts[1] === 'b' ? 'b' : 'w';
      const c = parts[2] || '-';
      this.castling = (c.includes('K') ? 1 : 0) | (c.includes('Q') ? 2 : 0) |
        (c.includes('k') ? 4 : 0) | (c.includes('q') ? 8 : 0);
      this.ep = parts[3] && parts[3] !== '-' ? sqIndex(parts[3]) : -1;
      this.halfmove = parseInt(parts[4] || '0', 10);
      this.fullmove = parseInt(parts[5] || '1', 10);
      this.stack = [];
      this.computeHash();
      this.keys = [this.key()];
    }

    computeHash() {
      let h1 = 0, h2 = 0;
      for (let i = 0; i < 64; i++) {
        const p = this.board[i];
        if (!p) continue;
        const k = PIECE_INDEX[p] * 64 + i;
        h1 ^= Z1.piece[k]; h2 ^= Z2.piece[k];
      }
      h1 ^= Z1.castle[this.castling]; h2 ^= Z2.castle[this.castling];
      if (this.ep >= 0) { h1 ^= Z1.ep[this.ep & 7]; h2 ^= Z2.ep[this.ep & 7]; }
      if (this.turn === 'b') { h1 ^= Z1.side; h2 ^= Z2.side; }
      this.h1 = h1 >>> 0; this.h2 = h2 >>> 0;
    }

    key() { return this.h1 * 2097152 + (this.h2 & 0x1FFFFF); }

    fen() {
      let s = '';
      for (let r = 0; r < 8; r++) {
        let empty = 0;
        for (let c = 0; c < 8; c++) {
          const p = this.board[r * 8 + c];
          if (!p) { empty++; continue; }
          if (empty) { s += empty; empty = 0; }
          s += p;
        }
        if (empty) s += empty;
        if (r < 7) s += '/';
      }
      let cs = '';
      if (this.castling & 1) cs += 'K';
      if (this.castling & 2) cs += 'Q';
      if (this.castling & 4) cs += 'k';
      if (this.castling & 8) cs += 'q';
      return [s, this.turn, cs || '-', this.ep >= 0 ? sqName(this.ep) : '-', this.halfmove, this.fullmove].join(' ');
    }

    // --- 利き判定 ---
    isAttacked(sq, by) {
      const b = this.board, r = sq >> 3, c = sq & 7;
      if (by === 'w') {
        if (r < 7) {
          if (c > 0 && b[sq + 7] === 'P') return true;
          if (c < 7 && b[sq + 9] === 'P') return true;
        }
      } else if (r > 0) {
        if (c > 0 && b[sq - 9] === 'p') return true;
        if (c < 7 && b[sq - 7] === 'p') return true;
      }
      const w = by === 'w';
      const N = w ? 'N' : 'n', K = w ? 'K' : 'k', B = w ? 'B' : 'b', R = w ? 'R' : 'r', Q = w ? 'Q' : 'q';
      for (const [dr, dc] of KNIGHT) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === N) return true;
      }
      for (const [dr, dc] of KING) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === K) return true;
      }
      for (const [dr, dc] of ROOK_DIRS) {
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
          const p = b[rr * 8 + cc];
          if (p) { if (p === R || p === Q) return true; break; }
          rr += dr; cc += dc;
        }
      }
      for (const [dr, dc] of BISHOP_DIRS) {
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
          const p = b[rr * 8 + cc];
          if (p) { if (p === B || p === Q) return true; break; }
          rr += dr; cc += dc;
        }
      }
      return false;
    }

    inCheck(color) {
      const c = color || this.turn;
      return this.isAttacked(this.kings[c], other(c));
    }

    // --- 擬似合法手の生成 ---
    // flag: 'n' 通常, 'b' 2マス前進, 'e' アンパッサン, 'k' キング側キャスリング, 'q' クイーン側キャスリング
    pseudoMoves(capturesOnly) {
      const moves = [], b = this.board, us = this.turn, them = other(us);
      const add = (from, to, piece, captured, flag, promo) =>
        moves.push({ from, to, piece, captured: captured || null, flag: flag || 'n', promo: promo || null });

      for (let i = 0; i < 64; i++) {
        const p = b[i];
        if (!p || colorOf(p) !== us) continue;
        const r = i >> 3, c = i & 7, t = p.toLowerCase();

        if (t === 'p') {
          const dir = us === 'w' ? -1 : 1;
          const startRow = us === 'w' ? 6 : 1;
          const promoRow = us === 'w' ? 0 : 7;
          const promos = us === 'w' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];
          const r1 = r + dir;
          const addPawn = (to, captured, flag) => {
            if (r1 === promoRow) for (const pr of promos) add(i, to, p, captured, flag, pr);
            else add(i, to, p, captured, flag);
          };
          const f1 = r1 * 8 + c;
          if (!b[f1]) {
            if (!capturesOnly || r1 === promoRow) addPawn(f1, null, 'n');
            if (!capturesOnly && r === startRow && !b[f1 + dir * 8]) add(i, f1 + dir * 8, p, null, 'b');
          }
          for (const dc of [-1, 1]) {
            const cc = c + dc;
            if (cc < 0 || cc > 7) continue;
            const to = r1 * 8 + cc, target = b[to];
            if (target && colorOf(target) === them) addPawn(to, target, 'n');
            else if (to === this.ep) add(i, to, p, us === 'w' ? 'p' : 'P', 'e');
          }
          continue;
        }

        if (t === 'n' || t === 'k') {
          for (const [dr, dc] of (t === 'n' ? KNIGHT : KING)) {
            const rr = r + dr, cc = c + dc;
            if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
            const to = rr * 8 + cc, target = b[to];
            if (!target) { if (!capturesOnly) add(i, to, p); }
            else if (colorOf(target) === them) add(i, to, p, target);
          }
          continue;
        }

        const dirs = t === 'r' ? ROOK_DIRS : t === 'b' ? BISHOP_DIRS : KING;
        for (const [dr, dc] of dirs) {
          let rr = r + dr, cc = c + dc;
          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
            const to = rr * 8 + cc, target = b[to];
            if (!target) { if (!capturesOnly) add(i, to, p); }
            else { if (colorOf(target) === them) add(i, to, p, target); break; }
            rr += dr; cc += dc;
          }
        }
      }

      if (!capturesOnly) {
        if (us === 'w') {
          if ((this.castling & 1) && !b[61] && !b[62] && b[63] === 'R' &&
            !this.isAttacked(60, 'b') && !this.isAttacked(61, 'b') && !this.isAttacked(62, 'b')) add(60, 62, 'K', null, 'k');
          if ((this.castling & 2) && !b[59] && !b[58] && !b[57] && b[56] === 'R' &&
            !this.isAttacked(60, 'b') && !this.isAttacked(59, 'b') && !this.isAttacked(58, 'b')) add(60, 58, 'K', null, 'q');
        } else {
          if ((this.castling & 4) && !b[5] && !b[6] && b[7] === 'r' &&
            !this.isAttacked(4, 'w') && !this.isAttacked(5, 'w') && !this.isAttacked(6, 'w')) add(4, 6, 'k', null, 'k');
          if ((this.castling & 8) && !b[3] && !b[2] && !b[1] && b[0] === 'r' &&
            !this.isAttacked(4, 'w') && !this.isAttacked(3, 'w') && !this.isAttacked(2, 'w')) add(4, 2, 'k', null, 'q');
        }
      }
      return moves;
    }

    // 合法手（自玉が取られる手を除外）
    moves(capturesOnly) {
      const us = this.turn, them = other(us), legal = [];
      for (const m of this.pseudoMoves(capturesOnly)) {
        this.makeMove(m);
        if (!this.isAttacked(this.kings[us], them)) legal.push(m);
        this.undo();
      }
      return legal;
    }

    movesFrom(sq) { return this.moves().filter(m => m.from === sq); }

    xorPiece(p, sq) {
      const k = PIECE_INDEX[p] * 64 + sq;
      this.h1 ^= Z1.piece[k]; this.h2 ^= Z2.piece[k];
    }

    makeMove(m) {
      const b = this.board, us = this.turn;
      this.stack.push({
        m, castling: this.castling, ep: this.ep, halfmove: this.halfmove,
        fullmove: this.fullmove, h1: this.h1, h2: this.h2
      });
      this.h1 ^= Z1.castle[this.castling]; this.h2 ^= Z2.castle[this.castling];
      if (this.ep >= 0) { this.h1 ^= Z1.ep[this.ep & 7]; this.h2 ^= Z2.ep[this.ep & 7]; }

      b[m.from] = null;
      this.xorPiece(m.piece, m.from);
      if (m.captured) {
        const capSq = m.flag === 'e' ? m.to + (us === 'w' ? 8 : -8) : m.to;
        b[capSq] = null;
        this.xorPiece(m.captured, capSq);
      }
      const placed = m.promo || m.piece;
      b[m.to] = placed;
      this.xorPiece(placed, m.to);

      if (m.piece === 'K' || m.piece === 'k') this.kings[us] = m.to;
      if (m.flag === 'k' || m.flag === 'q') {
        const rf = m.flag === 'k' ? m.to + 1 : m.to - 2;
        const rt = m.flag === 'k' ? m.to - 1 : m.to + 1;
        const rook = b[rf];
        b[rt] = rook; b[rf] = null;
        this.xorPiece(rook, rf); this.xorPiece(rook, rt);
      }

      this.castling &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
      this.ep = m.flag === 'b' ? (m.from + m.to) >> 1 : -1;
      this.halfmove = (m.piece === 'P' || m.piece === 'p' || m.captured) ? 0 : this.halfmove + 1;
      if (us === 'b') this.fullmove++;
      this.turn = other(us);

      this.h1 ^= Z1.castle[this.castling] ^ Z1.side; this.h2 ^= Z2.castle[this.castling] ^ Z2.side;
      if (this.ep >= 0) { this.h1 ^= Z1.ep[this.ep & 7]; this.h2 ^= Z2.ep[this.ep & 7]; }
      this.h1 >>>= 0; this.h2 >>>= 0;
      this.keys.push(this.key());
    }

    // 探索用の「パス」（手番だけを相手に渡す）。undoNull で戻す
    makeNull() {
      this.stack.push({
        m: null, castling: this.castling, ep: this.ep, halfmove: this.halfmove,
        fullmove: this.fullmove, h1: this.h1, h2: this.h2
      });
      if (this.ep >= 0) { this.h1 ^= Z1.ep[this.ep & 7]; this.h2 ^= Z2.ep[this.ep & 7]; }
      this.h1 = (this.h1 ^ Z1.side) >>> 0; this.h2 = (this.h2 ^ Z2.side) >>> 0;
      this.ep = -1;
      this.halfmove = 0; // パスをまたいだ千日手判定をしない
      this.turn = other(this.turn);
      this.keys.push(this.key());
    }

    undoNull() {
      const st = this.stack.pop();
      this.turn = other(this.turn);
      this.castling = st.castling; this.ep = st.ep; this.halfmove = st.halfmove;
      this.fullmove = st.fullmove; this.h1 = st.h1; this.h2 = st.h2;
      this.keys.pop();
    }

    undo() {
      const st = this.stack.pop();
      if (!st) return null;
      const m = st.m, b = this.board;
      this.turn = other(this.turn);
      const us = this.turn;
      b[m.to] = null;
      b[m.from] = m.piece;
      if (m.captured) b[m.flag === 'e' ? m.to + (us === 'w' ? 8 : -8) : m.to] = m.captured;
      if (m.flag === 'k' || m.flag === 'q') {
        const rf = m.flag === 'k' ? m.to + 1 : m.to - 2;
        const rt = m.flag === 'k' ? m.to - 1 : m.to + 1;
        b[rf] = b[rt]; b[rt] = null;
      }
      if (m.piece === 'K' || m.piece === 'k') this.kings[us] = m.from;
      this.castling = st.castling; this.ep = st.ep; this.halfmove = st.halfmove;
      this.fullmove = st.fullmove; this.h1 = st.h1; this.h2 = st.h2;
      this.keys.pop();
      return m;
    }

    // 直前の局面が過去（取り返しのつかない手の後）に出現したか
    isRepeated(times) {
      const keys = this.keys, n = keys.length, k = keys[n - 1];
      let count = 1;
      const limit = Math.max(0, n - 1 - this.halfmove);
      for (let i = n - 3; i >= limit; i -= 2) {
        if (keys[i] === k && ++count >= times) return true;
      }
      return false;
    }

    insufficientMaterial() {
      const pieces = [];
      for (let i = 0; i < 64; i++) {
        const p = this.board[i];
        if (p && p !== 'K' && p !== 'k') pieces.push([p.toLowerCase(), i]);
      }
      if (pieces.length === 0) return true;
      if (pieces.length === 1 && (pieces[0][0] === 'n' || pieces[0][0] === 'b')) return true;
      if (pieces.every(([t]) => t === 'b')) {
        const shade = ([, i]) => ((i >> 3) + (i & 7)) & 1;
        const s = shade(pieces[0]);
        return pieces.every(x => shade(x) === s);
      }
      return false;
    }

    // 終局状態: { over, reason, winner }
    status() {
      const legal = this.moves();
      if (legal.length === 0) {
        if (this.inCheck()) return { over: true, reason: 'checkmate', winner: other(this.turn) };
        return { over: true, reason: 'stalemate', winner: null };
      }
      if (this.insufficientMaterial()) return { over: true, reason: 'insufficient', winner: null };
      if (this.halfmove >= 100) return { over: true, reason: 'fifty', winner: null };
      if (this.isRepeated(3)) return { over: true, reason: 'repetition', winner: null };
      return { over: false, reason: null, winner: null };
    }

    // 標準代数記法 (SAN)
    san(m) {
      let s;
      if (m.flag === 'k') s = 'O-O';
      else if (m.flag === 'q') s = 'O-O-O';
      else {
        const t = m.piece.toUpperCase();
        const dest = sqName(m.to);
        if (t === 'P') {
          s = m.captured ? FILES[m.from & 7] + 'x' + dest : dest;
          if (m.promo) s += '=' + m.promo.toUpperCase();
        } else {
          const rivals = this.moves().filter(o => o.piece === m.piece && o.to === m.to && o.from !== m.from);
          let dis = '';
          if (rivals.length) {
            const sameFile = rivals.some(o => (o.from & 7) === (m.from & 7));
            const sameRank = rivals.some(o => (o.from >> 3) === (m.from >> 3));
            if (!sameFile) dis = FILES[m.from & 7];
            else if (!sameRank) dis = sqName(m.from)[1];
            else dis = sqName(m.from);
          }
          s = t + dis + (m.captured ? 'x' : '') + dest;
        }
      }
      this.makeMove(m);
      if (this.inCheck()) s += this.moves().length === 0 ? '#' : '+';
      this.undo();
      return s;
    }

    static uci(m) { return sqName(m.from) + sqName(m.to) + (m.promo ? m.promo.toLowerCase() : ''); }

    moveFromUci(uci) {
      const from = sqIndex(uci.slice(0, 2)), to = sqIndex(uci.slice(2, 4)), promo = uci[4] || null;
      return this.moves().find(m => m.from === from && m.to === to &&
        (m.promo ? m.promo.toLowerCase() === promo : !promo)) || null;
    }
  }

  Chess.START_FEN = START_FEN;
  Chess.sqName = sqName;
  Chess.sqIndex = sqIndex;
  Chess.colorOf = colorOf;

  root.Chess = Chess;
  if (typeof module !== 'undefined' && module.exports) module.exports = Chess;
})(typeof self !== 'undefined' ? self : this);
