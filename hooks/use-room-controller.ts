"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { aStar } from "@/lib/pathfinding"
import type { RoomHotspot, SectionSlug } from "@/lib/blog-content"
import {
  buildRoomGrid,
  clampTileToInterior,
  findNearestWalkableTile,
  roomGridIndex,
  type RoomPoint,
} from "@/lib/room-grid"
import { saveRoomAvatarState, type RoomAvatarState } from "@/lib/room-session"

export type BubbleState = {
  text: string
  expiresAt: number
}

export type RoomControllerState = {
  currentTile: RoomAvatarState
  hoverHotspotId: SectionSlug | null
  linkedHotspotId: SectionSlug | null
  bubble: BubbleState | null
  inspectFlash: boolean
}

type PathState = {
  nodes: RoomPoint[]
  progress: number
}

type Options = {
  initialAvatar: RoomAvatarState
  hotspots: RoomHotspot[]
  modalOpen: boolean
  activeSection: SectionSlug | null
  onOpenSection: (slug: SectionSlug) => void
  onPrimeAudio: () => Promise<void>
  onPlaySound: (event: "hover" | "confirm" | "blocked" | "open") => void
}

const SPEED = 3.6

function roundAvatar(state: RoomAvatarState) {
  return {
    x: Math.round(state.x),
    y: Math.round(state.y),
    facing: state.facing,
  }
}

export function useRoomController({
  initialAvatar,
  hotspots,
  modalOpen,
  activeSection,
  onOpenSection,
  onPrimeAudio,
  onPlaySound,
}: Options) {
  const [currentTile, setCurrentTile] = useState(initialAvatar)
  const [hoverHotspotId, setHoverHotspotId] = useState<SectionSlug | null>(null)
  const [bubble, setBubble] = useState<BubbleState | null>(null)
  const [inspectFlash, setInspectFlash] = useState(false)

  const grid = useMemo(() => buildRoomGrid(hotspots), [hotspots])
  const hotspotMap = useMemo(() => new Map(hotspots.map((hotspot) => [hotspot.id, hotspot])), [hotspots])
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
  const pendingHotspotRef = useRef<RoomHotspot | null>(null)
  const bubbleRef = useRef<BubbleState | null>(null)
  const openTimerRef = useRef<number | null>(null)
  const hasQueuedInteractionRef = useRef(false)

  useEffect(() => {
    if (hasQueuedInteractionRef.current) return
    avatarVisualRef.current = sanitizedInitialAvatar
    pathRef.current = null
    pendingHotspotRef.current = null
    setCurrentTile(sanitizedInitialAvatar)
  }, [sanitizedInitialAvatar])

  useEffect(() => {
    bubbleRef.current = bubble
  }, [bubble])

  useEffect(() => {
    return () => {
      if (openTimerRef.current) {
        window.clearTimeout(openTimerRef.current)
      }
    }
  }, [])

  const showBubble = useCallback((text: string, duration = 1800) => {
    const nextBubble = { text, expiresAt: Date.now() + duration }
    bubbleRef.current = nextBubble
    setBubble(nextBubble)
  }, [])

  const updateHoverHotspot = useCallback(
    (hotspotId: SectionSlug | null) => {
      setHoverHotspotId((current) => {
        if (current !== hotspotId && hotspotId) {
          onPlaySound("hover")
        }
        return hotspotId
      })
    },
    [onPlaySound]
  )

  const queueMove = useCallback(
    async (target: RoomPoint, hotspot?: RoomHotspot | null) => {
      if (modalOpen || inspectFlash) return

      void onPrimeAudio().catch(() => undefined)
      const start = roundAvatar(avatarVisualRef.current)
      const goal = clampTileToInterior(target, grid)

      if (!grid.walkable[roomGridIndex(goal.x, goal.y, grid.cols)]) {
        if (hotspot) {
          onPlaySound("blocked")
          showBubble("这里被家具挡住了。")
        }
        return
      }

      const path = aStar(start, goal, grid.cols, grid.rows, (x, y) => grid.walkable[roomGridIndex(x, y, grid.cols)])
      if (path.length <= 1) {
        if (hotspot) {
          onPlaySound("blocked")
          showBubble("暂时走不过去。")
        }
        return
      }

      if (hotspot) {
        onPlaySound("confirm")
      }

      hasQueuedInteractionRef.current = true
      pendingHotspotRef.current = hotspot ?? null
      pathRef.current = { nodes: path, progress: 0 }
      const nextNode = path[1]
      const dx = nextNode.x - start.x
      const dy = nextNode.y - start.y
      avatarVisualRef.current = {
        ...avatarVisualRef.current,
        facing: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "E" : "W") : dy > 0 ? "S" : "N",
      }
    },
    [grid, inspectFlash, modalOpen, onPlaySound, onPrimeAudio, showBubble]
  )

  const queueGroundMove = useCallback(
    async (target: RoomPoint) => {
      await queueMove(target, null)
    },
    [queueMove]
  )

  const queueHotspot = useCallback(
    async (hotspotId: SectionSlug) => {
      const hotspot = hotspotMap.get(hotspotId)
      if (!hotspot) return
      showBubble(hotspot.hint, 2000)
      await queueMove(hotspot.interactionTile, hotspot)
    },
    [hotspotMap, queueMove, showBubble]
  )

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
        saveRoomAvatarState(restingAvatar)

        const hotspot = pendingHotspotRef.current
        if (hotspot && lastNode.x === hotspot.interactionTile.x && lastNode.y === hotspot.interactionTile.y) {
          pendingHotspotRef.current = null
          setInspectFlash(true)
          openTimerRef.current = window.setTimeout(() => {
            setInspectFlash(false)
            onOpenSection(hotspot.id)
          }, 220)
        } else {
          pendingHotspotRef.current = null
        }

        return restingAvatar
      }

      const segmentIndex = Math.min(Math.floor(path.progress), path.nodes.length - 2)
      const startNode = path.nodes[segmentIndex]
      const endNode = path.nodes[segmentIndex + 1]
      if (!startNode || !endNode) {
        pathRef.current = null
        pendingHotspotRef.current = null
        hasQueuedInteractionRef.current = false
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
    [onOpenSection]
  )

  const linkedHotspotId = activeSection ?? pendingHotspotRef.current?.id ?? hoverHotspotId

  return {
    state: {
      currentTile,
      hoverHotspotId,
      linkedHotspotId,
      bubble,
      inspectFlash,
    } satisfies RoomControllerState,
    avatarVisualRef,
    grid,
    queueGroundMove,
    queueHotspot,
    updateHoverHotspot,
    tick,
  }
}
