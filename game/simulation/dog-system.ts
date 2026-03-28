import { aStar } from "../../lib/pathfinding.ts"
import { findNearestWalkableTile, listWalkableTiles, roomGridIndex, type RoomGrid, type RoomPoint } from "../../lib/room-grid.ts"
import type { ActorTileState, ActorVisualState, DogAnimationState } from "../types.ts"

type DogPathState = {
  nodes: RoomPoint[]
  progress: number
  speed: number
}

export type DogRuntime = {
  currentTile: ActorTileState
  visual: ActorVisualState
  bubble: string | null
  animation: DogAnimationState
  path: DogPathState | null
  wanderCooldown: number
  bubbleRemaining: number
  wagRemaining: number
}

const WALK_SPEED = 3.5
const RUN_SPEED = 5.2

function roundPoint(point: { x: number; y: number }) {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  }
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function setFacing(currentFacing: ActorTileState["facing"], dx: number) {
  if (dx > 0) return "E" as const
  if (dx < 0) return "W" as const
  return currentFacing
}

function createAnimation(phase: DogAnimationState["phase"], moving: boolean, wagging: boolean, speed: DogAnimationState["speed"]): DogAnimationState {
  return {
    phase,
    moving,
    wagging,
    speed,
  }
}

function chooseNearbyHeroTile(grid: RoomGrid, dog: DogRuntime, hero: ActorVisualState, predicate?: (point: RoomPoint, grid: RoomGrid) => boolean) {
  const heroPoint = roundPoint(hero)
  const dogPoint = roundPoint(dog.currentTile)
  const candidates = listWalkableTiles(grid, (point) => {
    if (predicate && !predicate(point, grid)) return false
    const heroDistance = distance(point, heroPoint)
    const dogDistance = distance(point, dogPoint)
    return heroDistance >= 1.5 && heroDistance <= 4.5 && dogDistance >= 1
  }).sort((left, right) => {
    const leftScore = Math.abs(distance(left, heroPoint) - 2.5) + distance(left, dogPoint) * 0.15
    const rightScore = Math.abs(distance(right, heroPoint) - 2.5) + distance(right, dogPoint) * 0.15
    return leftScore - rightScore
  })

  return candidates[0] ?? null
}

function startPath(runtime: DogRuntime, grid: RoomGrid, target: RoomPoint, speed: number) {
  const start = roundPoint(runtime.currentTile)
  const goal = findNearestWalkableTile(target, grid)
  if (goal.x === start.x && goal.y === start.y) return false

  const path = aStar(start, goal, grid.cols, grid.rows, (x, y) => grid.walkable[roomGridIndex(x, y, grid.cols)])
  if (path.length <= 1) return false

  runtime.path = {
    nodes: path,
    progress: 0,
    speed,
  }

  const nextNode = path[1]
  runtime.visual.facing = setFacing(runtime.visual.facing, nextNode.x - start.x)
  runtime.animation = createAnimation(speed > WALK_SPEED ? "follow" : "patrol", true, runtime.wagRemaining > 0, speed > WALK_SPEED ? "run" : "walk")
  return true
}

export function createDogRuntime(spawn: ActorTileState): DogRuntime {
  return {
    currentTile: { ...spawn },
    visual: { ...spawn, moving: false },
    bubble: null,
    animation: createAnimation("idle", false, false, "idle"),
    path: null,
    wanderCooldown: randomBetween(0.4, 1.2),
    bubbleRemaining: 0,
    wagRemaining: 0,
  }
}

export function triggerDogInteraction(runtime: DogRuntime) {
  runtime.path = null
  runtime.visual = {
    x: runtime.currentTile.x,
    y: runtime.currentTile.y,
    facing: runtime.currentTile.facing,
    moving: false,
  }
  runtime.bubble = "汪！"
  runtime.bubbleRemaining = 1
  runtime.wagRemaining = 0.68
  runtime.wanderCooldown = 0.2
  runtime.animation = createAnimation("wag", false, true, "idle")
}

export function tickDogRuntime(
  runtime: DogRuntime,
  dt: number,
  options: {
    grid: RoomGrid
    hero: ActorVisualState
    heroMoving: boolean
    pause: boolean
    escortMode: boolean
    patrolPredicate?: (point: RoomPoint, grid: RoomGrid) => boolean
  }
) {
  if (runtime.bubbleRemaining > 0) {
    runtime.bubbleRemaining = Math.max(0, runtime.bubbleRemaining - dt)
    if (runtime.bubbleRemaining === 0) {
      runtime.bubble = null
    }
  }

  if (runtime.wagRemaining > 0) {
    runtime.wagRemaining = Math.max(0, runtime.wagRemaining - dt)
  }

  if (options.pause) {
    runtime.visual.moving = false
    runtime.animation = createAnimation(runtime.wagRemaining > 0 ? "wag" : "idle", false, runtime.wagRemaining > 0, "idle")
    return runtime
  }

  const heroDistance = distance(roundPoint(options.hero), roundPoint(runtime.currentTile))
  const shouldFollow = options.escortMode || heroDistance > 3.2 || (options.heroMoving && heroDistance > 2.1)

  if (!runtime.path && shouldFollow) {
    const target = chooseNearbyHeroTile(options.grid, runtime, options.hero, options.patrolPredicate)
    if (target) {
      startPath(runtime, options.grid, target, heroDistance > 4.5 ? RUN_SPEED : WALK_SPEED)
    }
  }

  if (!runtime.path) {
    runtime.wanderCooldown = Math.max(0, runtime.wanderCooldown - dt)
    if (runtime.wanderCooldown === 0 && !shouldFollow) {
      const candidates = listWalkableTiles(options.grid, (point) => {
        if (options.patrolPredicate) return options.patrolPredicate(point, options.grid)
        return point.x >= 2 && point.x <= options.grid.cols - 3 && point.y >= 2 && point.y <= options.grid.rows - 3
      })
      const farEnough = candidates.filter((point) => distance(point, runtime.currentTile) >= 2.5)
      const nextTarget = farEnough[Math.floor(Math.random() * farEnough.length)] ?? candidates[0]
      if (nextTarget) {
        startPath(runtime, options.grid, nextTarget, WALK_SPEED)
      }
      runtime.wanderCooldown = randomBetween(0.8, 1.8)
    }
  }

  if (!runtime.path) {
    runtime.visual = {
      x: runtime.currentTile.x,
      y: runtime.currentTile.y,
      facing: runtime.visual.facing,
      moving: false,
    }
    runtime.animation = createAnimation(runtime.wagRemaining > 0 ? "wag" : "idle", false, runtime.wagRemaining > 0, "idle")
    return runtime
  }

  runtime.path.progress += runtime.path.speed * dt
  const maxProgress = runtime.path.nodes.length - 1

  if (runtime.path.progress >= maxProgress) {
    const lastNode = runtime.path.nodes[runtime.path.nodes.length - 1]
    runtime.currentTile = {
      x: lastNode.x,
      y: lastNode.y,
      facing: runtime.visual.facing,
    }
    runtime.visual = {
      ...runtime.currentTile,
      moving: false,
    }
    runtime.path = null
    runtime.animation = createAnimation(runtime.wagRemaining > 0 ? "wag" : "idle", false, runtime.wagRemaining > 0, "idle")
    return runtime
  }

  const segmentIndex = Math.min(Math.floor(runtime.path.progress), runtime.path.nodes.length - 2)
  const startNode = runtime.path.nodes[segmentIndex]
  const endNode = runtime.path.nodes[segmentIndex + 1]
  const t = runtime.path.progress - segmentIndex
  const dx = endNode.x - startNode.x

  runtime.visual = {
    x: startNode.x + dx * t,
    y: startNode.y + (endNode.y - startNode.y) * t,
    facing: setFacing(runtime.visual.facing, dx),
    moving: true,
  }

  runtime.currentTile = {
    x: Math.round(runtime.visual.x),
    y: Math.round(runtime.visual.y),
    facing: runtime.visual.facing,
  }
  runtime.animation = createAnimation(runtime.path.speed > WALK_SPEED ? "follow" : "patrol", true, runtime.wagRemaining > 0, runtime.path.speed > WALK_SPEED ? "run" : "walk")
  return runtime
}
