// A push-optimal Sokoban solver that works room by room.
//
// A generated level is a hallway with independent rooms off it: a box pushed
// through a door lands in the hallway, where it reaches no goal, so no box
// ever leaves its room and the level's optimum is the sum of its rooms'
// optima. Each room is solved on its own with a breadth-first search over
// pushes — the first solved state met is push-optimal — pruned by two
// deadlocks that can never be undone: a box on a square no pull from a goal
// can reach, and a box frozen inside a 2 x 2 block of walls and boxes. The
// player's walk between pushes is the shortest path around the boxes, and
// rooms are visited in scan order with the other rooms' boxes as walls.
// No clock, no randomness: the same input always gives the same moves.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MAX_STATES = 250000;
const DIRS = [
  [0, -1, 'u', 'U'],
  [0, 1, 'd', 'D'],
  [-1, 0, 'l', 'L'],
  [1, 0, 'r', 'R'],
];

// A parsed level: width, height, walls (1 a wall), goals, boxes (sorted),
// and the player's square. Short rows pad out as walls; the outer frame is
// a wall whatever the text shows.
function parseLevel(text) {
  const rows = text.split('\n').filter((r) => r.length > 0);
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const wall = new Uint8Array(w * h).fill(1);
  const goals = [];
  const boxes = [];
  let player = -1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const i = y * w + x;
      if (ch === '#') continue;
      wall[i] = 0;
      if (ch === '.' || ch === '*' || ch === '+') goals.push(i);
      if (ch === '$' || ch === '*') boxes.push(i);
      if (ch === '@' || ch === '+') player = i;
    }
  });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) wall[y * w + x] = 1;
    }
  }
  return { w, h, wall, goals, boxes: boxes.sort((a, b) => a - b), player };
}

// The squares a box can stand on and still be pushed onto some goal: pull
// back from the goals, ignoring the other boxes. A box on any other square
// is dead, whatever the rest of the level does.
function liveCells(board) {
  const { w, wall, goals } = board;
  const live = new Uint8Array(wall.length);
  const queue = [...goals];
  for (const g of goals) live[g] = 1;
  for (let qi = 0; qi < queue.length; qi++) {
    const x = queue[qi];
    for (const [dx, dy] of DIRS) {
      const d = dy * w + dx;
      const y = x - d;
      if (!wall[y] && !wall[y - d] && !live[y]) {
        live[y] = 1;
        queue.push(y);
      }
    }
  }
  return live;
}

// The squares the player reaches from `from` around walls and the boxes in
// `occupied`, marked in `seen` with `stamp`; returns the lowest of them,
// which names the region the player stands in.
function reach(board, occupied, from, seen, stamp, stack) {
  const { w, wall } = board;
  let low = from;
  let n = 0;
  stack[n++] = from;
  seen[from] = stamp;
  while (n > 0) {
    const p = stack[--n];
    if (p < low) low = p;
    for (let k = 0; k < 4; k++) {
      const q = k === 0 ? p - w : k === 1 ? p + w : k === 2 ? p - 1 : p + 1;
      if (wall[q] === 0 && occupied[q] === 0 && seen[q] !== stamp) {
        seen[q] = stamp;
        stack[n++] = q;
      }
    }
  }
  return low;
}

// Whether the box just pushed to `t` sits in a frozen 2 x 2 block of walls
// and boxes holding a box off its goal: no push can ever break it.
function frozenBlock(board, occupied, isGoal, t) {
  const { w, wall } = board;
  for (const a of [t, t - 1, t - w, t - w - 1]) {
    const b = a + 1;
    const c = a + w;
    const d = c + 1;
    if (!(wall[a] || occupied[a]) || !(wall[b] || occupied[b])) continue;
    if (!(wall[c] || occupied[c]) || !(wall[d] || occupied[d])) continue;
    if ((occupied[a] && !isGoal[a]) || (occupied[b] && !isGoal[b])) return true;
    if ((occupied[c] && !isGoal[c]) || (occupied[d] && !isGoal[d])) return true;
  }
  return false;
}

// The shortest walk from `from` to `to` around walls and boxes, in lower
// LURD letters, the first direction first on ties.
function walkPath(board, occupied, from, to) {
  const { w, wall } = board;
  if (from === to) return '';
  const prev = new Int32Array(wall.length).fill(-1);
  const how = new Array(wall.length);
  const queue = [from];
  prev[from] = from;
  for (let qi = 0; qi < queue.length; qi++) {
    const p = queue[qi];
    if (p === to) break;
    for (const [dx, dy, letter] of DIRS) {
      const q = p + dy * w + dx;
      if (wall[q] || occupied[q] || prev[q] !== -1) continue;
      prev[q] = p;
      how[q] = letter;
      queue.push(q);
    }
  }
  if (prev[to] === -1) return '';
  let s = '';
  for (let p = to; p !== from; p = prev[p]) s = how[p] + s;
  return s;
}

// The square the player stands on after `moves` (LURD, the case aside)
// from `from` on a board `w` wide.
function endOf(w, from, moves) {
  let p = from;
  for (const ch of moves.toLowerCase()) {
    p += ch === 'u' ? -w : ch === 'd' ? w : ch === 'l' ? -1 : 1;
  }
  return p;
}

// A state's key: the region's lowest square and the boxes' squares, as
// digits in base `size` (exact while size ** (boxes + 1) stays under 2 ** 53:
// a room of up to five boxes on any board this generator draws).
function keyOf(boxes, low, size) {
  let k = low;
  for (const b of boxes) k = k * size + b;
  return k;
}

// The push-optimal solution of `board`, searching at most `maxStates`
// states: {pushes, moves} (moves in LURD: a lower letter a step, an upper
// one a push), or null when the search gives up (or the level has no
// solution). Breadth-first over pushes, so the first solved state met is
// push-optimal.
function pushSearch(board, maxStates) {
  const { w, wall, goals } = board;
  const size = wall.length;
  const isGoal = new Uint8Array(size);
  for (const g of goals) isGoal[g] = 1;
  const live = liveCells(board);
  const occupied = new Uint8Array(size);
  const seen = new Int32Array(size);
  const mark = new Int32Array(size);
  const stack = new Int32Array(size);
  let stamp = 0;
  const solved = (boxes) => boxes.every((b) => isGoal[b]);
  if (board.boxes.some((b) => !live[b])) return null;
  if (solved(board.boxes)) return { pushes: 0, moves: '' };

  // The states in the order found: their boxes, the player's square, and the
  // push that made them from their parent.
  const sBoxes = [board.boxes];
  const sPlayer = [board.player];
  const sParent = [-1];
  const sFrom = [-1];
  const sTo = [-1];
  const sDir = [-1];
  const index = new Map();
  for (const b of board.boxes) occupied[b] = 1;
  index.set(keyOf(board.boxes, reach(board, occupied, board.player, seen, ++stamp, stack), size), 0);
  for (const b of board.boxes) occupied[b] = 0;
  let found = -1;
  for (let head = 0; found < 0 && head < sBoxes.length; head++) {
    const boxes = sBoxes[head];
    for (const b of boxes) occupied[b] = 1;
    reach(board, occupied, sPlayer[head], seen, ++stamp, stack);
    const here = stamp;
    for (let bi = 0; bi < boxes.length && found < 0; bi++) {
      const b = boxes[bi];
      for (let di = 0; di < 4; di++) {
        const [dx, dy] = DIRS[di];
        const d = dy * w + dx;
        const t = b + d;
        if (seen[b - d] !== here || wall[t] || occupied[t] || !live[t]) continue;
        occupied[b] = 0;
        occupied[t] = 1;
        const frozen = frozenBlock(board, occupied, isGoal, t);
        let key = -1;
        let next = null;
        if (!frozen) {
          next = boxes.slice();
          next[bi] = t;
          next.sort((x, y) => x - y);
          key = keyOf(next, reach(board, occupied, b, mark, ++stamp, stack), size);
        }
        occupied[t] = 0;
        occupied[b] = 1;
        if (frozen || index.has(key)) continue;
        if (sBoxes.length >= maxStates) {
          for (const x of boxes) occupied[x] = 0;
          return null;
        }
        index.set(key, sBoxes.length);
        sBoxes.push(next);
        sPlayer.push(b);
        sParent.push(head);
        sFrom.push(b);
        sTo.push(t);
        sDir.push(di);
        if (solved(next)) {
          found = sBoxes.length - 1;
          break;
        }
      }
    }
    for (const x of boxes) occupied[x] = 0;
  }
  if (found < 0) return null;
  // The path of states, then the moves: walk to each push's square, then push.
  const path = [];
  for (let s = found; s > 0; s = sParent[s]) path.push(s);
  path.reverse();
  let moves = '';
  let player = board.player;
  let boxes = board.boxes;
  for (const s of path) {
    const nextBoxes = sBoxes[s];
    const from = sFrom[s];
    const to = sTo[s];
    const d = to - from;
    for (const b of boxes) occupied[b] = 1;
    moves += walkPath(board, occupied, player, from - d);
    for (const b of boxes) occupied[b] = 0;
    moves += DIRS[sDir[s]][3];
    player = from;
    boxes = nextBoxes;
  }
  return { pushes: path.length, moves };
}

// The level's rooms: cut the dead squares of the player's row (the hallway:
// a box there reaches no goal) out of the floor, and each part left that
// holds a box is a room, its squares, boxes and goals. Null when some part
// holds more or fewer boxes than goals, or a box starts in the hallway:
// then the level is no set of rooms.
function roomsOf(board) {
  const { w, wall, goals, boxes, player } = board;
  const live = liveCells(board);
  const row = Math.floor(player / w);
  const cut = new Uint8Array(wall.length);
  for (let i = row * w; i < (row + 1) * w; i++) {
    if (!wall[i] && !live[i]) cut[i] = 1;
  }
  if (boxes.some((b) => cut[b])) return null;
  const part = new Int32Array(wall.length).fill(-1);
  const rooms = [];
  for (let s = 0; s < wall.length; s++) {
    if (wall[s] || cut[s] || part[s] >= 0) continue;
    const squares = [s];
    part[s] = rooms.length;
    for (let i = 0; i < squares.length; i++) {
      for (const [dx, dy] of DIRS) {
        const q = squares[i] + dy * w + dx;
        if (!wall[q] && !cut[q] && part[q] < 0) {
          part[q] = rooms.length;
          squares.push(q);
        }
      }
    }
    rooms.push({ squares, boxes: [], goals: [] });
  }
  for (const b of boxes) rooms[part[b]].boxes.push(b);
  for (const g of goals) {
    if (part[g] >= 0) rooms[part[g]].goals.push(g);
  }
  if (goals.some((g) => part[g] < 0)) return null;
  if (rooms.some((r) => r.boxes.length !== r.goals.length)) return null;
  return rooms.filter((r) => r.boxes.length > 0);
}

// The level solved room by room: each room's push-optimal solution in turn,
// the other rooms' boxes standing as walls (on their goals once their room
// is done), the player walking on from where the last room left it. A box
// never leaves its room, so the rooms' optima add up to the level's.
// Falls back to a search over the whole level when the level is no set of
// rooms, or a room's search gives up; an empty answer when that gives up too.
function solveLevel(text) {
  const board = parseLevel(text);
  const rooms = roomsOf(board);
  if (rooms === null) {
    const whole = pushSearch(board, MAX_STATES);
    return whole === null ? '' : whole.moves;
  }
  let player = board.player;
  let moves = '';
  for (const room of rooms) {
    const wall = board.wall.slice();
    for (const other of rooms) {
      if (other === room) continue;
      for (const b of other.done ? other.goals : other.boxes) wall[b] = 1;
    }
    const sub = {
      w: board.w,
      h: board.h,
      wall,
      goals: room.goals.slice().sort((a, b) => a - b),
      boxes: room.boxes.slice().sort((a, b) => a - b),
      player,
    };
    const solved = pushSearch(sub, MAX_STATES);
    if (solved === null) {
      const whole = pushSearch(board, MAX_STATES);
      return whole === null ? '' : whole.moves;
    }
    moves += solved.moves;
    player = endOf(board.w, player, solved.moves);
    room.done = true;
  }
  return moves;
}

for (const id of readdirSync(INPUT_DIR).sort()) {
  // One bad instance must never cost the others their answers.
  let moves = '';
  try {
    if (!statSync(join(INPUT_DIR, id)).isDirectory()) continue;
    moves = solveLevel(readFileSync(join(INPUT_DIR, id, 'level.txt'), 'utf8'));
  } catch {
    moves = '';
  }
  mkdirSync(join(OUTPUT_DIR, id), { recursive: true });
  writeFileSync(join(OUTPUT_DIR, id, 'solution.txt'), `${moves}\n`);
}
