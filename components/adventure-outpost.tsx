"use client"

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react"
import { projectIso, unprojectIso, type IsoProjectParams } from "@/lib/iso"
import type { DogAnimationState, DogNpcState } from "@/hooks/use-dog-npc"
import { drawDogSprite } from "@/lib/dog-sprite"
import type { OutpostBubbleState } from "@/hooks/use-outpost-controller"
import type { RoomGrid } from "@/lib/room-grid"
import { capturePointerIntent, pointerIntentWithinTolerance, resolveHitTarget, type PointerIntent } from "@/lib/scene-pointer"
import type { RoomAvatarState } from "@/lib/room-session"

type HitTarget = {
  kind: "return" | "dog"
  id: "return" | "dog"
  x: number
  y: number
  w: number
  h: number
  snapDistance: number
}

type SceneContext = {
  ctx: CanvasRenderingContext2D
  params: IsoProjectParams
  tileW: number
  tileH: number
  time: number
}

type PendingPointer = {
  relativeX: number
  relativeY: number
}

type Props = {
  focusRef: RefObject<HTMLDivElement | null>
  grid: RoomGrid
  interactionReady: boolean
  locked: boolean
  currentTile: RoomAvatarState
  hoverReturn: boolean
  linkedReturn: boolean
  bubble: OutpostBubbleState | null
  transitionFlash: boolean
  audioEnabled: boolean
  avatarVisualRef: MutableRefObject<RoomAvatarState>
  dogVisualRef: MutableRefObject<RoomAvatarState>
  dogState: DogNpcState
  onMoveToTile: (target: { x: number; y: number }) => void | Promise<void>
  onReturnHome: () => void | Promise<void>
  onInteractDog: () => void
  onHoverReturn: (hovered: boolean) => void
  onToggleAudio: () => void
  tick: (dt: number) => RoomAvatarState
  tickDog: (dt: number) => RoomAvatarState
}

const TILE_W = 58
const TILE_H = 29
const DOG_SNAP_DISTANCE = 18
const RETURN_SNAP_DISTANCE = 40

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
    originY: Math.round(height / 2 - (minY + maxY) / 2) - 12,
  }
}

function pushReturnHitArea(hitAreas: HitTarget[], point: { px: number; py: number }) {
  hitAreas.push({
    kind: "return",
    id: "return",
    x: point.px - 48,
    y: point.py - 82,
    w: 88,
    h: 98,
    snapDistance: RETURN_SNAP_DISTANCE,
  })
}

function pushDogHitArea(hitAreas: HitTarget[], point: { px: number; py: number }) {
  hitAreas.push({
    kind: "dog",
    id: "dog",
    x: point.px - 18,
    y: point.py - 34,
    w: 36,
    h: 28,
    snapDistance: DOG_SNAP_DISTANCE,
  })
}

function hitPriority(area: HitTarget) {
  return area.kind === "dog" ? 0 : 1
}

export default function AdventureOutpost({
  focusRef,
  grid,
  interactionReady,
  locked,
  currentTile,
  hoverReturn,
  linkedReturn,
  bubble,
  transitionFlash,
  audioEnabled,
  avatarVisualRef,
  dogVisualRef,
  dogState,
  onMoveToTile,
  onReturnHome,
  onInteractDog,
  onHoverReturn,
  onToggleAudio,
  tick,
  tickDog,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hitAreasRef = useRef<HitTarget[]>([])
  const hoverReturnRef = useRef(hoverReturn)
  const pendingPointerRef = useRef<PendingPointer | null>(null)
  const pointerIntentRef = useRef<PointerIntent | null>(null)
  const sceneReadyRef = useRef(false)
  const sceneStateRef = useRef({
    hoverReturn,
    linkedReturn,
    bubble,
    transitionFlash,
    locked,
    dogState,
  })

  const [size, setSize] = useState({ width: 640, height: 760 })
  const [sceneReady, setSceneReady] = useState(false)
  const isInteractionEnabled = interactionReady && sceneReady && !locked

  useEffect(() => {
    sceneStateRef.current = {
      hoverReturn,
      linkedReturn,
      bubble,
      transitionFlash,
      locked,
      dogState,
    }
    hoverReturnRef.current = hoverReturn
  }, [bubble, dogState, hoverReturn, linkedReturn, locked, transitionFlash])

  useEffect(() => {
    if (!isInteractionEnabled || transitionFlash) return
    focusRef.current?.focus({ preventScroll: true })
  }, [focusRef, isInteractionEnabled, transitionFlash])

  useEffect(() => {
    sceneReadyRef.current = false
    setSceneReady(false)
  }, [size.height, size.width])

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

  const getPointerFrame = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top
    return {
      rect,
      px,
      py,
      hit: resolveHitTarget(px, py, hitAreasRef.current, hitPriority),
    }
  }, [])

  const updateHover = useCallback(
    (nextHover: boolean) => {
      if (hoverReturnRef.current === nextHover) return
      hoverReturnRef.current = nextHover
      onHoverReturn(nextHover)
    },
    [onHoverReturn]
  )

  const triggerInteractionAt = useCallback(
    (targetId: string | null, px: number, py: number) => {
      const currentScene = sceneStateRef.current
      if (currentScene.locked || currentScene.transitionFlash) return

      const hit = targetId ? hitAreasRef.current.find((area) => area.id === targetId) ?? null : resolveHitTarget(px, py, hitAreasRef.current, hitPriority)

      if (hit?.kind === "dog") {
        onInteractDog()
        return
      }

      if (hit?.kind === "return") {
        void onReturnHome()
        return
      }

      const origin = computeCenteredOrigin(size.width, size.height, grid.cols, grid.rows, TILE_W, TILE_H)
      const params: IsoProjectParams = {
        tileW: TILE_W,
        tileH: TILE_H,
        originX: origin.originX,
        originY: origin.originY,
      }
      const tile = unprojectIso(px, py, params)
      void onMoveToTile({ x: tile.tx, y: tile.ty })
    },
    [grid.cols, grid.rows, onInteractDog, onMoveToTile, onReturnHome, size.height, size.width]
  )

  useEffect(() => {
    if (!isInteractionEnabled || transitionFlash) return
    const pendingPointer = pendingPointerRef.current
    if (!pendingPointer) return

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    pendingPointerRef.current = null
    triggerInteractionAt(null, pendingPointer.relativeX * rect.width, pendingPointer.relativeY * rect.height)
  }, [isInteractionEnabled, transitionFlash, triggerInteractionAt])

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const currentScene = sceneStateRef.current
      if (!isInteractionEnabled || currentScene.locked || currentScene.transitionFlash) {
        updateHover(false)
        return
      }

      const result = getPointerFrame(event.clientX, event.clientY)
      updateHover(result?.hit?.kind === "return")
    },
    [getPointerFrame, isInteractionEnabled, updateHover]
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const currentScene = sceneStateRef.current
      if (!isInteractionEnabled || currentScene.locked || currentScene.transitionFlash) {
        pointerIntentRef.current = null
        return
      }

      const canvas = canvasRef.current
      const rect = canvas?.getBoundingClientRect()
      if (!rect || rect.width <= 0 || rect.height <= 0) return
      pointerIntentRef.current = capturePointerIntent(event.clientX, event.clientY, rect, hitAreasRef.current, hitPriority)
    },
    [isInteractionEnabled]
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

      if (currentScene.locked || currentScene.transitionFlash) return
      const intent = pointerIntentRef.current
      pointerIntentRef.current = null
      if (intent && pointerIntentWithinTolerance(intent, event.clientX, event.clientY)) {
        const canvas = canvasRef.current
        const rect = canvas?.getBoundingClientRect()
        if (rect) {
          pendingPointerRef.current = null
          triggerInteractionAt(intent.targetId, intent.relativeX * rect.width, intent.relativeY * rect.height)
          return
        }
      }

      const current = getPointerFrame(event.clientX, event.clientY)
      if (!current) return
      pendingPointerRef.current = null
      triggerInteractionAt(current.hit?.id ?? null, current.px, current.py)
    },
    [focusRef, getPointerFrame, isInteractionEnabled, triggerInteractionAt]
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
      const dogForDraw = tickDog(dt) || dogVisualRef.current || dogState.currentTile
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
      drawBackground(ctx, size.width, size.height, now * 0.001, currentScene.transitionFlash)
      drawMountains(ctx, size.width, size.height)
      drawFloor(ctx, grid, params, TILE_W, TILE_H)
      drawPath(ctx, params)

      hitAreasRef.current = []
      const sceneContext: SceneContext = { ctx, params, tileW: TILE_W, tileH: TILE_H, time: now * 0.001 }
      const scene: Array<{ sort: number; draw: () => void }> = []

      scene.push({ sort: 3.1, draw: () => drawReturnCrack(sceneContext, currentScene.hoverReturn, currentScene.linkedReturn, hitAreasRef.current) })
      scene.push({ sort: 5.4, draw: () => drawTent(sceneContext) })
      scene.push({ sort: 7.1, draw: () => drawSignpost(sceneContext) })
      scene.push({ sort: 8.8, draw: () => drawCampfire(sceneContext) })
      scene.push({
        sort: dogForDraw.y + 0.45,
        draw: () => drawDog(sceneContext, dogForDraw, currentScene.dogState.animation, hitAreasRef.current),
      })
      scene.push({
        sort: avatarForDraw.y + 0.5,
        draw: () => drawAvatar(sceneContext, avatarForDraw, currentTile.x !== avatarForDraw.x || currentTile.y !== avatarForDraw.y),
      })

      scene.sort((a, b) => a.sort - b.sort).forEach((item) => item.draw())

      if (!sceneReadyRef.current && size.width > 0 && size.height > 0 && hitAreasRef.current.length >= 2) {
        sceneReadyRef.current = true
        setSceneReady(true)
      }

      if (currentScene.bubble && currentScene.bubble.expiresAt > Date.now()) {
        const avatarPoint = projectIso(avatarForDraw.x, avatarForDraw.y, params)
        drawBubble(ctx, avatarPoint.px, avatarPoint.py - 26, currentScene.bubble.text)
      }

      if (currentScene.dogState.bubble) {
        const dogPoint = projectIso(dogForDraw.x, dogForDraw.y, params)
        drawBubble(ctx, dogPoint.px, dogPoint.py - 24, currentScene.dogState.bubble.text)
      }

      if (currentScene.hoverReturn || currentScene.linkedReturn) {
        drawHudLabel(ctx, size.width, "回家裂缝", currentScene.linkedReturn ? "回到出生点房间" : "靠近后就能回房间补给", "#8ed7ff")
      }

      if (currentScene.transitionFlash) {
        drawTransitionFlash(ctx, size.width, size.height, now * 0.001)
      }

      frame = requestAnimationFrame(render)
    }

    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [avatarVisualRef, currentTile.x, currentTile.y, dogState.currentTile, dogVisualRef, grid, size.height, size.width, tick, tickDog])

  return (
    <div ref={focusRef} tabIndex={0} className="relative outline-none">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 px-1">
        <div>
          <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[rgba(255,247,226,0.8)]">
            营地前哨
          </div>
          <div className="mt-2 text-sm text-[rgba(255,245,220,0.92)]">
            这里是房间外的第一处营地。点击地面继续探索，点击裂缝就能回到出生点休整。
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="pixel-chip bg-[rgba(255,246,220,0.85)] text-xs">
            {linkedReturn ? "回程已就绪" : hoverReturn ? "回家裂缝" : `坐标 ${currentTile.x},${currentTile.y}`}
          </div>
          <button type="button" className="pixel-button px-3 py-2 text-xs sm:text-sm" onClick={onToggleAudio}>
            {audioEnabled ? "环境音开" : "环境音关"}
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-[10px] border-[4px] border-[color:var(--game-ink)] bg-[linear-gradient(180deg,#183347,#2e536b_35%,#5d6d3d_72%,#8a7142_100%)] shadow-[0_14px_0_rgba(15,10,8,0.3)]"
      >
        <canvas
          ref={canvasRef}
          width={size.width}
          height={size.height}
          className={`pixel-canvas block w-full touch-manipulation ${
            !isInteractionEnabled ? "cursor-wait" : transitionFlash ? "cursor-default" : hoverReturn ? "cursor-pointer" : "cursor-crosshair"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => updateHover(false)}
          onPointerUp={handlePointerUp}
        />
        <div className="scanline-overlay pointer-events-none absolute inset-0 opacity-20" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(9,6,4,0.28))]" />
        {!isInteractionEnabled && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[linear-gradient(180deg,rgba(12,10,8,0.15),rgba(12,10,8,0.38))]">
            <div className="pixel-panel max-w-xs text-center">
              <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[color:var(--game-muted)]">营地加载中</div>
              <p className="mt-3 text-sm leading-7 text-[color:var(--game-text)]">
                篝火已经点亮，等地面坐标同步好就能带着狗继续往远处出发。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, dimmed: boolean) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, "#183347")
  gradient.addColorStop(0.42, "#355d75")
  gradient.addColorStop(0.8, "#5a6d43")
  gradient.addColorStop(1, "#7f6a3f")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = "rgba(255, 244, 203, 0.08)"
  for (let index = 0; index < 5; index += 1) {
    const x = width * 0.18 + index * 130 + Math.sin(time * 0.3 + index) * 10
    const y = 72 + Math.sin(time * 0.5 + index * 0.8) * 6
    ctx.beginPath()
    ctx.arc(x, y, 30, 0, Math.PI * 2)
    ctx.fill()
  }

  if (dimmed) {
    ctx.fillStyle = "rgba(8, 7, 6, 0.24)"
    ctx.fillRect(0, 0, width, height)
  }
}

function drawMountains(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = "rgba(28, 45, 56, 0.88)"
  ctx.beginPath()
  ctx.moveTo(0, height * 0.38)
  ctx.lineTo(width * 0.14, height * 0.24)
  ctx.lineTo(width * 0.28, height * 0.35)
  ctx.lineTo(width * 0.42, height * 0.18)
  ctx.lineTo(width * 0.56, height * 0.34)
  ctx.lineTo(width * 0.74, height * 0.2)
  ctx.lineTo(width, height * 0.36)
  ctx.lineTo(width, height * 0.46)
  ctx.lineTo(0, height * 0.46)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = "rgba(71, 101, 114, 0.65)"
  ctx.beginPath()
  ctx.moveTo(0, height * 0.44)
  ctx.lineTo(width * 0.22, height * 0.29)
  ctx.lineTo(width * 0.44, height * 0.41)
  ctx.lineTo(width * 0.63, height * 0.27)
  ctx.lineTo(width * 0.86, height * 0.42)
  ctx.lineTo(width, height * 0.38)
  ctx.lineTo(width, height * 0.5)
  ctx.lineTo(0, height * 0.5)
  ctx.closePath()
  ctx.fill()
}

function drawFloor(ctx: CanvasRenderingContext2D, grid: RoomGrid, params: IsoProjectParams, tileW: number, tileH: number) {
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.cols; x += 1) {
      const point = projectIso(x, y, params)
      const isBlocked = !grid.walkable[y * grid.cols + x]
      const onPath = x >= 5 && x <= 16 && y >= 7 && y <= 13 && Math.abs(x - y) <= 6
      const fill = isBlocked ? "#546040" : onPath ? ((x + y) % 2 === 0 ? "#a98c59" : "#96794a") : (x + y) % 2 === 0 ? "#6e7f47" : "#637341"
      drawTile(ctx, point.px, point.py, tileW, tileH, fill, "#251912")
    }
  }
}

function drawPath(ctx: CanvasRenderingContext2D, params: IsoProjectParams) {
  const start = projectIso(6, 10, params)
  const end = projectIso(16, 12, params)
  ctx.fillStyle = "rgba(240, 219, 173, 0.12)"
  ctx.beginPath()
  ctx.ellipse((start.px + end.px) / 2, (start.py + end.py) / 2, 142, 48, -0.18, 0, Math.PI * 2)
  ctx.fill()
}

function drawReturnCrack(
  context: SceneContext,
  hoverReturn: boolean,
  linkedReturn: boolean,
  hitAreas: HitTarget[]
) {
  const { ctx, params, time } = context
  const point = projectIso(2.3, 3.4, params)
  const accent = linkedReturn ? "#8ed7ff" : hoverReturn ? "#74c8ff" : "#5ca2d6"

  drawGlow(ctx, point.px - 4, point.py - 44, linkedReturn ? 56 : 38, linkedReturn ? "rgba(142, 215, 255, 0.34)" : "rgba(116, 200, 255, 0.18)")
  rect(ctx, point.px - 34, point.py - 74, 10, 52, "#4f3326")
  rect(ctx, point.px - 26, point.py - 82, 34, 68, "#20141a")
  rect(ctx, point.px - 22, point.py - 76, 26, 56, "#37203a")

  for (let index = 0; index < 4; index += 1) {
    const wobble = Math.sin(time * 4 + index) * 3
    line(ctx, point.px - 12 + index * 4, point.py - 74 + index * 12, point.px - 4 + wobble, point.py - 64 + index * 8, accent, 2)
  }

  rect(ctx, point.px - 10, point.py - 16, 28, 10, "#5c3e2c")
  pushReturnHitArea(hitAreas, point)
}

function drawTent(context: SceneContext) {
  const { ctx, params } = context
  const point = projectIso(13.8, 8.8, params)
  line(ctx, point.px, point.py - 56, point.px - 28, point.py - 8, "#2a1e19", 2)
  line(ctx, point.px, point.py - 56, point.px + 32, point.py - 10, "#2a1e19", 2)
  line(ctx, point.px - 28, point.py - 8, point.px + 32, point.py - 10, "#2a1e19", 2)
  ctx.fillStyle = "#d0ad6d"
  ctx.beginPath()
  ctx.moveTo(point.px, point.py - 56)
  ctx.lineTo(point.px - 28, point.py - 8)
  ctx.lineTo(point.px + 32, point.py - 10)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = "#2a1e19"
  ctx.stroke()
  rect(ctx, point.px - 8, point.py - 26, 12, 18, "#62422f")
}

function drawSignpost(context: SceneContext) {
  const { ctx, params } = context
  const point = projectIso(7.2, 7.6, params)
  rect(ctx, point.px - 3, point.py - 40, 6, 34, "#4e3527")
  rect(ctx, point.px - 30, point.py - 48, 42, 10, "#b99359")
  rect(ctx, point.px - 24, point.py - 32, 38, 10, "#c8a86a")
}

function drawCampfire(context: SceneContext) {
  const { ctx, params, time } = context
  const point = projectIso(10.6, 9.5, params)
  drawGlow(ctx, point.px, point.py - 18, 38 + Math.sin(time * 7) * 2, "rgba(255, 184, 102, 0.22)")
  line(ctx, point.px - 12, point.py - 2, point.px + 10, point.py - 18, "#5d3c28", 4)
  line(ctx, point.px - 10, point.py - 18, point.px + 12, point.py - 2, "#5d3c28", 4)
  rect(ctx, point.px - 8, point.py - 28, 6, 12, "#ffd27c")
  rect(ctx, point.px - 2, point.py - 34, 6, 18, "#ff8f55")
  rect(ctx, point.px + 4, point.py - 26, 5, 10, "#ffe09a")
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

function drawDog(context: SceneContext, dog: RoomAvatarState, animation: DogAnimationState, hitAreas: HitTarget[]) {
  const { ctx, params, tileH, time } = context
  const point = projectIso(dog.x, dog.y, params)
  pushDogHitArea(hitAreas, { px: point.px, py: point.py + 8 })
  drawDogSprite(ctx, point, tileH, time, dog, animation)
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

function drawTransitionFlash(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const alpha = 0.16 + Math.sin(time * 24) * 0.05
  ctx.fillStyle = `rgba(214, 239, 255, ${alpha})`
  ctx.fillRect(0, 0, width, height)
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
