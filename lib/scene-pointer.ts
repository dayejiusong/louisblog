export type PointerHitTarget = {
  kind: string
  id: string
  x: number
  y: number
  w: number
  h: number
  snapDistance: number
}

export type PointerIntent = {
  relativeX: number
  relativeY: number
  clientX: number
  clientY: number
  targetId: string | null
}

export function resolveHitTarget<T extends PointerHitTarget>(
  px: number,
  py: number,
  hitAreas: T[],
  priority: (area: T) => number
) {
  const insideHits = hitAreas
    .filter((area) => px >= area.x && px <= area.x + area.w && py >= area.y && py <= area.y + area.h)
    .sort((left, right) => priority(left) - priority(right))

  if (insideHits.length) {
    return insideHits[0] ?? null
  }

  const snappedHits = hitAreas
    .map((area) => ({ area, distance: distanceToHitArea(px, py, area) }))
    .filter((candidate) => candidate.distance <= candidate.area.snapDistance)
    .sort((left, right) => {
      const priorityDelta = priority(left.area) - priority(right.area)
      return priorityDelta !== 0 ? priorityDelta : left.distance - right.distance
    })

  return snappedHits[0]?.area ?? null
}

export function capturePointerIntent<T extends PointerHitTarget>(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  hitAreas: T[],
  priority: (area: T) => number
): PointerIntent {
  const px = clientX - rect.left
  const py = clientY - rect.top
  const target = resolveHitTarget(px, py, hitAreas, priority)

  return {
    relativeX: px / rect.width,
    relativeY: py / rect.height,
    clientX,
    clientY,
    targetId: target?.id ?? null,
  }
}

export function pointerIntentWithinTolerance(intent: PointerIntent, clientX: number, clientY: number, tolerance = 18) {
  return Math.hypot(clientX - intent.clientX, clientY - intent.clientY) <= tolerance
}

function distanceToHitArea(px: number, py: number, area: PointerHitTarget) {
  const dx = Math.max(area.x - px, 0, px - (area.x + area.w))
  const dy = Math.max(area.y - py, 0, py - (area.y + area.h))
  return Math.hypot(dx, dy)
}
