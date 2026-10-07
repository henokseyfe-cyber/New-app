// Checkers rules (American / English draughts). Server-authoritative.
// Board: 8x8 array, null | {color:'r'|'b', king:bool}. Red moves "up" (toward row 0), starts first.

function newBoard() {
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) {
        if (r < 3) b[r][c] = { color: 'b', king: false };
        else if (r > 4) b[r][c] = { color: 'r', king: false };
      }
  return b;
}

const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

function dirs(p) {
  if (p.king) return [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  return p.color === 'r' ? [[-1, 1], [-1, -1]] : [[1, 1], [1, -1]];
}

function jumpsFrom(b, r, c) {
  const p = b[r][c];
  const out = [];
  for (const [dr, dc] of dirs(p)) {
    const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
    if (inside(tr, tc) && b[mr][mc] && b[mr][mc].color !== p.color && !b[tr][tc])
      out.push({ from: [r, c], to: [tr, tc], capture: [mr, mc] });
  }
  return out;
}

function stepsFrom(b, r, c) {
  const out = [];
  for (const [dr, dc] of dirs(b[r][c])) {
    const tr = r + dr, tc = c + dc;
    if (inside(tr, tc) && !b[tr][tc]) out.push({ from: [r, c], to: [tr, tc] });
  }
  return out;
}

// Legal moves for the side to move. Captures are mandatory.
// If mustContinue=[r,c], only further jumps from that piece are allowed.
function legalMoves(state) {
  const { board: b, turn, mustContinue } = state;
  if (mustContinue) return jumpsFrom(b, ...mustContinue);
  let jumps = [], steps = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (b[r][c] && b[r][c].color === turn) {
        jumps.push(...jumpsFrom(b, r, c));
        steps.push(...stepsFrom(b, r, c));
      }
  return jumps.length ? jumps : steps;
}

function newGame() {
  return { board: newBoard(), turn: 'r', mustContinue: null, winner: null };
}

// Returns error string or null; mutates state on success.
function applyMove(state, from, to) {
  if (state.winner) return 'Game is over';
  const m = legalMoves(state).find(
    (m) => m.from[0] === from[0] && m.from[1] === from[1] && m.to[0] === to[0] && m.to[1] === to[1]
  );
  if (!m) return 'Illegal move';
  const b = state.board;
  const p = b[from[0]][from[1]];
  b[to[0]][to[1]] = p;
  b[from[0]][from[1]] = null;
  let crowned = false;
  if (!p.king && ((p.color === 'r' && to[0] === 0) || (p.color === 'b' && to[0] === 7))) {
    p.king = true;
    crowned = true;
  }
  if (m.capture) {
    b[m.capture[0]][m.capture[1]] = null;
    // Multi-jump continues unless the piece was just crowned.
    if (!crowned && jumpsFrom(b, to[0], to[1]).length) {
      state.mustContinue = to;
      return null;
    }
  }
  state.mustContinue = null;
  state.turn = state.turn === 'r' ? 'b' : 'r';
  if (!legalMoves(state).length) state.winner = state.turn === 'r' ? 'b' : 'r';
  return null;
}

if (typeof module !== "undefined") module.exports = { newGame, legalMoves, applyMove };
