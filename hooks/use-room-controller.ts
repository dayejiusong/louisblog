"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { aStar } from "@/lib/pathfinding"
import type { RoomHotspot, SectionSlug } from "@/lib/blog-content"
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

type PathNode = {
  x: number
  y: number
}

type PathState = {
  nodes: PathNode[]
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

const ROOM_COLS = 20
const ROOM_ROWS = 16
const SPEED = 3.6

function idx(x: number, y: number, cols: number) {
  return y * cols + x
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function roundAvatar(state: RoomAvatarState) {
  return {
    x: Math.round(state.x),
    y: Math.round(state.y),
    facing: state.facing,
  }
}

function buildWalkable(hotspots: RoomHotspot[]) {
  const walkable = new Array(ROOM_COLS * ROOM_ROWS).fill(true)
  const block = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < ROOM_COLS && y < ROOM_ROWS) {
      walkable[idx(x, y, ROOM_COLS)] = false
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

  ;[
    [6, 11],
    [7, 11],
    [8, 11],
    [11, 10],
    [12, 10],
    [16, 4],
  ].forEach(([x, y]) => block(x, y))

  return walkable
}

function findNearestWalkableNode(target: PathNode, walkable: boolean[]) {
  const start = {
    x: clamp(Math.round(target.x), 1, ROOM_COLS - 2),
    y: clamp(Math.round(target.y), 1, ROOM_ROWS - 2),
  }

  if (walkable[idx(start.x, start.y, ROOM_COLS)]) {
    return start
  }

  const queue: PathNode[] = [start]
  const visited = new Set<string>([`${start.x},${start.y}`])

  while (queue.length) {
    const current = queue.shift()
    if (!current) break

    for (const [nx, ny] of [
      [current.x + 1, current.y],
      [current.x - 1, current.y],
      [current.x, current.y + 1],
      [current.x, current.y - 1],
    ]) {
      if (nx < 1 || ny < 1 || nx > ROOM_COLS - 2 || ny > ROOM_ROWS - 2) continue
      const key = `${nx},${ny}`
      if (visited.has(key)) continue
      if (walkable[idx(nx, ny, ROOM_COLS)]) {
        return { x: nx, y: ny }
      }
      visited.add(key)
      queue.push({ x: nx, y: ny })
    }
  }

  return start
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

  const walkable = useMemo(() => buildWalkable(hotspots), [hotspots])
  const hotspotMap = useMemo(() => new Map(hotspots.map((hotspot) => [hotspot.id, hotspot])), [hotspots])
  const sanitizedInitialAvatar = useMemo(() => {
    const nearest = findNearestWalkableNode(initialAvatar, walkable)
    return {
      x: nearest.x,
      y: nearest.y,
      facing: initialAvatar.facing,
    } satisfies RoomAvatarState
  }, [initialAvatar, walkable])

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
    async (target: PathNode, hotspot?: RoomHotspot | null) => {
      if (modalOpen || inspectFlash) return

      void onPrimeAudio().catch(() => undefined)
      const start = roundAvatar(avatarVisualRef.current)
      const goal = {
        x: clamp(target.x, 1, ROOM_COLS - 2),
        y: clamp(target.y, 1, ROOM_ROWS - 2),
      }

      if (!walkable[idx(goal.x, goal.y, ROOM_COLS)]) {
        if (hotspot) {
          onPlaySound("blocked")
          showBubble("这里被家具挡住了。")
        }
        return
      }

      const path = aStar(start, goal, ROOM_COLS, ROOM_ROWS, (x, y) => walkable[idx(x, y, ROOM_COLS)])
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
    [inspectFlash, modalOpen, onPlaySound, onPrimeAudio, showBubble, walkable]
  )

  const queueGroundMove = useCallback(
    async (target: PathNode) => {
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
    [onOpenSection, onPlaySound]
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
    queueGroundMove,
    queueHotspot,
    updateHoverHotspot,
    tick,
  }
}
