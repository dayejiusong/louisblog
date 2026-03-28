"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react"
import { aStar } from "@/lib/pathfinding"
import { findNearestWalkableTile, listWalkableTiles, roomGridIndex, type RoomGrid, type RoomPoint } from "@/lib/room-grid"
import type { RoomAvatarState } from "@/lib/room-session"

export type DogBehavior = "idle" | "patrol" | "sniff" | "observe" | "follow" | "wag" | "burst"

export type DogBubbleState = {
  text: string
}

export type DogAnimationState = {
  phase: DogBehavior
  moving: boolean
  wagging: boolean
  sniffing: boolean
  speed: "idle" | "walk" | "run"
  alert: boolean
}

export type DogNpcState = {
  currentTile: RoomAvatarState
  bubble: DogBubbleState | null
  animation: DogAnimationState
}

type DogPathState = {
  nodes: RoomPoint[]
  progress: number
  speed: number
  phase: "patrol" | "follow" | "burst"
}

type Options = {
  grid: RoomGrid
  modalOpen: boolean
  inspectFlash: boolean
  heroTile: RoomAvatarState
  heroMoving: boolean
  heroVisualRef: MutableRefObject<RoomAvatarState>
  spawnTile?: RoomAvatarState
  zoneKey?: string
  patrolPredicate?: (point: RoomPoint, grid: RoomGrid) => boolean
  escortMode?: boolean
}

const WALK_SPEED = 3.55
const RUN_SPEED = 5.4
const DOG_SPAWN: RoomAvatarState = { x: 7, y: 8, facing: "E" }
const BUBBLE_DURATION_SECONDS = 1
const WAG_DURATION_SECONDS = 0.68

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function randomChoice<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function roundPoint(point: { x: number; y: number }) {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  }
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function setFacing(currentFacing: RoomAvatarState["facing"], dx: number) {
  if (dx > 0) return "E" as const
  if (dx < 0) return "W" as const
  return currentFacing === "W" ? "W" : "E"
}

function defaultAnimation(): DogAnimationState {
  return {
    phase: "idle",
    moving: false,
    wagging: false,
    sniffing: false,
    speed: "idle",
    alert: false,
  }
}

export function useDogNpc({
  grid,
  modalOpen,
  inspectFlash,
  heroTile,
  heroMoving,
  heroVisualRef,
  spawnTile: spawnOverride,
  zoneKey,
  patrolPredicate,
  escortMode = false,
}: Options) {
  const spawnTile = useMemo(() => {
    const baseSpawn = spawnOverride ?? DOG_SPAWN
    const tile = findNearestWalkableTile(baseSpawn, grid)
    return {
      x: tile.x,
      y: tile.y,
      facing: baseSpawn.facing,
    } satisfies RoomAvatarState
  }, [grid, spawnOverride])

  const patrolTiles = useMemo(() => {
    const centralTiles = listWalkableTiles(grid, (point) => {
      if (patrolPredicate) return patrolPredicate(point, grid)
      return point.x >= 3 && point.x <= grid.cols - 4 && point.y >= 2 && point.y <= grid.rows - 3
    })
    return centralTiles.length ? centralTiles : listWalkableTiles(grid)
  }, [grid, patrolPredicate])

  const [state, setState] = useState<DogNpcState>({
    currentTile: spawnTile,
    bubble: null,
    animation: defaultAnimation(),
  })

  const visualRef = useRef<RoomAvatarState>(spawnTile)
  const currentTileRef = useRef<RoomAvatarState>(spawnTile)
  const pathRef = useRef<DogPathState | null>(null)
  const behaviorRef = useRef<DogBehavior>("idle")
  const behaviorTimerRef = useRef(randomBetween(0.55, 1.2))
  const followCooldownRef = useRef(0)
  const wagTimerRef = useRef(0)
  const bubbleTimerRef = useRef(0)
  const burstQueuedRef = useRef(false)

  const syncAnimation = useCallback((next: DogAnimationState) => {
    setState((current) => {
      const previous = current.animation
      if (
        previous.phase === next.phase &&
        previous.moving === next.moving &&
        previous.wagging === next.wagging &&
        previous.sniffing === next.sniffing &&
        previous.speed === next.speed &&
        previous.alert === next.alert
      ) {
        return current
      }

      return {
        ...current,
        animation: next,
      }
    })
  }, [])

  const syncBubble = useCallback((nextBubble: DogBubbleState | null) => {
    setState((current) => {
      if (current.bubble?.text === nextBubble?.text) return current
      return {
        ...current,
        bubble: nextBubble,
      }
    })
  }, [])

  const setBehavior = useCallback(
    (phase: DogBehavior, duration = 0) => {
      behaviorRef.current = phase
      behaviorTimerRef.current = duration

      syncAnimation({
        phase,
        moving: phase === "patrol" || phase === "follow" || phase === "burst",
        wagging: phase === "wag" || phase === "burst" || wagTimerRef.current > 0,
        sniffing: phase === "sniff",
        speed: phase === "burst" ? "run" : phase === "patrol" || phase === "follow" ? "walk" : "idle",
        alert: phase === "observe" || phase === "follow" || phase === "burst",
      })
    },
    [syncAnimation]
  )

  const findPathTo = useCallback(
    (start: RoomPoint, target: RoomPoint) =>
      aStar(start, target, grid.cols, grid.rows, (x, y) => grid.walkable[roomGridIndex(x, y, grid.cols)]),
    [grid]
  )

  const startPath = useCallback(
    (target: RoomPoint, phase: "patrol" | "follow" | "burst", speed: number) => {
      const start = roundPoint(currentTileRef.current)
      const goal = findNearestWalkableTile(target, grid)
      if (goal.x === start.x && goal.y === start.y) return false

      const path = findPathTo(start, goal)
      if (path.length <= 1) return false

      pathRef.current = {
        nodes: path,
        progress: 0,
        speed,
        phase,
      }

      const nextNode = path[1]
      visualRef.current = {
        ...visualRef.current,
        facing: setFacing(visualRef.current.facing, nextNode.x - start.x),
      }

      setBehavior(phase)
      return true
    },
    [findPathTo, grid, setBehavior]
  )

  const chooseNearbyHeroTile = useCallback(() => {
    const hero = roundPoint(heroVisualRef.current)
    const candidates = patrolTiles
      .filter((point) => {
        const heroDistance = distance(point, hero)
        const dogDistance = distance(point, currentTileRef.current)
        return heroDistance >= 2 && heroDistance <= 4.5 && dogDistance >= 1
      })
      .sort((left, right) => {
        const leftScore = Math.abs(distance(left, hero) - 2.75) + distance(left, currentTileRef.current) * 0.15
        const rightScore = Math.abs(distance(right, hero) - 2.75) + distance(right, currentTileRef.current) * 0.15
        return leftScore - rightScore
      })

    return candidates[0] ?? null
  }, [heroVisualRef, patrolTiles])

  const maybeStartFollow = useCallback(() => {
    if (followCooldownRef.current > 0) return false

    const hero = roundPoint(heroVisualRef.current)
    const dog = roundPoint(currentTileRef.current)
    const heroDistance = distance(hero, dog)
    if (heroDistance < 3 || heroDistance > 9.5) return false
    if (!heroMoving && heroDistance < 4.6) return false

    const target = chooseNearbyHeroTile()
    if (!target) return false
    if (!startPath(target, "follow", WALK_SPEED)) return false

    followCooldownRef.current = heroMoving ? 0.35 : 0.7
    return true
  }, [chooseNearbyHeroTile, heroMoving, heroVisualRef, startPath])

  const maybeStartPatrol = useCallback(() => {
    const start = roundPoint(currentTileRef.current)

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const candidate = randomChoice(patrolTiles)
      if (!candidate) continue
      if (distance(candidate, start) < 3.2) continue

      if (startPath(candidate, "patrol", WALK_SPEED)) {
        return true
      }
    }

    return false
  }, [patrolTiles, startPath])

  const queueBurst = useCallback(() => {
    const heroTarget = chooseNearbyHeroTile()
    if (heroTarget && startPath(heroTarget, "burst", RUN_SPEED)) {
      burstQueuedRef.current = false
      return true
    }

    const fallback = patrolTiles
      .filter((point) => distance(point, currentTileRef.current) >= 2 && distance(point, heroTile) >= 2)
      .sort((left, right) => distance(left, currentTileRef.current) - distance(right, currentTileRef.current))[0]

    if (fallback && startPath(fallback, "burst", RUN_SPEED)) {
      burstQueuedRef.current = false
      return true
    }

    return false
  }, [chooseNearbyHeroTile, heroTile, patrolTiles, startPath])

  useEffect(() => {
    visualRef.current = spawnTile
    currentTileRef.current = spawnTile
    pathRef.current = null
    behaviorRef.current = "idle"
    behaviorTimerRef.current = randomBetween(0.55, 1.2)
    followCooldownRef.current = 0
    wagTimerRef.current = 0
    bubbleTimerRef.current = 0
    burstQueuedRef.current = false
    setState({
      currentTile: spawnTile,
      bubble: null,
      animation: defaultAnimation(),
    })
  }, [spawnTile, zoneKey])

  const handleClick = useCallback(() => {
    pathRef.current = null
    currentTileRef.current = {
      x: Math.round(visualRef.current.x),
      y: Math.round(visualRef.current.y),
      facing: visualRef.current.facing,
    }
    visualRef.current = currentTileRef.current
    wagTimerRef.current = WAG_DURATION_SECONDS
    bubbleTimerRef.current = BUBBLE_DURATION_SECONDS
    burstQueuedRef.current = true
    syncBubble({ text: "汪！" })
    setBehavior("wag", WAG_DURATION_SECONDS)
  }, [setBehavior, syncBubble])

  const finishBehavior = useCallback(() => {
    switch (behaviorRef.current) {
      case "wag":
        if (burstQueuedRef.current && queueBurst()) {
          return
        }
        setBehavior("observe", randomBetween(0.35, 0.7))
        return
      case "sniff":
        setBehavior("observe", randomBetween(0.28, 0.55))
        return
      case "observe":
        if (maybeStartFollow()) return
        if (Math.random() > 0.4 && maybeStartPatrol()) return
        setBehavior("idle", randomBetween(0.45, 1))
        return
      case "idle":
      default:
        if (maybeStartFollow()) return
        if (Math.random() > 0.25 && maybeStartPatrol()) return
        setBehavior(Math.random() > 0.5 ? "sniff" : "observe", randomBetween(0.45, 1.15))
        return
    }
  }, [maybeStartFollow, maybeStartPatrol, queueBurst, setBehavior])

  const tick = useCallback(
    (dt: number) => {
      if (modalOpen || inspectFlash) {
        return visualRef.current
      }

      if (bubbleTimerRef.current > 0) {
        bubbleTimerRef.current = Math.max(0, bubbleTimerRef.current - dt)
        if (bubbleTimerRef.current === 0) {
          syncBubble(null)
        }
      }

      if (followCooldownRef.current > 0) {
        followCooldownRef.current = Math.max(0, followCooldownRef.current - dt)
      }

      if (wagTimerRef.current > 0) {
        wagTimerRef.current = Math.max(0, wagTimerRef.current - dt)
      }

      if (escortMode && !pathRef.current) {
        const heroDistance = distance(roundPoint(heroVisualRef.current), roundPoint(currentTileRef.current))
        if (heroDistance > 2.1) {
          const escortTarget = chooseNearbyHeroTile()
          if (escortTarget) {
            startPath(escortTarget, heroDistance > 4.4 ? "burst" : "follow", heroDistance > 4.4 ? RUN_SPEED : WALK_SPEED)
          }
        }
      }

      const path = pathRef.current
      if (path) {
        path.progress += path.speed * dt
        const maxProgress = path.nodes.length - 1

        if (path.progress >= maxProgress) {
          const lastNode = path.nodes[path.nodes.length - 1]
          const restingDog: RoomAvatarState = {
            x: lastNode.x,
            y: lastNode.y,
            facing: visualRef.current.facing,
          }

          visualRef.current = restingDog
          currentTileRef.current = restingDog
          pathRef.current = null

          setState((current) => ({
            ...current,
            currentTile: restingDog,
          }))

          if (path.phase === "burst") {
            setBehavior("observe", randomBetween(0.25, 0.5))
          } else if (path.phase === "follow") {
            setBehavior("observe", randomBetween(0.3, 0.7))
          } else {
            setBehavior(Math.random() > 0.45 ? "sniff" : "observe", randomBetween(0.45, 1.05))
          }

          return restingDog
        }

        const segmentIndex = Math.min(Math.floor(path.progress), path.nodes.length - 2)
        const startNode = path.nodes[segmentIndex]
        const endNode = path.nodes[segmentIndex + 1]
        if (!startNode || !endNode) {
          pathRef.current = null
          setBehavior("idle", randomBetween(0.35, 0.8))
          return visualRef.current
        }

        const t = path.progress - segmentIndex
        const dx = endNode.x - startNode.x
        visualRef.current = {
          x: startNode.x + dx * t,
          y: startNode.y + (endNode.y - startNode.y) * t,
          facing: setFacing(visualRef.current.facing, dx),
        }

        return visualRef.current
      }

      behaviorTimerRef.current = Math.max(0, behaviorTimerRef.current - dt)
      if (behaviorTimerRef.current === 0) {
        finishBehavior()
      }

      return visualRef.current
    },
    [chooseNearbyHeroTile, escortMode, finishBehavior, heroVisualRef, inspectFlash, modalOpen, setBehavior, startPath, syncBubble]
  )

  return {
    dogVisualRef: visualRef,
    dogState: state,
    onInteractDog: handleClick,
    tickDog: tick,
  }
}
