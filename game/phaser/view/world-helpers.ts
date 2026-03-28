import { projectIso, unprojectIso, type IsoProjectParams } from "../../../lib/iso.ts"
import { resolveHitTarget, type PointerHitTarget } from "../../../lib/scene-pointer.ts"

export const TILE_W = 58
export const TILE_H = 29

export type InteractiveHitArea = PointerHitTarget & {
  kind: "hotspot" | "exit" | "dog"
}

export function computeCenteredOrigin(width: number, height: number, cols: number, rows: number, tileW: number, tileH: number, paddingTop = 8) {
  const hw = tileW / 2
  const hh = tileH / 2
  const corners = [
    { px: 0, py: 0 },
    { px: (cols - 1) * hw, py: (cols - 1) * hh },
    { px: -(rows - 1) * hw, py: (rows - 1) * hh },
    { px: (cols - rows) * hw, py: (cols + rows - 2) * hh },
  ]
  const minX = Math.min(...corners.map((corner) => corner.px - hw))
  const maxX = Math.max(...corners.map((corner) => corner.px + hw))
  const minY = Math.min(...corners.map((corner) => corner.py))
  const maxY = Math.max(...corners.map((corner) => corner.py + tileH))

  return {
    originX: Math.round(width / 2 - (minX + maxX) / 2),
    originY: Math.round(height / 2 - (minY + maxY) / 2) - paddingTop,
  }
}

export function makeIsoParams(width: number, height: number, cols: number, rows: number, paddingTop = 8): IsoProjectParams {
  const origin = computeCenteredOrigin(width, height, cols, rows, TILE_W, TILE_H, paddingTop)
  return {
    tileW: TILE_W,
    tileH: TILE_H,
    originX: origin.originX,
    originY: origin.originY,
  }
}

export function projectPoint(tx: number, ty: number, params: IsoProjectParams) {
  return projectIso(tx, ty, params)
}

export function unprojectPoint(px: number, py: number, params: IsoProjectParams) {
  return unprojectIso(px, py, params)
}

export function resolveInteractiveTarget(px: number, py: number, hitAreas: InteractiveHitArea[]) {
  return resolveHitTarget(px, py, hitAreas, (area) => (area.kind === "dog" ? 0 : 1))
}
