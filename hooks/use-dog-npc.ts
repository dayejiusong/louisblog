"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { aStar } from "@/lib/pathfinding"
import { findNearestWalkableTile, listWalkableTiles, roomGridIndex, type RoomGrid, type RoomPoint } from "@/lib/room-grid"
import type { RoomAvatarState } from "@/lib/room-session"

export type DogBubbleState = {
  text: string
}

export type DogAnimationState = {
  mode: "idle" | "run" | "wag"
  moving: boolean
  wagging: boolean
}

export type DogNpcState = {
  currentTile: RoomAvatarState
  bubble: DogBubbleState | null
  animation: DogAnimationState
}

type DogPathState = {
  nodes: RoomPoint[]
  progress: number
}

type Options = {
  grid: RoomGrid
  modalOpen: boolean
  inspectFlash: boolean
}

const DOG_SPEED = 4.2
const DOG_SPAWN: RoomAvatarState = { x: 7, y: 8, facing: "E" }
const MIN_IDLE_SECONDS = 0.4
const MAX_IDLE_SECONDS = 1.05
const WAG_DURATION_SECONDS = 0.75
const BUBBLE_DURATION_SECONDS = 1

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function setFacing(currentFacing: RoomAvatarState["facing"], dx: number) {
  if (dx > 0) return "E" as const
  if (dx < 0) return "W" as const
  return currentFacing === "W" ? "W" : "E"
}

export function useDogNpc({ grid, modalOpen, inspectFlash }: Options) {
  const spawnTile = useMemo(() => {
    const tile = findNearestWalkableTile(DOG_SPAWN, grid)
    return {
      x: tile.x,
      y: tile.y,
      facing: DOG_SPAWN.facing,
    } satisfies RoomAvatarState
  }, [grid])

  const patrolTiles = useMemo(() => {
    const centralTiles = listWalkableTiles(grid, (point) => point.x >= 3 && point.x <= grid.cols - 4 && point.y >= 2 && point.y <= grid.rows - 3)
    return centralTiles.length ? centralTiles : listWalkableTiles(grid)
  }, [grid])

  const [state, setState] = useState<DogNpcState>({
    currentTile: spawnTile,
    bubble: null,
    animation: {
      mode: "idle",
      moving: false,
      wagging: false,
    },
  })

  const visualRef = useRef<RoomAvatarState>(spawnTile)
  const currentTileRef = useRef<RoomAvatarState>(spawnTile)
  const pathRef = useRef<DogPathState | null>(null)
  const waitTimerRef = useRef(randomBetween(MIN_IDLE_SECONDS, MAX_IDLE_SECONDS))
  const wagTimerRef = useRef(0)
  const bubbleTimerRef = useRef(0)

  const syncAnimation = useCallback((next: DogAnimationState) => {
    setState((current) => {
      if (
        current.animation.mode === next.mode &&
        current.animation.moving === next.moving &&
        current.animation.wagging === next.wagging
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

  useEffect(() => {
    visualRef.current = spawnTile
    currentTileRef.current = spawnTile
    pathRef.current = null
    waitTimerRef.current = randomBetween(MIN_IDLE_SECONDS, MAX_IDLE_SECONDS)
    wagTimerRef.current = 0
    bubbleTimerRef.current = 0
    setState({
      currentTile: spawnTile,
      bubble: null,
      animation: {
        mode: "idle",
        moving: false,
        wagging: false,
      },
    })
  }, [spawnTile])

  const chooseNextPath = useCallback(() => {
    const start = currentTileRef.current
    if (!patrolTiles.length) return false

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const candidate = patrolTiles[Math.floor(Math.random() * patrolTiles.length)]
      if (!candidate) continue
      if (candidate.x === start.x && candidate.y === start.y) continue

      const path = aStar(start, candidate, grid.cols, grid.rows, (x, y) => grid.walkable[roomGridIndex(x, y, grid.cols)])
      if (path.length <= 1) continue

      pathRef.current = {
        nodes: path,
        progress: 0,
      }
      waitTimerRef.current = 0
      const nextNode = path[1]
      visualRef.current = {
        ...visualRef.current,
        facing: setFacing(visualRef.current.facing, nextNode.x - start.x),
      }
      syncAnimation({
        mode: wagTimerRef.current > 0 ? "wag" : "run",
        moving: true,
        wagging: wagTimerRef.current > 0,
      })
      return true
    }

    waitTimerRef.current = 0.6
    syncAnimation({
      mode: wagTimerRef.current > 0 ? "wag" : "idle",
      moving: false,
      wagging: wagTimerRef.current > 0,
    })
    return false
  }, [grid, patrolTiles, syncAnimation])

  const handleClick = useCallback(() => {
    wagTimerRef.current = WAG_DURATION_SECONDS
    bubbleTimerRef.current = BUBBLE_DURATION_SECONDS
    syncBubble({ text: "汪！" })
    syncAnimation({
      mode: "wag",
      moving: Boolean(pathRef.current),
      wagging: true,
    })
  }, [syncAnimation, syncBubble])

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

      if (wagTimerRef.current > 0) {
        wagTimerRef.current = Math.max(0, wagTimerRef.current - dt)
        if (wagTimerRef.current === 0) {
          syncAnimation({
            mode: pathRef.current ? "run" : "idle",
            moving: Boolean(pathRef.current),
            wagging: false,
          })
        }
      }

      const path = pathRef.current
      if (path) {
        path.progress += DOG_SPEED * dt
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
          waitTimerRef.current = randomBetween(MIN_IDLE_SECONDS, MAX_IDLE_SECONDS)
          syncAnimation({
            mode: wagTimerRef.current > 0 ? "wag" : "idle",
            moving: false,
            wagging: wagTimerRef.current > 0,
          })
          setState((current) => ({
            ...current,
            currentTile: restingDog,
          }))
          return restingDog
        }

        const segmentIndex = Math.min(Math.floor(path.progress), path.nodes.length - 2)
        const startNode = path.nodes[segmentIndex]
        const endNode = path.nodes[segmentIndex + 1]
        if (!startNode || !endNode) {
          pathRef.current = null
          waitTimerRef.current = randomBetween(MIN_IDLE_SECONDS, MAX_IDLE_SECONDS)
          syncAnimation({
            mode: wagTimerRef.current > 0 ? "wag" : "idle",
            moving: false,
            wagging: wagTimerRef.current > 0,
          })
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

      waitTimerRef.current = Math.max(0, waitTimerRef.current - dt)
      if (waitTimerRef.current === 0) {
        chooseNextPath()
      }

      return visualRef.current
    },
    [chooseNextPath, inspectFlash, modalOpen, syncAnimation, syncBubble]
  )

  return {
    dogVisualRef: visualRef,
    dogState: state,
    onInteractDog: handleClick,
    tickDog: tick,
  }
}
