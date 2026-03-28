import type { RoomGrid } from "./room-grid.ts"
import { roomGridIndex } from "./room-grid.ts"

export const OUTPOST_COLS = 22
export const OUTPOST_ROWS = 16

const STATIC_BLOCKERS: Array<[number, number]> = [
  [3, 4],
  [4, 4],
  [5, 4],
  [4, 5],
  [5, 5],
  [6, 5],
  [7, 6],
  [8, 6],
  [7, 7],
  [12, 8],
  [13, 8],
  [14, 8],
  [13, 9],
  [14, 9],
  [15, 9],
  [10, 3],
  [11, 3],
  [16, 5],
  [17, 5],
  [18, 5],
]

export function buildOutpostGrid(): RoomGrid {
  const walkable = new Array(OUTPOST_COLS * OUTPOST_ROWS).fill(true)

  const block = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < OUTPOST_COLS && y < OUTPOST_ROWS) {
      walkable[roomGridIndex(x, y, OUTPOST_COLS)] = false
    }
  }

  for (let x = 0; x < OUTPOST_COLS; x += 1) {
    block(x, 0)
    block(x, OUTPOST_ROWS - 1)
  }

  for (let y = 0; y < OUTPOST_ROWS; y += 1) {
    block(0, y)
    block(OUTPOST_COLS - 1, y)
  }

  STATIC_BLOCKERS.forEach(([x, y]) => block(x, y))

  return {
    cols: OUTPOST_COLS,
    rows: OUTPOST_ROWS,
    walkable,
  }
}
