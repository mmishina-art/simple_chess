/* シンプルチェス: CPU思考ルーチン（Web Worker）
 * αβ探索 + 静止探索 + 駒位置評価表。レベル 1〜3 で強さを変える。
 */
if (typeof importScripts === 'function' && typeof self !== 'undefined' && !self.Chess) importScripts('chess.js');

(function (root) {
  'use strict';

  const Chess = root.Chess || (typeof require === 'function' ? require('./chess.js') : null);

  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const MATE = 100000;
  const INF = 1000000;

  // 白から見た駒位置評価表（インデックス 0 = a8）。黒は上下反転 (i ^ 56) して使う。
  const PST = {
    p: [
      0, 0, 0, 0, 0, 0, 0, 0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
      5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0,
      5, -5, -10, 0, 0, -10, -5, 5,
      5, 10, 10, -20, -20, 10, 10, 5,
      0, 0, 0, 0, 0, 0, 0, 0],
    n: [
      -50, -40, -30, -30, -30, -30, -40, -50,
      -40, -20, 0, 0, 0, 0, -20, -40,
      -30, 0, 10, 15, 15, 10, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30,
      -30, 5, 10, 15, 15, 10, 5, -30,
      -40, -20, 0, 5, 5, 0, -20, -40,
      -50, -40, -30, -30, -30, -30, -40, -50],
    b: [
      -20, -10, -10, -10, -10, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10,
      -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 5, 0, 0, 0, 0, 5, -10,
      -20, -10, -10, -10, -10, -10, -10, -20],
    r: [
      0, 0, 0, 0, 0, 0, 0, 0,
      5, 10, 10, 10, 10, 10, 10, 5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      0, 0, 0, 5, 5, 0, 0, 0],
    q: [
      -20, -10, -10, -5, -5, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5,
      -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 5, 0, 0, 0, 0, -10,
      -20, -10, -10, -5, -5, -10, -10, -20],
    k: [
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20,
      -10, -20, -20, -20, -20, -20, -20, -10,
      20, 20, 0, 0, 0, 0, 20, 20,
      20, 30, 10, 0, 0, 10, 30, 20],
    kEnd: [
      -50, -40, -30, -20, -20, -30, -40, -50,
      -30, -20, -10, 0, 0, -10, -20, -30,
      -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -30, 0, 0, 0, 0, -30, -30,
      -50, -30, -30, -30, -30, -30, -30, -50]
  };

  function centerDistance(sq) {
    const r = sq >> 3, c = sq & 7;
    return Math.max(3 - r, r - 4) + Math.max(3 - c, c - 4);
  }

  // 手番側から見た評価値
  function evaluate(g) {
    const b = g.board;
    let mg = 0, nonPawn = 0;
    const material = { w: 0, b: 0 };
    let bishops = { w: 0, b: 0 };
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p) continue;
      const t = p.toLowerCase();
      const white = p < 'a';
      const side = white ? 'w' : 'b';
      material[side] += VALUE[t];
      if (t !== 'p' && t !== 'k') nonPawn += VALUE[t];
      if (t === 'b') bishops[side]++;
      if (t === 'k') continue;
      const v = VALUE[t] + PST[t][white ? i : i ^ 56];
      mg += white ? v : -v;
    }
    if (bishops.w >= 2) mg += 30;
    if (bishops.b >= 2) mg -= 30;

    const endgame = nonPawn <= 1400;
    const kt = endgame ? PST.kEnd : PST.k;
    mg += kt[g.kings.w] - kt[g.kings.b ^ 56];

    // 終盤で優勢なら相手玉を盤端へ追い込み、自玉を近づける（詰ませやすくする）
    if (endgame) {
      const diff = material.w - material.b;
      if (Math.abs(diff) >= 300) {
        const strong = diff > 0 ? 'w' : 'b', weak = diff > 0 ? 'b' : 'w';
        const ks = g.kings[strong], kw = g.kings[weak];
        const dist = Math.abs((ks >> 3) - (kw >> 3)) + Math.abs((ks & 7) - (kw & 7));
        const bonus = centerDistance(kw) * 10 + (14 - dist) * 4;
        mg += strong === 'w' ? bonus : -bonus;
      }
    }
    return g.turn === 'w' ? mg : -mg;
  }

  // ---- 探索 ----
  let nodes = 0, deadline = Infinity, stopped = false;
  let killers = [];

  function orderScore(m, ply, pvMove) {
    if (pvMove && m.from === pvMove.from && m.to === pvMove.to && m.promo === pvMove.promo) return 1e7;
    let s = 0;
    if (m.captured) s += 1e5 + VALUE[m.captured.toLowerCase()] * 10 - VALUE[m.piece.toLowerCase()];
    if (m.promo) s += 9e4 + VALUE[m.promo.toLowerCase()];
    const k = killers[ply];
    if (k && !m.captured && k.some(x => x && x.from === m.from && x.to === m.to)) s += 5e4;
    return s;
  }

  function sortMoves(moves, ply, pvMove) {
    for (const m of moves) m._s = orderScore(m, ply, pvMove);
    moves.sort((a, b) => b._s - a._s);
  }

  function checkTime() {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) stopped = true;
  }

  function quiesce(g, alpha, beta, ply) {
    checkTime();
    if (stopped) return 0;
    const stand = evaluate(g);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const moves = g.moves(true);
    sortMoves(moves, ply, null);
    for (const m of moves) {
      g.makeMove(m);
      const s = -quiesce(g, -beta, -alpha, ply + 1);
      g.undo();
      if (stopped) return 0;
      if (s >= beta) return s;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }

  function negamax(g, depth, alpha, beta, ply, useQ) {
    checkTime();
    if (stopped) return 0;
    if (ply > 0 && (g.halfmove >= 100 || g.isRepeated(2))) return 0;

    const inCheck = g.inCheck();
    if (inCheck && ply < 16) depth++; // 王手延長

    if (depth <= 0) return useQ ? quiesce(g, alpha, beta, ply) : evaluate(g);

    const moves = g.moves();
    if (moves.length === 0) return inCheck ? -MATE + ply : 0;
    sortMoves(moves, ply, null);

    let best = -INF;
    for (const m of moves) {
      g.makeMove(m);
      const s = -negamax(g, depth - 1, -beta, -alpha, ply + 1, useQ);
      g.undo();
      if (stopped) return 0;
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) {
        if (!m.captured) {
          const k = killers[ply] || (killers[ply] = [null, null]);
          k[1] = k[0]; k[0] = m;
        }
        break;
      }
    }
    return best;
  }

  // ---- 強化版探索（ラスボス用） ----
  // 置換表・ヌルムーブ枝刈り・PVS・後半手の浅読み(LMR)・ヒストリーで、同じ時間でより深く読む
  const TT_EXACT = 0, TT_LOWER = 1, TT_UPPER = 2;
  const TT_MAX = 200000; // スマホのメモリを考えて上限を設ける
  let tt = new Map();
  let history = Object.create(null);

  const sameMove = (a, b) => !!(a && b && a.from === b.from && a.to === b.to && (a.promo || null) === (b.promo || null));

  function plusOrder(moves, ply, ttMove) {
    for (const m of moves) {
      let s = sameMove(m, ttMove) ? 1e8 : orderScore(m, ply, null);
      if (!m.captured && !m.promo && s < 5e4) s += Math.min(4e4, history[m.piece + m.to] || 0);
      m._s = s;
    }
    moves.sort((a, b) => b._s - a._s);
  }

  function hasPieces(g) {
    const white = g.turn === 'w';
    for (const p of g.board) {
      if (!p || (p < 'a') !== white) continue;
      const t = p.toLowerCase();
      if (t !== 'p' && t !== 'k') return true;
    }
    return false;
  }

  function search(g, depth, alpha, beta, ply, nullOk) {
    checkTime();
    if (stopped) return 0;
    if (ply > 0 && (g.halfmove >= 100 || g.isRepeated(2))) return 0;

    const inCheck = g.inCheck();
    if (inCheck && ply < 24) depth++;
    if (depth <= 0) return quiesce(g, alpha, beta, ply);

    const key = g.key();
    const e = tt.get(key);
    const ttMove = e ? e.move : null;
    if (e && e.depth >= depth) {
      let s = e.score;
      if (s > MATE - 1000) s -= ply; else if (s < -MATE + 1000) s += ply;
      if (e.flag === TT_EXACT) return s;
      if (e.flag === TT_LOWER && s >= beta) return s;
      if (e.flag === TT_UPPER && s <= alpha) return s;
    }

    const pvNode = beta - alpha > 1;
    // ヌルムーブ: パスしてもなお相手を上回るなら、この局面は深く読むまでもない
    if (nullOk && !pvNode && !inCheck && depth >= 3 && hasPieces(g) && evaluate(g) >= beta) {
      g.makeNull();
      const s = -search(g, depth - 3, -beta, -beta + 1, ply + 1, false);
      g.undoNull();
      if (stopped) return 0;
      if (s >= beta) return s >= MATE - 1000 ? beta : s;
    }

    const moves = g.moves();
    if (moves.length === 0) return inCheck ? -MATE + ply : 0;
    plusOrder(moves, ply, ttMove);

    const alpha0 = alpha;
    let best = -INF, bestMove = null;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      g.makeMove(m);
      let s;
      if (i === 0) {
        s = -search(g, depth - 1, -beta, -alpha, ply + 1, true);
      } else {
        // 有望でなさそうな静かな手は浅く読み、良さそうなら読み直す
        let r = 0;
        if (depth >= 3 && i >= 3 && !inCheck && !m.captured && !m.promo && !g.inCheck()) r = i >= 8 ? 2 : 1;
        s = -search(g, depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha && r && !stopped) s = -search(g, depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha && s < beta && !stopped) s = -search(g, depth - 1, -beta, -alpha, ply + 1, true);
      }
      g.undo();
      if (stopped) return 0;
      if (s > best) { best = s; bestMove = m; }
      if (s > alpha) alpha = s;
      if (alpha >= beta) {
        if (!m.captured && !m.promo) {
          const k = killers[ply] || (killers[ply] = [null, null]);
          k[1] = k[0]; k[0] = m;
          history[m.piece + m.to] = (history[m.piece + m.to] || 0) + depth * depth;
        }
        break;
      }
    }

    let store = best;
    if (store > MATE - 1000) store += ply; else if (store < -MATE + 1000) store -= ply;
    if (tt.size >= TT_MAX) tt.clear();
    tt.set(key, {
      depth, score: store,
      flag: best <= alpha0 ? TT_UPPER : best >= beta ? TT_LOWER : TT_EXACT,
      move: bestMove && { from: bestMove.from, to: bestMove.to, promo: bestMove.promo }
    });
    return best;
  }

  function iterativeDeepeningPlus(g, moves, maxDepth, timeMs) {
    deadline = Date.now() + timeMs;
    tt = new Map();
    history = Object.create(null);
    let best = moves[0];
    for (let depth = 1; depth <= maxDepth; depth++) {
      let alpha = -INF, iterBest = null;
      plusOrder(moves, 0, best);
      for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        g.makeMove(m);
        let s;
        if (i === 0) s = -search(g, depth - 1, -INF, INF, 1, true);
        else {
          s = -search(g, depth - 1, -alpha - 1, -alpha, 1, true);
          if (s > alpha && !stopped) s = -search(g, depth - 1, -INF, -alpha, 1, true);
        }
        g.undo();
        if (stopped) break;
        if (s > alpha || !iterBest) { alpha = s; iterBest = m; }
      }
      lastDepth = depth - (stopped ? 1 : 0);
      if (stopped) {
        if (iterBest) best = iterBest;
        break;
      }
      best = iterBest;
      if (alpha >= MATE - 1000) break;
    }
    return best;
  }
  let lastDepth = 0;

  // 全ての指し手を正確な評価値で採点し、ノイズを加えて選ぶ（弱め・中程度のレベル用）
  function pickWithNoise(g, moves, depth, useQ, noise) {
    sortMoves(moves, 0, null);
    let best = null, bestScore = -INF;
    for (const m of moves) {
      g.makeMove(m);
      let s = -negamax(g, depth - 1, -INF, INF, 1, useQ);
      g.undo();
      if (Math.abs(s) < MATE - 1000) s += Math.random() * noise;
      if (s > bestScore) { bestScore = s; best = m; }
    }
    return best;
  }

  // 反復深化 αβ 探索（強いレベル用）
  function iterativeDeepening(g, moves, maxDepth, timeMs) {
    deadline = Date.now() + timeMs;
    let best = moves[0];
    sortMoves(moves, 0, null);
    for (let depth = 1; depth <= maxDepth; depth++) {
      let alpha = -INF, iterBest = null;
      sortMoves(moves, 0, best);
      for (const m of moves) {
        g.makeMove(m);
        const s = -negamax(g, depth - 1, -INF, -alpha, 1, true);
        g.undo();
        if (stopped) break;
        if (s > alpha || !iterBest) { alpha = s; iterBest = m; }
      }
      if (stopped) {
        // 途中までの結果でも、前回の最善手より良いと分かった手は採用する
        if (iterBest && iterBest !== moves[0]) best = iterBest;
        break;
      }
      best = iterBest;
      if (alpha >= MATE - 1000) break; // 詰みを発見
    }
    return best;
  }

  const LEVELS = {
    1: { depth: 1, useQ: false, noise: 150, randomRate: 0.2 }, // やさしい
    2: { depth: 3, useQ: true, noise: 25, randomRate: 0 },     // ふつう
    3: { depth: 8, timeMs: 2500 },                              // つよい
    // ストーリーモード（第1話〜第10話）
    s1: { depth: 1, useQ: false, noise: 400, randomRate: 0.45 },
    s2: { depth: 1, useQ: false, noise: 200, randomRate: 0.25 },
    s3: { depth: 1, useQ: true, noise: 120, randomRate: 0.12 },
    s4: { depth: 2, useQ: true, noise: 90, randomRate: 0.06 },
    s5: { depth: 2, useQ: true, noise: 40, randomRate: 0.02 },
    s6: { depth: 3, useQ: true, noise: 50, randomRate: 0 },
    s7: { depth: 3, useQ: true, noise: 15, randomRate: 0 },
    s8: { depth: 8, timeMs: 900 },
    s9: { depth: 8, timeMs: 2000 },
    s10: { depth: 30, timeMs: 3500, plus: true }
  };

  function think(fen, uciMoves, level) {
    const g = new Chess(fen);
    for (const u of uciMoves) {
      const m = g.moveFromUci(u);
      if (!m) break;
      g.makeMove(m);
    }
    const moves = g.moves();
    if (moves.length === 0) return null;
    if (moves.length === 1) return Chess.uci(moves[0]);

    nodes = 0; stopped = false; killers = []; deadline = Infinity;
    const cfg = LEVELS[level] || LEVELS[2];
    let m;
    if (cfg.plus) {
      m = iterativeDeepeningPlus(g, moves, cfg.depth, cfg.timeMs);
    } else if (cfg.timeMs) {
      m = iterativeDeepening(g, moves, cfg.depth, cfg.timeMs);
    } else if (Math.random() < cfg.randomRate) {
      m = moves[Math.floor(Math.random() * moves.length)];
    } else {
      deadline = Date.now() + 8000;
      m = pickWithNoise(g, moves, cfg.depth, cfg.useQ, cfg.noise);
    }
    return Chess.uci(m || moves[0]);
  }

  const api = { think, evaluate, lastDepth: () => lastDepth };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // Worker として動作している場合
  if (typeof importScripts === 'function' && typeof postMessage === 'function' && !(typeof module !== 'undefined' && module.exports)) {
    root.onmessage = (e) => {
      const { id, fen, moves, level } = e.data;
      const uci = think(fen || Chess.START_FEN, moves || [], level);
      root.postMessage({ id, uci });
    };
  }
})(typeof self !== 'undefined' ? self : this);
