// Pure rules of the street mini-games. The room owns the timers and rewards.
export const CARO_SIZE = 9;
const WIN_LENGTH = 5;

export const emptyBoard = () => '.'.repeat(CARO_SIZE * CARO_SIZE);

export function placeMark(board: string, cell: number, mark: string) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= board.length || board[cell] !== '.') return null;
  return board.slice(0, cell) + mark + board.slice(cell + 1);
}

export function hasFive(board: string, cell: number) {
  const mark = board[cell];
  const x = cell % CARO_SIZE, y = Math.floor(cell / CARO_SIZE);
  const at = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < CARO_SIZE && cy < CARO_SIZE && board[cy * CARO_SIZE + cx] === mark;
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let run = 1;
    for (const s of [1, -1]) for (let i = 1; at(x + dx * i * s, y + dy * i * s); i++) run++;
    if (run >= WIN_LENGTH) return true;
  }
  return false;
}

// The neighbour opponent plays near existing marks and takes a win or a block when it sees one
export function npcMove(board: string, mark: string, other: string, random = Math.random) {
  const empty = [...board].flatMap((c, i) => (c === '.' ? [i] : []));
  if (!empty.length) return -1;
  const wins = (m: string) => empty.find((i) => hasFive(placeMark(board, i, m)!, i));
  const decisive = wins(mark) ?? wins(other);
  if (decisive !== undefined) return decisive;
  const near = empty.filter((i) => {
    const x = i % CARO_SIZE, y = Math.floor(i / CARO_SIZE);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = x + dx, cy = y + dy;
      if (cx >= 0 && cy >= 0 && cx < CARO_SIZE && cy < CARO_SIZE && board[cy * CARO_SIZE + cx] !== '.') return true;
    }
    return false;
  });
  const pool = near.length ? near : empty;
  return pool[Math.floor(random() * pool.length)];
}

// Shuttlecock: kicks in a row earn a reward, capped so a long rally cannot print money
export const shuttleReward = (score: number) => Math.min(30, score) * 1000;
