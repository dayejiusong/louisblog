import { aStar } from "../../lib/pathfinding.ts"
import { findNearestWalkableTile, roomGridIndex, type RoomGrid, type RoomPoint } from "../../lib/room-grid.ts"
import type { ActorTileState, ActorVisualState, DogAnimationState } from "../types.ts"

type DogPathState = {
  nodes: RoomPoint[]
  progress: number
  speed: number
  target: RoomPoint
}

export type DogRuntime = {
  currentTile: ActorTileState
  visual: ActorVisualState
  bubble: string | null
  animation: DogAnimationState
  path: DogPathState | null
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

function getFollowOffsets(facing: ActorTileState["facing"]) {
  switch (facing) {
    case "N":
      return [
        { x: 0, y: 1 },
        { x: -1, y: 1 },
        { x: 1, y: 1 },
        { x: 0, y: 2 },
      ]
    case "S":
      return [
        { x: 0, y: -1 },
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: 0, y: -2 },
      ]
    case "E":
      return [
        { x: -1, y: 0 },
        { x: -1, y: -1 },
        { x: -1, y: 1 },
        { x: -2, y: 0 },
      ]
    default:
      return [
        { x: 1, y: 0 },
        { x: 1, y: -1 },
        { x: 1, y: 1 },
        { x: 2, y: 0 },
      ]
  }
}

function chooseFollowTile(grid: RoomGrid, dog: DogRuntime, hero: ActorVisualState) {
  const heroPoint = roundPoint(hero)
  const dogPoint = roundPoint(dog.currentTile)
  const candidates = getFollowOffsets(hero.facing).map((offset) => ({
    x: heroPoint.x + offset.x,
    y: heroPoint.y + offset.y,
  }))

  const walkable = candidates
    .filter((point) => point.x >= 0 && point.y >= 0 && point.x < grid.cols && point.y < grid.rows)
    .filter((point) => grid.walkable[roomGridIndex(point.x, point.y, grid.cols)])
    .sort((left, right) => distance(left, dogPoint) - distance(right, dogPoint))

  if (walkable[0]) return walkable[0]

  return findNearestWalkableTile(
    {
      x: heroPoint.x,
      y: heroPoint.y + (hero.facing === "N" ? 1 : hero.facing === "S" ? -1 : 0),
    },
    grid
  )
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
    target: goal,
  }

  const nextNode = path[1]
  runtime.visual.facing = setFacing(runtime.visual.facing, nextNode.x - start.x)
  runtime.animation = createAnimation("follow", true, runtime.wagRemaining > 0, speed > WALK_SPEED ? "run" : "walk")
  return true
}

export function createDogRuntime(spawn: ActorTileState): DogRuntime {
  return {
    currentTile: { ...spawn },
    visual: { ...spawn, moving: false },
    bubble: null,
    animation: createAnimation("idle", false, false, "idle"),
    path: null,
    bubbleRemaining: 0,
    wagRemaining: 0,
  }
}

export function placeDogNearHero(runtime: DogRuntime, hero: ActorTileState, grid: RoomGrid) {
  const visualHero: ActorVisualState = {
    x: hero.x,
    y: hero.y,
    facing: hero.facing,
    moving: false,
  }
  const target = chooseFollowTile(grid, runtime, visualHero)
  runtime.currentTile = {
    x: target.x,
    y: target.y,
    facing: hero.facing,
  }
  runtime.visual = {
    x: target.x,
    y: target.y,
    facing: hero.facing,
    moving: false,
  }
  runtime.path = null
  runtime.animation = createAnimation(runtime.wagRemaining > 0 ? "wag" : "idle", false, runtime.wagRemaining > 0, "idle")
}

export function triggerDogInteraction(runtime: DogRuntime) {
  runtime.bubble = "汪！"
  runtime.bubbleRemaining = 1
  runtime.wagRemaining = 0.68
  runtime.animation = createAnimation("wag", Boolean(runtime.path), true, runtime.path ? runtime.animation.speed : "idle")
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

  const heroPoint = roundPoint(options.hero)
  const heroDistance = distance(heroPoint, roundPoint(runtime.currentTile))
  const desiredTile = chooseFollowTile(options.grid, runtime, options.hero)
  const shouldRun = options.escortMode || heroDistance > 4.5
  const desiredSpeed = shouldRun ? RUN_SPEED : WALK_SPEED

  if (
    runtime.path &&
    (runtime.path.target.x !== desiredTile.x || runtime.path.target.y !== desiredTile.y) &&
    (options.heroMoving || heroDistance > 2.4)
  ) {
    startPath(runtime, options.grid, desiredTile, desiredSpeed)
  }

  if (!runtime.path && distance(roundPoint(runtime.currentTile), desiredTile) > 0.1) {
    startPath(runtime, options.grid, desiredTile, desiredSpeed)
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
  runtime.animation = createAnimation("follow", true, runtime.wagRemaining > 0, runtime.path.speed > WALK_SPEED ? "run" : "walk")
  return runtime
}
