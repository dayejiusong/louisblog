"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { aStar } from "@/lib/pathfinding"
import { buildOutpostGrid } from "@/lib/outpost-grid"
import { clampTileToInterior, findNearestWalkableTile, roomGridIndex, type RoomPoint } from "@/lib/room-grid"
import { saveOutpostAvatarState, type RoomAvatarState } from "@/lib/room-session"

export type OutpostBubbleState = {
  text: string
  expiresAt: number
}

export type OutpostControllerState = {
  currentTile: RoomAvatarState
  hoverReturn: boolean
  linkedReturn: boolean
  bubble: OutpostBubbleState | null
  transitionFlash: boolean
  isMoving: boolean
}

type PathState = {
  nodes: RoomPoint[]
  progress: number
}

type PendingAction = "return" | null

type Options = {
  initialAvatar: RoomAvatarState
  returnTile: RoomPoint
  locked: boolean
  onReturn: () => void
  onPrimeAudio: () => Promise<void>
  onPlaySound: (event: "hover" | "confirm" | "blocked" | "open") => void
}

const SPEED = 3.8

function roundAvatar(state: RoomAvatarState) {
  return {
    x: Math.round(state.x),
    y: Math.round(state.y),
    facing: state.facing,
  }
}

export function useOutpostController({
  initialAvatar,
  returnTile,
  locked,
  onReturn,
  onPrimeAudio,
  onPlaySound,
}: Options) {
  const [currentTile, setCurrentTile] = useState(initialAvatar)
  const [hoverReturn, setHoverReturn] = useState(false)
  const [bubble, setBubble] = useState<OutpostBubbleState | null>(null)
  const [transitionFlash, setTransitionFlash] = useState(false)
  const [isMoving, setIsMoving] = useState(false)

  const grid = useMemo(() => buildOutpostGrid(), [])
  const sanitizedInitialAvatar = useMemo(() => {
    const nearest = findNearestWalkableTile(initialAvatar, grid)
    return {
      x: nearest.x,
      y: nearest.y,
      facing: initialAvatar.facing,
    } satisfies RoomAvatarState
  }, [grid, initialAvatar])

  const avatarVisualRef = useRef<RoomAvatarState>(initialAvatar)
  const pathRef = useRef<PathState | null>(null)
  const pendingActionRef = useRef<PendingAction>(null)
  const bubbleRef = useRef<OutpostBubbleState | null>(null)
  const flashTimerRef = useRef<number | null>(null)
  const hasQueuedInteractionRef = useRef(false)

  useEffect(() => {
    if (hasQueuedInteractionRef.current) return
    avatarVisualRef.current = sanitizedInitialAvatar
    pathRef.current = null
    pendingActionRef.current = null
    setCurrentTile(sanitizedInitialAvatar)
    setIsMoving(false)
  }, [sanitizedInitialAvatar])

  useEffect(() => {
    bubbleRef.current = bubble
  }, [bubble])

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current)
      }
    }
  }, [])

  const showBubble = useCallback((text: string, duration = 1800) => {
    const nextBubble = { text, expiresAt: Date.now() + duration }
    bubbleRef.current = nextBubble
    setBubble(nextBubble)
  }, [])

  const updateHoverReturn = useCallback(
    (nextHover: boolean) => {
      setHoverReturn((current) => {
        if (current !== nextHover && nextHover) {
          onPlaySound("hover")
        }
        return nextHover
      })
    },
    [onPlaySound]
  )

  const queueMove = useCallback(
    async (target: RoomPoint, action: PendingAction = null) => {
      if (locked || transitionFlash) return

      void onPrimeAudio().catch(() => undefined)
      const start = roundAvatar(avatarVisualRef.current)
      const goal = clampTileToInterior(target, grid)

      const runImmediateAction = () => {
        if (action !== "return") return
        setTransitionFlash(true)
        flashTimerRef.current = window.setTimeout(() => {
          setTransitionFlash(false)
          onReturn()
        }, 260)
      }

      if (!grid.walkable[roomGridIndex(goal.x, goal.y, grid.cols)]) {
        if (action) {
          onPlaySound("blocked")
          showBubble("The path is blocked.")
        }
        return
      }

      if (goal.x === start.x && goal.y === start.y) {
        runImmediateAction()
        return
      }

      const path = aStar(start, goal, grid.cols, grid.rows, (x, y) => grid.walkable[roomGridIndex(x, y, grid.cols)])
      if (path.length <= 1) {
        if (action) {
          onPlaySound("blocked")
          showBubble("This route is not available.")
        }
        return
      }

      if (action) {
        onPlaySound("confirm")
      }

      hasQueuedInteractionRef.current = true
      pendingActionRef.current = action
      pathRef.current = { nodes: path, progress: 0 }
      setIsMoving(true)
      const nextNode = path[1]
      const dx = nextNode.x - start.x
      const dy = nextNode.y - start.y
      avatarVisualRef.current = {
        ...avatarVisualRef.current,
        facing: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "E" : "W") : dy > 0 ? "S" : "N",
      }
    },
    [grid, locked, onPlaySound, onPrimeAudio, onReturn, showBubble, transitionFlash]
  )

  const queueGroundMove = useCallback(
    async (target: RoomPoint) => {
      await queueMove(target)
    },
    [queueMove]
  )

  const queueReturn = useCallback(async () => {
    showBubble("The room is still glowing behind the rift.", 1800)
    await queueMove(returnTile, "return")
  }, [queueMove, returnTile, showBubble])

  const tick = useCallback(
    (dt: number) => {
      const path = pathRef.current
      if (!path) return avatarVisualRef.current

      path.progress += SPEED * dt
      const maxProgress = path.nodes.length - 1

      if (path.progress >= maxProgress) {
        const lastNode = path.nodes[path.nodes.length - 1]
        const restingAvatar: RoomAvatarState = {
          x: lastNode.x,
          y: lastNode.y,
          facing: avatarVisualRef.current.facing,
        }
        avatarVisualRef.current = restingAvatar
        pathRef.current = null
        hasQueuedInteractionRef.current = false
        setCurrentTile(restingAvatar)
        setIsMoving(false)
        saveOutpostAvatarState(restingAvatar)

        const action = pendingActionRef.current
        pendingActionRef.current = null

        if (action === "return" && lastNode.x === returnTile.x && lastNode.y === returnTile.y) {
          setTransitionFlash(true)
          flashTimerRef.current = window.setTimeout(() => {
            setTransitionFlash(false)
            onReturn()
          }, 260)
        }

        return restingAvatar
      }

      const segmentIndex = Math.min(Math.floor(path.progress), path.nodes.length - 2)
      const startNode = path.nodes[segmentIndex]
      const endNode = path.nodes[segmentIndex + 1]
      if (!startNode || !endNode) {
        pathRef.current = null
        pendingActionRef.current = null
        hasQueuedInteractionRef.current = false
        setIsMoving(false)
        return avatarVisualRef.current
      }

      const t = path.progress - segmentIndex
      const dx = endNode.x - startNode.x
      const dy = endNode.y - startNode.y
      avatarVisualRef.current = {
        x: startNode.x + dx * t,
        y: startNode.y + dy * t,
        facing: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "E" : "W") : dy > 0 ? "S" : "N",
      }
      return avatarVisualRef.current
    },
    [onReturn, returnTile.x, returnTile.y]
  )

  const linkedReturn = pendingActionRef.current === "return" || hoverReturn

  return {
    state: {
      currentTile,
      hoverReturn,
      linkedReturn,
      bubble,
      transitionFlash,
      isMoving,
    } satisfies OutpostControllerState,
    avatarVisualRef,
    grid,
    queueGroundMove,
    queueReturn,
    updateHoverReturn,
    tick,
  }
}
