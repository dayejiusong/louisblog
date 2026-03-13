import type { RoomHotspot } from "@/lib/blog-content"

export type RoomPoint = {
  x: number
  y: number
}

export type RoomGrid = {
  cols: number
  rows: number
  walkable: boolean[]
}

export const ROOM_COLS = 20
export const ROOM_ROWS = 16

const STATIC_BLOCKERS: Array<[number, number]> = [
  [6, 11],
  [7, 11],
  [8, 11],
  [11, 10],
  [12, 10],
  [16, 4],
]

export function roomGridIndex(x: number, y: number, cols = ROOM_COLS) {
  return y * cols + x
}

export function buildRoomGrid(hotspots: RoomHotspot[]): RoomGrid {
  const walkable = new Array(ROOM_COLS * ROOM_ROWS).fill(true)

  const block = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < ROOM_COLS && y < ROOM_ROWS) {
      walkable[roomGridIndex(x, y, ROOM_COLS)] = false
    }
  }

  for (let x = 0; x < ROOM_COLS; x += 1) {
    block(x, 0)
    block(x, ROOM_ROWS - 1)
  }

  for (let y = 0; y < ROOM_ROWS; y += 1) {
    block(0, y)
    block(ROOM_COLS - 1, y)
  }

  hotspots.forEach((hotspot) => {
    hotspot.footprint.forEach((tile) => block(tile.x, tile.y))
  })

  STATIC_BLOCKERS.forEach(([x, y]) => block(x, y))

  return {
    cols: ROOM_COLS,
    rows: ROOM_ROWS,
    walkable,
  }
}

export function clampTileToInterior(point: RoomPoint, grid: RoomGrid): RoomPoint {
  return {
    x: Math.max(1, Math.min(grid.cols - 2, Math.round(point.x))),
    y: Math.max(1, Math.min(grid.rows - 2, Math.round(point.y))),
  }
}

export function isWalkableTile(point: RoomPoint, grid: RoomGrid) {
  return grid.walkable[roomGridIndex(point.x, point.y, grid.cols)]
}

export function findNearestWalkableTile(target: RoomPoint, grid: RoomGrid) {
  const start = clampTileToInterior(target, grid)
  if (isWalkableTile(start, grid)) return start

  const queue: RoomPoint[] = [start]
  const visited = new Set<string>([`${start.x},${start.y}`])

  while (queue.length) {
    const current = queue.shift()
    if (!current) break

    const neighbors: RoomPoint[] = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ]

    for (const neighbor of neighbors) {
      if (neighbor.x < 1 || neighbor.y < 1 || neighbor.x > grid.cols - 2 || neighbor.y > grid.rows - 2) continue
      const key = `${neighbor.x},${neighbor.y}`
      if (visited.has(key)) continue
      if (isWalkableTile(neighbor, grid)) return neighbor
      visited.add(key)
      queue.push(neighbor)
    }
  }

  return start
}

export function listWalkableTiles(grid: RoomGrid, predicate?: (point: RoomPoint) => boolean) {
  const tiles: RoomPoint[] = []

  for (let y = 1; y < grid.rows - 1; y += 1) {
    for (let x = 1; x < grid.cols - 1; x += 1) {
      const point = { x, y }
      if (!isWalkableTile(point, grid)) continue
      if (predicate && !predicate(point)) continue
      tiles.push(point)
    }
  }

  return tiles
}
