"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react"
import { projectIso, unprojectIso, type IsoProjectParams } from "@/lib/iso"
import type { RoomHotspot, SectionSlug } from "@/lib/blog-content"
import type { BubbleState } from "@/hooks/use-room-controller"
import type { RoomAvatarState } from "@/lib/room-session"

type HitArea = {
  id: SectionSlug
  x: number
  y: number
  w: number
  h: number
}

type Grid = {
  cols: number
  rows: number
  walkable: boolean[]
}

type SceneContext = {
  ctx: CanvasRenderingContext2D
  params: IsoProjectParams
  tileW: number
  tileH: number
  time: number
}

type TilePoint = {
  x: number
  y: number
}

type PendingPointer = {
  relativeX: number
  relativeY: number
}

type Props = {
  focusRef: RefObject<HTMLDivElement | null>
  hotspots: RoomHotspot[]
  interactionReady: boolean
  modalOpen: boolean
  activeSection: SectionSlug | null
  currentTile: RoomAvatarState
  hoverHotspotId: SectionSlug | null
  linkedHotspotId: SectionSlug | null
  bubble: BubbleState | null
  inspectFlash: boolean
  audioEnabled: boolean
  avatarVisualRef: MutableRefObject<RoomAvatarState>
  onMoveToTile: (target: { x: number; y: number }) => void | Promise<void>
  onInteractHotspot: (hotspotId: SectionSlug) => void | Promise<void>
  onHoverHotspot: (hotspotId: SectionSlug | null) => void
  onToggleAudio: () => void
  tick: (dt: number) => RoomAvatarState
}

const ROOM_COLS = 20
const ROOM_ROWS = 16
const TILE_W = 58
const TILE_H = 29
const HOTSPOT_SNAP_DISTANCE = 30

const HITBOXES: Record<SectionSlug, { offsetX: number; offsetY: number; width: number; height: number }> = {
  games: { offsetX: -48, offsetY: -58, width: 96, height: 76 },
  rides: { offsetX: -36, offsetY: -40, width: 80, height: 48 },
  travel: { offsetX: -44, offsetY: -90, width: 88, height: 58 },
  books: { offsetX: -38, offsetY: -74, width: 40, height: 82 },
  music: { offsetX: -28, offsetY: -44, width: 66, height: 54 },
}

function idx(x: number, y: number, cols: number) {
  return y * cols + x
}

function computeCenteredOrigin(width: number, height: number, cols: number, rows: number, tileW: number, tileH: number) {
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
    originY: Math.round(height / 2 - (minY + maxY) / 2) - 8,
  }
}

function buildGrid(hotspots: RoomHotspot[]) {
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

  return {
    cols: ROOM_COLS,
    rows: ROOM_ROWS,
    walkable,
  } satisfies Grid
}

function getHighlightMode(hotspotId: SectionSlug, hoverId: SectionSlug | null, linkedId: SectionSlug | null) {
  if (linkedId === hotspotId) return "active" as const
  if (hoverId === hotspotId) return "hover" as const
  return "idle" as const
}

function pushHitArea(hitAreas: HitArea[], hotspot: RoomHotspot | undefined, point: { px: number; py: number }) {
  if (!hotspot) return
  const hitbox = HITBOXES[hotspot.id]
  hitAreas.push({
    id: hotspot.id,
    x: point.px + hitbox.offsetX,
    y: point.py + hitbox.offsetY,
    w: hitbox.width,
    h: hitbox.height,
  })
}

function clampTile(x: number, y: number, grid: Grid) {
  return {
    x: Math.max(1, Math.min(grid.cols - 2, x)),
    y: Math.max(1, Math.min(grid.rows - 2, y)),
  }
}

function isWalkable(tile: TilePoint, grid: Grid) {
  return grid.walkable[idx(tile.x, tile.y, grid.cols)]
}

function distanceToHitArea(px: number, py: number, area: HitArea) {
  const dx = Math.max(area.x - px, 0, px - (area.x + area.w))
  const dy = Math.max(area.y - py, 0, py - (area.y + area.h))
  return Math.hypot(dx, dy)
}

function findNearestWalkableTile(target: TilePoint, grid: Grid) {
  const start = clampTile(target.x, target.y, grid)
  if (isWalkable(start, grid)) return start

  const queue: TilePoint[] = [start]
  const visited = new Set<string>([`${start.x},${start.y}`])

  while (queue.length) {
    const current = queue.shift()
    if (!current) break

    const neighbors: TilePoint[] = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ]

    for (const neighbor of neighbors) {
      if (neighbor.x < 1 || neighbor.y < 1 || neighbor.x > grid.cols - 2 || neighbor.y > grid.rows - 2) continue
      const key = `${neighbor.x},${neighbor.y}`
      if (visited.has(key)) continue
      if (isWalkable(neighbor, grid)) return neighbor
      visited.add(key)
      queue.push(neighbor)
    }
  }

  return start
}

export default function PersonalRoom({
  focusRef,
  hotspots,
  interactionReady,
  modalOpen,
  activeSection,
  currentTile,
  hoverHotspotId,
  linkedHotspotId,
  bubble,
  inspectFlash,
  audioEnabled,
  avatarVisualRef,
  onMoveToTile,
  onInteractHotspot,
  onHoverHotspot,
  onToggleAudio,
  tick,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hitAreasRef = useRef<HitArea[]>([])
  const hoverRef = useRef<SectionSlug | null>(hoverHotspotId)
  const pendingPointerRef = useRef<PendingPointer | null>(null)
  const sceneReadyRef = useRef(false)
  const sceneStateRef = useRef({
    hoverHotspotId,
    linkedHotspotId,
    bubble,
    inspectFlash,
    modalOpen,
    activeSection,
  })

  const [size, setSize] = useState({ width: 640, height: 780 })
  const [sceneReady, setSceneReady] = useState(false)
  const grid = useMemo(() => buildGrid(hotspots), [hotspots])
  const hotspotMap = useMemo(() => new Map(hotspots.map((hotspot) => [hotspot.id, hotspot])), [hotspots])
  const isInteractionEnabled = interactionReady && sceneReady

  useEffect(() => {
    sceneStateRef.current = {
      hoverHotspotId,
      linkedHotspotId,
      bubble,
      inspectFlash,
      modalOpen,
      activeSection,
    }
    hoverRef.current = hoverHotspotId
  }, [activeSection, bubble, hoverHotspotId, inspectFlash, linkedHotspotId, modalOpen])

  useEffect(() => {
    if (!isInteractionEnabled || modalOpen) return
    focusRef.current?.focus({ preventScroll: true })
  }, [focusRef, isInteractionEnabled, modalOpen])

  useEffect(() => {
    sceneReadyRef.current = false
    setSceneReady(false)
  }, [hotspots, size.height, size.width])

  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const nextWidth = Math.floor(rect.width)
      const nextHeight = Math.max(520, Math.floor(Math.min(rect.width * 0.78, 820)))
      setSize({ width: nextWidth, height: nextHeight })
    })

    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  const handlePointerAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top
    const hit =
      hitAreasRef.current.find((area) => px >= area.x && px <= area.x + area.w && py >= area.y && py <= area.y + area.h) ??
      hitAreasRef.current
        .map((area) => ({ area, distance: distanceToHitArea(px, py, area) }))
        .filter((candidate) => candidate.distance <= HOTSPOT_SNAP_DISTANCE)
        .sort((left, right) => left.distance - right.distance)[0]?.area

    return { px, py, hit }
  }, [])

  const updateHover = useCallback(
    (nextHover: SectionSlug | null) => {
      if (hoverRef.current === nextHover) return
      hoverRef.current = nextHover
      onHoverHotspot(nextHover)
    },
    [onHoverHotspot]
  )

  const triggerInteractionAt = useCallback(
    (clientX: number, clientY: number) => {
      const currentScene = sceneStateRef.current
      if (currentScene.modalOpen || currentScene.inspectFlash) return

      const result = handlePointerAt(clientX, clientY)
      if (!result) return

      if (result.hit) {
        void onInteractHotspot(result.hit.id)
        return
      }

      const origin = computeCenteredOrigin(size.width, size.height, grid.cols, grid.rows, TILE_W, TILE_H)
      const params: IsoProjectParams = {
        tileW: TILE_W,
        tileH: TILE_H,
        originX: origin.originX,
        originY: origin.originY,
      }
      const tile = unprojectIso(result.px, result.py, params)
      const nextTile = findNearestWalkableTile({ x: tile.tx, y: tile.ty }, grid)
      void onMoveToTile(nextTile)
    },
    [grid, handlePointerAt, onInteractHotspot, onMoveToTile, size.height, size.width]
  )

  useEffect(() => {
    if (!isInteractionEnabled || modalOpen || inspectFlash) return
    const pendingPointer = pendingPointerRef.current
    if (!pendingPointer) return

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    pendingPointerRef.current = null
    triggerInteractionAt(
      rect.left + pendingPointer.relativeX * rect.width,
      rect.top + pendingPointer.relativeY * rect.height
    )
  }, [inspectFlash, isInteractionEnabled, modalOpen, triggerInteractionAt])

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const currentScene = sceneStateRef.current
      if (!isInteractionEnabled || currentScene.modalOpen || currentScene.inspectFlash) {
        updateHover(null)
        return
      }

      const result = handlePointerAt(event.clientX, event.clientY)
      updateHover(result?.hit?.id ?? null)
    },
    [handlePointerAt, isInteractionEnabled, updateHover]
  )

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const currentScene = sceneStateRef.current
      focusRef.current?.focus({ preventScroll: true })

      if (!isInteractionEnabled) {
        const canvas = canvasRef.current
        const rect = canvas?.getBoundingClientRect()
        if (rect && rect.width > 0 && rect.height > 0) {
          pendingPointerRef.current = {
            relativeX: (event.clientX - rect.left) / rect.width,
            relativeY: (event.clientY - rect.top) / rect.height,
          }
        }
        return
      }

      if (currentScene.modalOpen || currentScene.inspectFlash) return
      pendingPointerRef.current = null
      triggerInteractionAt(event.clientX, event.clientY)
    },
    [focusRef, isInteractionEnabled, triggerInteractionAt]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let frame = 0
    let lastTime = performance.now()

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now

      const avatarForDraw = tick(dt) || avatarVisualRef.current || currentTile
      const dpr = window.devicePixelRatio || 1

      if (canvas.width !== Math.floor(size.width * dpr) || canvas.height !== Math.floor(size.height * dpr)) {
        canvas.width = Math.floor(size.width * dpr)
        canvas.height = Math.floor(size.height * dpr)
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size.width, size.height)
      ctx.imageSmoothingEnabled = false

      const origin = computeCenteredOrigin(size.width, size.height, grid.cols, grid.rows, TILE_W, TILE_H)
      const params: IsoProjectParams = {
        tileW: TILE_W,
        tileH: TILE_H,
        originX: origin.originX,
        originY: origin.originY,
      }

      const currentScene = sceneStateRef.current
      drawBackground(ctx, size.width, size.height, now * 0.001, currentScene.modalOpen)
      drawFloor(ctx, grid, params, TILE_W, TILE_H)
      drawWalls(ctx, grid, params, TILE_W, TILE_H)
      drawRug(ctx, params)

      hitAreasRef.current = []
      const sceneContext: SceneContext = { ctx, params, tileW: TILE_W, tileH: TILE_H, time: now * 0.001 }
      const scene: Array<{ sort: number; draw: () => void }> = []

      hotspots.forEach((hotspot) => {
        const mode = getHighlightMode(hotspot.id, currentScene.hoverHotspotId, currentScene.linkedHotspotId)

        switch (hotspot.id) {
          case "games":
            scene.push({ sort: hotspot.drawOrder, draw: () => drawDesk(sceneContext, hotspot, mode, hitAreasRef.current) })
            break
          case "books":
            scene.push({
              sort: hotspot.drawOrder,
              draw: () => drawBookshelf(sceneContext, hotspot, mode, hitAreasRef.current),
            })
            break
          case "travel":
            scene.push({
              sort: hotspot.drawOrder,
              draw: () => drawWindow(sceneContext, hotspot, mode, hitAreasRef.current),
            })
            break
          case "rides":
            scene.push({ sort: hotspot.drawOrder, draw: () => drawBike(sceneContext, hotspot, mode, hitAreasRef.current) })
            break
          case "music":
            scene.push({
              sort: hotspot.drawOrder,
              draw: () => drawRecordPlayer(sceneContext, hotspot, mode, hitAreasRef.current),
            })
            break
          default:
            break
        }
      })

      scene.push({ sort: 3.8, draw: () => drawPlant(sceneContext) })
      scene.push({ sort: 4.4, draw: () => drawArmchair(sceneContext) })
      scene.push({ sort: 4.6, draw: () => drawLamp(sceneContext) })
      scene.push({
        sort: avatarForDraw.y + 0.5,
        draw: () => drawAvatar(sceneContext, avatarForDraw, currentTile.x !== avatarForDraw.x || currentTile.y !== avatarForDraw.y),
      })

      scene.sort((a, b) => a.sort - b.sort).forEach((item) => item.draw())

      if (!sceneReadyRef.current && size.width > 0 && size.height > 0 && hitAreasRef.current.length >= hotspots.length) {
        sceneReadyRef.current = true
        setSceneReady(true)
      }

      if (currentScene.bubble && currentScene.bubble.expiresAt > Date.now()) {
        const avatarPoint = projectIso(avatarForDraw.x, avatarForDraw.y, params)
        drawBubble(ctx, avatarPoint.px, avatarPoint.py - 26, currentScene.bubble.text)
      }

      const hudTargetId = currentScene.hoverHotspotId ?? currentScene.linkedHotspotId
      if (hudTargetId) {
        const hudHotspot = hotspotMap.get(hudTargetId)
        if (hudHotspot) {
          drawHudLabel(
            ctx,
            size.width,
            hudHotspot.label,
            currentScene.activeSection ? `已联动到 ${hudHotspot.label}` : hudHotspot.hint,
            hudHotspot.accent
          )
        }
      }

      if (currentScene.inspectFlash) {
        drawInspectFlash(ctx, size.width, size.height, now * 0.001)
      }

      frame = requestAnimationFrame(render)
    }

    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [currentTile.x, currentTile.y, grid, hotspotMap, hotspots, size.height, size.width, tick])

  return (
    <div ref={focusRef} tabIndex={0} className="relative outline-none">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 px-1">
        <div>
          <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[rgba(255,247,226,0.8)]">
            房间交互
          </div>
          <div className="mt-2 text-sm text-[rgba(255,245,220,0.92)]">
            点击或触摸房间物件，角色会先走过去，再打开对应的冒险日志窗。
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="pixel-chip bg-[rgba(255,246,220,0.85)] text-xs">
            {modalOpen
              ? activeSection
                ? `日志 / ${hotspotMap.get(activeSection)?.label ?? "打开中"}`
                : "日志已打开"
              : hoverHotspotId
                ? hotspotMap.get(hoverHotspotId)?.label ?? "房间漫游"
                : `坐标 ${currentTile.x},${currentTile.y}`}
          </div>
          <button type="button" className="pixel-button px-3 py-2 text-xs sm:text-sm" onClick={onToggleAudio}>
            {audioEnabled ? "环境音开" : "环境音关"}
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-[10px] border-[4px] border-[color:var(--game-ink)] bg-[linear-gradient(180deg,#1d3849,#2e5f70_30%,#8c7c58_100%)] shadow-[0_14px_0_rgba(15,10,8,0.3)]"
      >
        <canvas
          ref={canvasRef}
          width={size.width}
          height={size.height}
          className={`pixel-canvas block w-full touch-manipulation ${
            !isInteractionEnabled ? "cursor-wait" : modalOpen ? "cursor-default" : hoverHotspotId ? "cursor-pointer" : "cursor-crosshair"
          }`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => updateHover(null)}
          onPointerUp={handlePointerUp}
        />
        <div className="scanline-overlay pointer-events-none absolute inset-0 opacity-25" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(9,6,4,0.28))]" />
        {!isInteractionEnabled && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[linear-gradient(180deg,rgba(12,10,8,0.15),rgba(12,10,8,0.38))]">
            <div className="pixel-panel max-w-xs text-center">
              <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[color:var(--game-muted)]">房间加载中</div>
              <p className="mt-3 text-sm leading-7 text-[color:var(--game-text)]">正在同步角色位置和房间状态，马上就可以直接点击地板或物件了。</p>
            </div>
          </div>
        )}
        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${
            inspectFlash || modalOpen ? "opacity-100" : "opacity-0"
          } bg-[linear-gradient(180deg,rgba(255,244,205,0.12),rgba(15,9,8,0.52))]`}
        />
      </div>
    </div>
  )
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, dimmed: boolean) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, "#17313d")
  gradient.addColorStop(0.55, "#315b69")
  gradient.addColorStop(1, "#af9561")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = "rgba(255, 255, 255, 0.08)"
  for (let index = 0; index < 6; index += 1) {
    const x = width * 0.16 + index * 110 + Math.sin(time * 0.3 + index) * 8
    const y = 70 + Math.sin(time * 0.5 + index) * 7
    ctx.beginPath()
    ctx.arc(x, y, 28, 0, Math.PI * 2)
    ctx.fill()
  }

  if (dimmed) {
    ctx.fillStyle = "rgba(8, 7, 6, 0.18)"
    ctx.fillRect(0, 0, width, height)
  }
}

function drawFloor(ctx: CanvasRenderingContext2D, grid: Grid, params: IsoProjectParams, tileW: number, tileH: number) {
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.cols; x += 1) {
      const point = projectIso(x, y, params)
      const isEdge = !grid.walkable[idx(x, y, grid.cols)]
      const isEven = (x + y) % 2 === 0
      const fill = isEdge ? "#6d665d" : isEven ? "#b7945e" : "#a78250"
      drawTile(ctx, point.px, point.py, tileW, tileH, fill, "#241914")
    }
  }
}

function drawWalls(ctx: CanvasRenderingContext2D, grid: Grid, params: IsoProjectParams, tileW: number, tileH: number) {
  for (let x = 1; x < grid.cols - 1; x += 1) {
    const point = projectIso(x, 1, params)
    drawRaisedBlock(ctx, point.px, point.py, tileW, tileH, "#cbb28b", "#6d5236")
  }

  for (let y = 2; y < grid.rows - 1; y += 1) {
    const point = projectIso(1, y, params)
    drawRaisedBlock(ctx, point.px, point.py, tileW, tileH, "#b49978", "#6c5136")
  }
}

function drawDesk(context: SceneContext, hotspot: RoomHotspot | undefined, mode: "idle" | "hover" | "active", hitAreas: HitArea[]) {
  const { ctx, params, time } = context
  const point = projectIso(13.5, 3.9, params)
  drawObjectPulse(ctx, point.px + 2, point.py - 26, 52, hotspot?.accent ?? "#67f0ba", mode)
  rect(ctx, point.px - 46, point.py - 24, 76, 18, "#6a4630")
  rect(ctx, point.px - 42, point.py - 6, 8, 28, "#4f3523")
  rect(ctx, point.px + 18, point.py - 6, 8, 28, "#4f3523")
  rect(ctx, point.px - 10, point.py - 54, 36, 28, "#201a18")
  rect(ctx, point.px - 6, point.py - 50, 28, 20, mode === "active" ? "#95ffd5" : mode === "hover" ? "#79f7c5" : "#62c7aa")
  rect(ctx, point.px - 1, point.py - 30, 8, 10, "#3d3a3a")
  circle(ctx, point.px - 28, point.py - 16, 8, "#8d6d48")
  rect(ctx, point.px - 34, point.py - 14, 10, 4, "#7f694b")
  rect(ctx, point.px + 28, point.py - 10, 16, 6, "#2c2522")
  pushHitArea(hitAreas, hotspot, point)

  for (let index = 0; index < 4; index += 1) {
    const y = point.py - 46 + index * 5
    rect(ctx, point.px - 2 + index * 5, y, 2, 12 + Math.sin(time * 4 + index) * 2, "#cdeade")
  }

  if (mode === "active") {
    drawBeacon(ctx, point.px + 8, point.py - 68, hotspot?.accent ?? "#67f0ba")
  }
}

function drawBookshelf(context: SceneContext, hotspot: RoomHotspot | undefined, mode: "idle" | "hover" | "active", hitAreas: HitArea[]) {
  const { ctx, params } = context
  const point = projectIso(1.3, 7.2, params)
  drawObjectPulse(ctx, point.px - 18, point.py - 36, 44, hotspot?.accent ?? "#d2ad6d", mode)
  rect(ctx, point.px - 32, point.py - 70, 28, 68, "#7b5638")
  rect(ctx, point.px - 26, point.py - 64, 16, 8, "#c95c52")
  rect(ctx, point.px - 22, point.py - 50, 14, 8, "#d3a64b")
  rect(ctx, point.px - 25, point.py - 36, 17, 8, "#5a88b6")
  rect(ctx, point.px - 20, point.py - 22, 12, 8, "#78a35d")
  rect(ctx, point.px - 28, point.py - 8, 20, 6, mode === "active" ? "#ffe8a5" : mode === "hover" ? "#f7d89a" : "#ceb177")
  pushHitArea(hitAreas, hotspot, point)

  if (mode === "active") {
    drawBeacon(ctx, point.px - 18, point.py - 82, hotspot?.accent ?? "#d2ad6d")
  }
}

function drawWindow(context: SceneContext, hotspot: RoomHotspot | undefined, mode: "idle" | "hover" | "active", hitAreas: HitArea[]) {
  const { ctx, params, time } = context
  const point = projectIso(9.2, 1.2, params)
  drawObjectPulse(ctx, point.px, point.py - 64, 58, hotspot?.accent ?? "#9bd0ff", mode)
  rect(ctx, point.px - 42, point.py - 88, 84, 52, "#6f5137")
  rect(ctx, point.px - 36, point.py - 82, 72, 40, mode === "active" ? "#b6ebff" : mode === "hover" ? "#8fd9ff" : "#79bbeb")
  rect(ctx, point.px - 3, point.py - 82, 6, 40, "#6f5137")
  rect(ctx, point.px - 36, point.py - 62, 72, 5, "#6f5137")

  ctx.fillStyle = "#3d7286"
  ctx.fillRect(point.px - 33, point.py - 79, 66, 34)
  ctx.fillStyle = "#9fd2ff"
  ctx.fillRect(point.px - 33, point.py - 79, 66, 18)
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)"
  ctx.fillRect(point.px - 26 + Math.sin(time * 0.7) * 3, point.py - 74, 20, 8)
  ctx.fillRect(point.px + 6 + Math.cos(time * 0.6) * 2, point.py - 69, 16, 6)
  pushHitArea(hitAreas, hotspot, point)

  if (mode === "active") {
    drawBeacon(ctx, point.px, point.py - 98, hotspot?.accent ?? "#9bd0ff")
  }
}

function drawBike(context: SceneContext, hotspot: RoomHotspot | undefined, mode: "idle" | "hover" | "active", hitAreas: HitArea[]) {
  const { ctx, params } = context
  const point = projectIso(3.9, 12.2, params)
  drawObjectPulse(ctx, point.px - 2, point.py - 16, 46, hotspot?.accent ?? "#f7c56f", mode)
  circle(ctx, point.px - 20, point.py - 8, 13, "#161414")
  circle(ctx, point.px + 18, point.py - 8, 13, "#161414")
  circle(ctx, point.px - 20, point.py - 8, 9, "#c7b08c")
  circle(ctx, point.px + 18, point.py - 8, 9, "#c7b08c")
  line(ctx, point.px - 20, point.py - 8, point.px - 4, point.py - 28, mode === "active" ? "#ffd58c" : mode === "hover" ? "#f7c56f" : "#d2a553", 4)
  line(ctx, point.px - 4, point.py - 28, point.px + 18, point.py - 8, mode === "active" ? "#ffd58c" : mode === "hover" ? "#f7c56f" : "#d2a553", 4)
  line(ctx, point.px - 20, point.py - 8, point.px + 6, point.py - 8, mode === "active" ? "#ffd58c" : mode === "hover" ? "#f7c56f" : "#d2a553", 4)
  line(ctx, point.px + 6, point.py - 8, point.px - 4, point.py - 28, mode === "active" ? "#ffd58c" : mode === "hover" ? "#f7c56f" : "#d2a553", 4)
  line(ctx, point.px - 2, point.py - 30, point.px + 8, point.py - 34, "#352724", 3)
  line(ctx, point.px + 4, point.py - 28, point.px + 16, point.py - 34, "#352724", 3)
  pushHitArea(hitAreas, hotspot, point)

  if (mode === "active") {
    drawBeacon(ctx, point.px, point.py - 48, hotspot?.accent ?? "#f7c56f")
  }
}

function drawRecordPlayer(context: SceneContext, hotspot: RoomHotspot | undefined, mode: "idle" | "hover" | "active", hitAreas: HitArea[]) {
  const { ctx, params, time } = context
  const point = projectIso(15.1, 12.7, params)
  drawObjectPulse(ctx, point.px - 3, point.py - 18, 40, hotspot?.accent ?? "#ff8fb1", mode)
  rect(ctx, point.px - 24, point.py - 26, 38, 32, "#5f4030")
  rect(ctx, point.px - 18, point.py - 20, 26, 20, "#2d2320")
  circle(ctx, point.px - 4, point.py - 10, 9, mode === "active" ? "#ffc1d3" : mode === "hover" ? "#ff8fb1" : "#d46b8a")
  circle(ctx, point.px - 4, point.py - 10, 2, "#fbe8d9")
  line(ctx, point.px + 7, point.py - 17, point.px + 18, point.py - 24, "#d9bc80", 3)

  for (let index = 0; index < 3; index += 1) {
    circle(ctx, point.px + 16 + index * 9, point.py - 38 - Math.sin(time * 3 + index) * 5, 3, "#ffb2ca")
  }

  pushHitArea(hitAreas, hotspot, point)

  if (mode === "active") {
    drawBeacon(ctx, point.px - 2, point.py - 52, hotspot?.accent ?? "#ff8fb1")
  }
}

function drawArmchair(context: SceneContext) {
  const { ctx, params } = context
  const point = projectIso(11.4, 10.3, params)
  rect(ctx, point.px - 28, point.py - 24, 40, 26, "#506f4b")
  rect(ctx, point.px - 26, point.py - 42, 36, 20, "#5f8358")
  rect(ctx, point.px - 32, point.py - 22, 6, 18, "#4a6445")
  rect(ctx, point.px + 10, point.py - 22, 6, 18, "#4a6445")
}

function drawPlant(context: SceneContext) {
  const { ctx, params, time } = context
  const point = projectIso(16.1, 4.4, params)
  rect(ctx, point.px - 10, point.py - 10, 16, 12, "#7c5839")
  line(ctx, point.px - 2, point.py - 12, point.px - 10, point.py - 32 + Math.sin(time) * 2, "#5f8b56", 4)
  line(ctx, point.px - 1, point.py - 12, point.px + 8, point.py - 34 - Math.sin(time * 1.1) * 2, "#6d9d5f", 4)
  line(ctx, point.px + 1, point.py - 12, point.px + 1, point.py - 38, "#84b26c", 4)
}

function drawLamp(context: SceneContext) {
  const { ctx, params, time } = context
  const point = projectIso(16.6, 13.3, params)
  rect(ctx, point.px - 2, point.py - 44, 4, 38, "#3a302c")
  rect(ctx, point.px - 12, point.py - 56, 24, 16, "#f3d28b")
  drawGlow(ctx, point.px, point.py - 48, 52 + Math.sin(time * 1.5) * 3, "rgba(243, 210, 139, 0.25)")
}

function drawRug(ctx: CanvasRenderingContext2D, params: IsoProjectParams) {
  const start = projectIso(7, 8, params)
  const end = projectIso(12, 12, params)
  const cx = (start.px + end.px) / 2
  const cy = (start.py + end.py) / 2
  ctx.fillStyle = "rgba(88, 109, 133, 0.42)"
  ctx.beginPath()
  ctx.ellipse(cx, cy, 110, 50, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "rgba(32, 24, 20, 0.48)"
  ctx.stroke()
}

function drawAvatar(context: SceneContext, avatar: RoomAvatarState, moving: boolean) {
  const { ctx, params, tileH, time } = context
  const point = projectIso(avatar.x, avatar.y, params)
  const bob = moving ? Math.sin(time * 8) * 2 : Math.sin(time * 2) * 0.7

  ctx.fillStyle = "rgba(0, 0, 0, 0.18)"
  ctx.beginPath()
  ctx.ellipse(point.px, point.py + tileH * 0.6, 16, 8, 0, 0, Math.PI * 2)
  ctx.fill()

  rect(ctx, point.px - 6, point.py + 7, 5, 14, "#2f2523")
  rect(ctx, point.px + 1, point.py + 7, 5, 14, "#2f2523")
  rect(ctx, point.px - 9, point.py - 18 + bob, 18, 24, "#4470b5")
  rect(ctx, point.px - 11, point.py - 11 + bob, 5, 14, "#f1cfaa")
  rect(ctx, point.px + 6, point.py - 11 + bob, 5, 14, "#f1cfaa")
  circle(ctx, point.px, point.py - 24 + bob, 11, "#f0c58e")
  rect(ctx, point.px - 10, point.py - 35 + bob, 20, 10, "#4a3425")
  rect(ctx, point.px - 8, point.py - 30 + bob, 16, 4, "#4a3425")

  ctx.fillStyle = "#171312"
  if (avatar.facing === "E") {
    ctx.fillRect(point.px + 2, point.py - 27 + bob, 2, 2)
    ctx.fillRect(point.px + 5, point.py - 24 + bob, 2, 2)
  } else if (avatar.facing === "W") {
    ctx.fillRect(point.px - 4, point.py - 27 + bob, 2, 2)
    ctx.fillRect(point.px - 7, point.py - 24 + bob, 2, 2)
  } else {
    ctx.fillRect(point.px - 3, point.py - 25 + bob, 2, 2)
    ctx.fillRect(point.px + 1, point.py - 25 + bob, 2, 2)
  }

  ctx.strokeStyle = "#171312"
  ctx.beginPath()
  ctx.moveTo(point.px - 3, point.py - 20 + bob)
  ctx.quadraticCurveTo(point.px, point.py - 17 + bob, point.px + 3, point.py - 20 + bob)
  ctx.stroke()
}

function drawHudLabel(ctx: CanvasRenderingContext2D, width: number, title: string, hint: string, accent: string) {
  const panelWidth = Math.min(340, width - 32)
  const x = 16
  const y = 18
  ctx.fillStyle = "rgba(255, 248, 228, 0.92)"
  ctx.strokeStyle = "#1d1511"
  ctx.lineWidth = 3
  roundRect(ctx, x, y, panelWidth, 58, 8, true, true)
  ctx.fillStyle = accent
  ctx.fillRect(x + 10, y + 11, 10, 10)
  ctx.fillStyle = "#1d1511"
  ctx.font = "700 13px var(--font-sans-ui), sans-serif"
  ctx.fillText(title, x + 30, y + 22)
  ctx.fillStyle = "#5c4739"
  ctx.font = "500 11px var(--font-sans-ui), sans-serif"
  ctx.fillText(hint, x + 30, y + 42)
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.font = "500 12px var(--font-sans-ui), sans-serif"
  const textWidth = ctx.measureText(text).width
  const bubbleWidth = Math.max(120, textWidth + 20)
  const bubbleHeight = 30
  ctx.fillStyle = "rgba(255, 250, 236, 0.96)"
  ctx.strokeStyle = "#1d1511"
  ctx.lineWidth = 2
  roundRect(ctx, x - bubbleWidth / 2, y - bubbleHeight - 16, bubbleWidth, bubbleHeight, 6, true, true)
  ctx.beginPath()
  ctx.moveTo(x, y - 6)
  ctx.lineTo(x - 6, y - 16)
  ctx.lineTo(x + 6, y - 16)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = "#2d211a"
  ctx.fillText(text, x - bubbleWidth / 2 + 10, y - 27)
}

function drawInspectFlash(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const alpha = 0.12 + Math.sin(time * 24) * 0.05
  ctx.fillStyle = `rgba(255, 246, 214, ${alpha})`
  ctx.fillRect(0, 0, width, height)
}

function drawObjectPulse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  accent: string,
  mode: "idle" | "hover" | "active"
) {
  if (mode === "idle") return
  const fill = mode === "active" ? `${accent}55` : `${accent}33`
  drawGlow(ctx, x, y, radius, fill)
}

function drawBeacon(ctx: CanvasRenderingContext2D, x: number, y: number, accent: string) {
  ctx.fillStyle = accent
  ctx.fillRect(x - 6, y, 12, 4)
  ctx.fillRect(x - 2, y - 6, 4, 6)
  ctx.fillStyle = "rgba(255, 250, 236, 0.9)"
  ctx.fillRect(x - 2, y + 4, 4, 4)
}

function drawTile(ctx: CanvasRenderingContext2D, px: number, py: number, tileW: number, tileH: number, fill: string, stroke: string) {
  const hw = tileW / 2
  const hh = tileH / 2
  ctx.fillStyle = fill
  ctx.strokeStyle = stroke
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.lineTo(px + hw, py + hh)
  ctx.lineTo(px, py + tileH)
  ctx.lineTo(px - hw, py + hh)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawRaisedBlock(ctx: CanvasRenderingContext2D, px: number, py: number, tileW: number, tileH: number, top: string, side: string) {
  drawTile(ctx, px, py - 8, tileW, tileH, top, "#2a1f19")
  const hw = tileW / 2
  const hh = tileH / 2
  ctx.fillStyle = side
  ctx.strokeStyle = "#2a1f19"
  ctx.beginPath()
  ctx.moveTo(px, py + tileH - 8)
  ctx.lineTo(px + hw, py + hh - 8)
  ctx.lineTo(px + hw, py + hh)
  ctx.lineTo(px, py + tileH)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(px, py + tileH - 8)
  ctx.lineTo(px - hw, py + hh - 8)
  ctx.lineTo(px - hw, py + hh)
  ctx.lineTo(px, py + tileH)
  ctx.closePath()
  ctx.fillStyle = "#5b4330"
  ctx.fill()
  ctx.stroke()
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  ctx.strokeStyle = "#1d1511"
  ctx.lineWidth = 1
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h))
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "#1d1511"
  ctx.stroke()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: boolean,
  stroke: boolean
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
  if (fill) ctx.fill()
  if (stroke) ctx.stroke()
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, stroke: string, width: number) {
  ctx.strokeStyle = stroke
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.lineWidth = 1
}

function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, fill)
  gradient.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}
