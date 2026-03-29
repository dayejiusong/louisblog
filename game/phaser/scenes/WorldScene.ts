import { generatedTextureKeys } from "../../assets/manifest.ts"
import type { SceneBridge } from "../adapters/sceneBridge.ts"
import { directionFromKey } from "../../input/actions.ts"
import { TILE_H, TILE_W, makeIsoParams, projectPoint, resolveInteractiveTarget, unprojectPoint, type InteractiveHitArea } from "../view/world-helpers.ts"
import type { HoverTarget, SceneDecor, SceneExit, SceneHotspot } from "../../types.ts"

type PhaserModule = typeof import("phaser")

type PointerIntent = {
  x: number
  y: number
  targetId: string | null
}

export function createWorldScene(Phaser: PhaserModule, bridge: SceneBridge) {
  return class WorldScene extends Phaser.Scene {
    private unsubscribe: (() => void) | null = null
    private snapshot = bridge.getSnapshot()
    private worldGraphics!: import("phaser").GameObjects.Graphics
    private overlayGraphics!: import("phaser").GameObjects.Graphics
    private avatarShadow!: import("phaser").GameObjects.Image
    private dogShadow!: import("phaser").GameObjects.Image
    private avatarImage!: import("phaser").GameObjects.Image
    private dogImage!: import("phaser").GameObjects.Image
    private pointerIntent: PointerIntent | null = null

    constructor() {
      super("world")
    }

    create() {
      this.worldGraphics = this.add.graphics()
      this.overlayGraphics = this.add.graphics()
      this.avatarShadow = this.add.image(0, 0, generatedTextureKeys.shadow).setOrigin(0.5, 0.5)
      this.dogShadow = this.add.image(0, 0, generatedTextureKeys.shadow).setOrigin(0.5, 0.5)
      this.avatarImage = this.add.image(0, 0, generatedTextureKeys.avatar).setOrigin(0.5, 1)
      this.dogImage = this.add.image(0, 0, generatedTextureKeys.dog).setOrigin(0.5, 1)

      this.unsubscribe = bridge.subscribe(() => {
        this.snapshot = bridge.getSnapshot()
      })

      this.input.on("pointermove", (pointer: import("phaser").Input.Pointer) => {
        const hitArea = this.resolveHitArea(pointer.x, pointer.y)
        bridge.send({ type: "setHoverTarget", target: hitArea ? this.toHoverTarget(hitArea) : null })
      })

      this.input.on("pointerdown", (pointer: import("phaser").Input.Pointer) => {
        const hitArea = this.resolveHitArea(pointer.x, pointer.y)
        this.pointerIntent = { x: pointer.x, y: pointer.y, targetId: hitArea?.id ?? null }
      })

      this.input.on("pointerup", (pointer: import("phaser").Input.Pointer) => {
        const stableClick = !this.pointerIntent || Math.hypot(pointer.x - this.pointerIntent.x, pointer.y - this.pointerIntent.y) <= 18
        const hitArea = stableClick && this.pointerIntent?.targetId
          ? this.resolveHitArea(pointer.x, pointer.y) ?? this.getHitAreas().find((area) => area.id === this.pointerIntent?.targetId) ?? null
          : this.resolveHitArea(pointer.x, pointer.y)

        this.pointerIntent = null
        this.handlePointerInteraction(pointer.x, pointer.y, hitArea ?? null)
      })

      this.input.on("gameout", () => {
        this.pointerIntent = null
        bridge.send({ type: "setHoverTarget", target: null })
      })

      this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
        if (event.repeat) return

        if (event.key === "Escape") {
          if (this.snapshot.activeSection) {
            bridge.send({ type: "closeSection" })
          } else if (this.snapshot.taskPanelOpen) {
            bridge.send({ type: "closeTaskPanel" })
          } else if (this.snapshot.worldMapOpen) {
            bridge.send({ type: "setWorldMapOpen", open: false })
          }
          return
        }

        if (event.key === "Enter" || event.key === " ") {
          const target = this.snapshot.contextTarget ?? this.snapshot.hoverTarget
          if (target) {
            this.sendTargetInteraction(target)
          }
          return
        }

        const delta = directionFromKey(event.key)
        if (!delta || this.snapshot.inputLocked) return
        bridge.send({
          type: "moveToTile",
          target: {
            x: this.snapshot.player.currentTile.x + delta.x,
            y: this.snapshot.player.currentTile.y + delta.y,
          },
        })
      })
    }

    update(time: number, delta: number) {
      bridge.tick(delta / 1000)
      this.snapshot = bridge.getSnapshot()
      this.renderFrame(time / 1000)
    }

    shutdown() {
      this.unsubscribe?.()
      this.unsubscribe = null
    }

    private renderFrame(timeSeconds: number) {
      const { scene } = this.snapshot
      const params = makeIsoParams(this.scale.width, this.scale.height, scene.grid.cols, scene.grid.rows, scene.camera.paddingTop)
      const hoverId = this.snapshot.hoverTarget?.id ?? null
      const queuedId = this.snapshot.queuedInteraction?.id ?? null
      const contextId = this.snapshot.contextTarget?.id ?? null

      this.worldGraphics.clear()
      this.overlayGraphics.clear()

      this.drawBackground(timeSeconds)
      if (scene.id === "room") {
        this.drawRoomFloor(params)
      } else {
        this.drawOutdoorFloor(scene.id, params, timeSeconds)
      }

      for (const hotspot of scene.hotspots) {
        const mode = queuedId === hotspot.id || (this.snapshot.activeSection && hotspot.kind === "section" && hotspot.id === this.snapshot.activeSection)
          ? "active"
          : hoverId === hotspot.id || contextId === hotspot.id
            ? "hover"
            : "idle"
        this.drawHotspot(hotspot, params, mode, timeSeconds)
      }

      for (const exit of scene.exits) {
        const mode = queuedId === exit.id
          ? "active"
          : hoverId === exit.id || contextId === exit.id
            ? "hover"
            : "idle"
        this.drawExit(exit, params, mode, timeSeconds)
      }

      for (const decor of scene.decor) {
        this.drawDecor(decor, params, timeSeconds)
      }

      this.updateEntities(params, timeSeconds)
      this.drawAtmosphere(timeSeconds)
      this.drawOverlay(timeSeconds)
    }

    private updateEntities(params: ReturnType<typeof makeIsoParams>, timeSeconds: number) {
      const playerPoint = projectPoint(this.snapshot.player.visual.x, this.snapshot.player.visual.y, params)
      const dogPoint = projectPoint(this.snapshot.dog.visual.x, this.snapshot.dog.visual.y, params)
      const playerBob = this.snapshot.player.visual.moving ? Math.sin(timeSeconds * 8) * 2 : Math.sin(timeSeconds * 2) * 0.6
      const dogBob = this.snapshot.dog.visual.moving ? Math.sin(timeSeconds * 8) * 1.4 : 0

      this.avatarShadow.setPosition(playerPoint.px, playerPoint.py + TILE_H * 0.62).setScale(1, this.snapshot.player.visual.moving ? 0.92 : 1)
      this.dogShadow.setPosition(dogPoint.px, dogPoint.py + TILE_H * 0.72).setScale(this.snapshot.dog.visual.moving ? 1.04 : 1, 1)

      this.avatarImage
        .setPosition(playerPoint.px, playerPoint.py + 22 + playerBob)
        .setDepth(this.snapshot.player.visual.y + 0.8)
        .setFlipX(this.snapshot.player.visual.facing === "W")

      this.dogImage
        .setPosition(dogPoint.px, dogPoint.py + 12 + dogBob)
        .setDepth(this.snapshot.dog.visual.y + 0.7)
        .setFlipX(this.snapshot.dog.visual.facing === "W")
        .setScale(this.snapshot.dog.animation.wagging ? 1.04 : 1, 1)
    }

    private drawOverlay(timeSeconds: number) {
      if (this.snapshot.transitionState.phase === "switching") {
        const alpha = 0.14 + Math.sin(timeSeconds * 16) * 0.05
        this.overlayGraphics.fillStyle(0xd6efff, alpha)
        this.overlayGraphics.fillRect(0, 0, this.scale.width, this.scale.height)
      }
    }

    private drawAtmosphere(timeSeconds: number) {
      const { environment, dynamicEvent } = this.snapshot

      if (environment.timeOfDay === "dusk") {
        this.overlayGraphics.fillStyle(0xffc27a, 0.08)
        this.overlayGraphics.fillRect(0, 0, this.scale.width, this.scale.height)
      }

      if (environment.timeOfDay === "night") {
        this.overlayGraphics.fillStyle(0x0d1b2e, 0.24)
        this.overlayGraphics.fillRect(0, 0, this.scale.width, this.scale.height)
        for (let index = 0; index < 18; index += 1) {
          const x = ((index * 83) % this.scale.width) + Math.sin(timeSeconds + index) * 6
          const y = 24 + ((index * 37) % Math.max(80, Math.floor(this.scale.height * 0.28)))
          this.overlayGraphics.fillStyle(0xeef6ff, 0.55)
          this.overlayGraphics.fillCircle(x, y, 1.4 + (index % 3) * 0.3)
        }
      }

      if (environment.weather === "drizzle") {
        this.overlayGraphics.lineStyle(2, 0xcfe9ff, 0.24)
        for (let index = 0; index < 22; index += 1) {
          const startX = ((index * 61) % (this.scale.width + 60)) - 30 + Math.sin(timeSeconds * 1.6 + index) * 18
          const startY = ((index * 27) % this.scale.height) - 20
          this.overlayGraphics.beginPath()
          this.overlayGraphics.moveTo(startX, startY)
          this.overlayGraphics.lineTo(startX - 10, startY + 30)
          this.overlayGraphics.strokePath()
        }
      }

      if (environment.weather === "fog") {
        for (let index = 0; index < 7; index += 1) {
          const x = this.scale.width * (0.14 + index * 0.12) + Math.sin(timeSeconds * 0.35 + index) * 16
          const y = this.scale.height * (0.22 + (index % 3) * 0.16)
          this.overlayGraphics.fillStyle(0xf1f6f7, 0.1)
          this.overlayGraphics.fillEllipse(x, y, 180, 64)
        }
      }

      if (dynamicEvent?.id === "campfire-circle") {
        this.overlayGraphics.fillStyle(0xffc782, 0.08 + Math.sin(timeSeconds * 3.4) * 0.02)
        this.overlayGraphics.fillEllipse(this.scale.width * 0.48, this.scale.height * 0.62, 260, 110)
      }

      if (dynamicEvent?.id === "ridge-fog") {
        this.overlayGraphics.fillStyle(0xe6eff0, 0.14)
        this.overlayGraphics.fillEllipse(this.scale.width * 0.56, this.scale.height * 0.42, 320, 100)
      }

      if (dynamicEvent?.id === "luminous-tide") {
        this.overlayGraphics.fillStyle(0x8bf0ff, 0.1 + Math.sin(timeSeconds * 3) * 0.02)
        this.overlayGraphics.fillEllipse(this.scale.width * 0.78, this.scale.height * 0.48, 220, 140)
      }

      if (dynamicEvent?.id === "window-rain") {
        this.overlayGraphics.fillStyle(0xcfe7ff, 0.08)
        this.overlayGraphics.fillRect(this.scale.width * 0.62, this.scale.height * 0.08, this.scale.width * 0.2, this.scale.height * 0.22)
      }
    }

    private drawBackground(timeSeconds: number) {
      const { theme } = this.snapshot.scene
      this.worldGraphics.fillStyle(theme.backgroundTop, 1)
      this.worldGraphics.fillRect(0, 0, this.scale.width, this.scale.height * 0.34)
      this.worldGraphics.fillStyle(theme.backgroundMid, 1)
      this.worldGraphics.fillRect(0, this.scale.height * 0.34, this.scale.width, this.scale.height * 0.32)
      this.worldGraphics.fillStyle(theme.backgroundBottom, 1)
      this.worldGraphics.fillRect(0, this.scale.height * 0.66, this.scale.width, this.scale.height * 0.34)

      for (let index = 0; index < 5; index += 1) {
        const x = this.scale.width * 0.18 + index * 126 + Math.sin(timeSeconds * 0.3 + index) * 8
        const y = 72 + Math.sin(timeSeconds * 0.5 + index * 0.8) * 6
        this.worldGraphics.fillStyle(0xffffff, 0.08)
        this.worldGraphics.fillCircle(x, y, 28)
      }

      if (this.snapshot.scene.id === "outpost" || this.snapshot.scene.id === "ridge") {
        this.worldGraphics.fillStyle(0x1c2d38, 0.9)
        this.worldGraphics.fillTriangle(0, this.scale.height * 0.42, this.scale.width * 0.18, this.scale.height * 0.24, this.scale.width * 0.36, this.scale.height * 0.42)
        this.worldGraphics.fillTriangle(this.scale.width * 0.2, this.scale.height * 0.42, this.scale.width * 0.46, this.scale.height * 0.16, this.scale.width * 0.72, this.scale.height * 0.42)
        this.worldGraphics.fillTriangle(this.scale.width * 0.58, this.scale.height * 0.42, this.scale.width * 0.82, this.scale.height * 0.22, this.scale.width, this.scale.height * 0.42)
      }

      if (this.snapshot.scene.id === "shore") {
        this.worldGraphics.fillStyle(0x5eb8dc, 0.92)
        this.worldGraphics.fillRect(this.scale.width * 0.62, this.scale.height * 0.3, this.scale.width * 0.42, this.scale.height * 0.42)
        this.worldGraphics.fillStyle(0xffffff, 0.18)
        for (let index = 0; index < 4; index += 1) {
          const y = this.scale.height * 0.34 + index * 24 + Math.sin(timeSeconds * 2 + index) * 3
          this.worldGraphics.fillEllipse(this.scale.width * 0.8, y, 164 - index * 14, 10)
        }
      }
    }

    private drawRoomFloor(params: ReturnType<typeof makeIsoParams>) {
      const { grid } = this.snapshot.scene
      for (let y = 0; y < grid.rows; y += 1) {
        for (let x = 0; x < grid.cols; x += 1) {
          const point = projectPoint(x, y, params)
          const walkable = grid.walkable[y * grid.cols + x]
          const color = !walkable ? 0x6d665d : (x + y) % 2 === 0 ? 0xb7945e : 0xa78250
          this.fillDiamond(point.px, point.py, TILE_W, TILE_H, color, 1)
        }
      }

      for (let x = 1; x < grid.cols - 1; x += 1) {
        const point = projectPoint(x, 1, params)
        this.drawRaisedBlock(point.px, point.py, 0xcbb28b, 0x6d5236)
      }
      for (let y = 2; y < grid.rows - 1; y += 1) {
        const point = projectPoint(1, y, params)
        this.drawRaisedBlock(point.px, point.py, 0xb49978, 0x6c5136)
      }

      const rugStart = projectPoint(7, 8, params)
      const rugEnd = projectPoint(12, 12, params)
      this.worldGraphics.fillStyle(0x586d85, 0.42)
      this.worldGraphics.fillEllipse((rugStart.px + rugEnd.px) / 2, (rugStart.py + rugEnd.py) / 2, 220, 100)
    }

    private drawOutdoorFloor(sceneId: "outpost" | "ridge" | "shore", params: ReturnType<typeof makeIsoParams>, timeSeconds: number) {
      const { grid } = this.snapshot.scene
      for (let y = 0; y < grid.rows; y += 1) {
        for (let x = 0; x < grid.cols; x += 1) {
          const point = projectPoint(x, y, params)
          const blocked = !grid.walkable[y * grid.cols + x]
          const onOutpostPath = x >= 5 && x <= 16 && y >= 7 && y <= 13 && Math.abs(x - y) <= 6
          const onRidgeTrail = x >= 7 && x <= 18 && y >= 6 && y <= 11 && Math.abs(x - 12) + Math.abs(y - 8) <= 10
          const onShoreSand = x >= 8 && x <= 20 && y >= 5 && y <= 13
          let color = 0x637341

          if (blocked) {
            color = sceneId === "shore" ? 0x718564 : 0x546040
          } else if (sceneId === "outpost") {
            color = onOutpostPath ? ((x + y) % 2 === 0 ? 0xa98c59 : 0x96794a) : (x + y) % 2 === 0 ? 0x6e7f47 : 0x637341
          } else if (sceneId === "ridge") {
            color = onRidgeTrail ? ((x + y) % 2 === 0 ? 0xb89a68 : 0xa48759) : (x + y) % 2 === 0 ? 0x738259 : 0x66734a
          } else {
            color = onShoreSand ? ((x + y) % 2 === 0 ? 0xc8b181 : 0xb89f71) : (x + y) % 2 === 0 ? 0x6c8b80 : 0x5b7c73
          }

          this.fillDiamond(point.px, point.py, TILE_W, TILE_H, color, 1)
        }
      }

      if (sceneId === "outpost") {
        const start = projectPoint(6, 10, params)
        const end = projectPoint(16, 12, params)
        this.worldGraphics.fillStyle(0xf0dbad, 0.12)
        this.worldGraphics.fillEllipse((start.px + end.px) / 2, (start.py + end.py) / 2, 284, 96)
      }

      if (sceneId === "ridge") {
        const start = projectPoint(8, 8, params)
        const end = projectPoint(18, 9, params)
        this.worldGraphics.fillStyle(0xffe0a8, 0.1)
        this.worldGraphics.fillEllipse((start.px + end.px) / 2, (start.py + end.py) / 2, 260, 80)
      }

      if (sceneId === "shore") {
        const shoreline = projectPoint(19, 6, params)
        this.worldGraphics.fillStyle(0x7cd7ff, 0.2 + Math.sin(timeSeconds * 2) * 0.03)
        this.worldGraphics.fillEllipse(shoreline.px + 18, shoreline.py + 28, 150, 120)
      }
    }

    private drawHotspot(hotspot: SceneHotspot, params: ReturnType<typeof makeIsoParams>, mode: "idle" | "hover" | "active", timeSeconds: number) {
      const point = projectPoint(hotspot.anchorTile.x, hotspot.anchorTile.y, params)
      this.drawPulse(point.px, point.py - 34, mode === "active" ? 54 : 44, hotspot.accent, mode)

      switch (hotspot.renderKind) {
        case "desk":
          this.fillRect(point.px - 46, point.py - 24, 76, 18, 0x6a4630)
          this.fillRect(point.px - 42, point.py - 6, 8, 28, 0x4f3523)
          this.fillRect(point.px + 18, point.py - 6, 8, 28, 0x4f3523)
          this.fillRect(point.px - 10, point.py - 54, 36, 28, 0x201a18)
          this.fillRect(point.px - 6, point.py - 50, 28, 20, mode === "active" ? 0x95ffd5 : mode === "hover" ? 0x79f7c5 : 0x62c7aa)
          break
        case "bookshelf":
          this.fillRect(point.px - 32, point.py - 70, 28, 68, 0x7b5638)
          this.fillRect(point.px - 26, point.py - 64, 16, 8, 0xc95c52)
          this.fillRect(point.px - 22, point.py - 50, 14, 8, 0xd3a64b)
          this.fillRect(point.px - 25, point.py - 36, 17, 8, 0x5a88b6)
          this.fillRect(point.px - 20, point.py - 22, 12, 8, 0x78a35d)
          break
        case "window":
          this.fillRect(point.px - 42, point.py - 88, 84, 52, 0x6f5137)
          this.fillRect(point.px - 36, point.py - 82, 72, 40, mode === "active" ? 0xb6ebff : mode === "hover" ? 0x8fd9ff : 0x79bbeb)
          this.fillRect(point.px - 3, point.py - 82, 6, 40, 0x6f5137)
          this.fillRect(point.px - 36, point.py - 62, 72, 5, 0x6f5137)
          break
        case "bike":
          this.strokeCircle(point.px - 20, point.py - 8, 13, 0x161414)
          this.strokeCircle(point.px + 18, point.py - 8, 13, 0x161414)
          this.strokeLine(point.px - 20, point.py - 8, point.px - 4, point.py - 28, mode === "active" ? 0xffd58c : 0xf7c56f, 4)
          this.strokeLine(point.px - 4, point.py - 28, point.px + 18, point.py - 8, mode === "active" ? 0xffd58c : 0xf7c56f, 4)
          this.strokeLine(point.px - 20, point.py - 8, point.px + 6, point.py - 8, mode === "active" ? 0xffd58c : 0xf7c56f, 4)
          break
        case "record-player":
          this.fillRect(point.px - 24, point.py - 26, 38, 32, 0x5f4030)
          this.fillRect(point.px - 18, point.py - 20, 26, 20, 0x2d2320)
          this.fillCircle(point.px - 4, point.py - 10, 9, mode === "active" ? 0xffc1d3 : 0xd46b8a)
          this.strokeLine(point.px + 7, point.py - 17, point.px + 18, point.py - 24, 0xd9bc80, 3)
          break
        case "signpost":
          this.fillRect(point.px - 3, point.py - 40, 6, 34, 0x4e3527)
          this.fillRect(point.px - 30, point.py - 48, 42, 10, 0xb99359)
          this.fillRect(point.px - 24, point.py - 32, 38, 10, 0xc8a86a)
          break
        case "memory-cache":
          this.fillRect(point.px - 20, point.py - 24, 28, 18, 0x6a4c34)
          this.fillRect(point.px - 16, point.py - 20, 20, 10, mode === "active" ? 0xfff0b6 : mode === "hover" ? 0xf7d67a : 0xd8b463)
          this.fillRect(point.px - 4, point.py - 30, 6, 8, 0x8aa8c5)
          this.drawGlow(point.px - 1, point.py - 28, mode === "active" ? 20 : 13, 0xfff1a6, mode === "active" ? 0.28 : 0.18)
          break
        case "npc": {
          const accent = Number.parseInt(hotspot.accent.replace("#", ""), 16)
          this.fillCircle(point.px, point.py - 38, 10, accent)
          this.fillRect(point.px - 10, point.py - 26, 20, 24, 0x3a2d27)
          this.fillRect(point.px - 7, point.py - 14, 5, 14, accent)
          this.fillRect(point.px + 2, point.py - 14, 5, 14, accent)
          this.strokeLine(point.px - 6, point.py - 2, point.px - 12, point.py + 18, 0x3a2d27, 3)
          this.strokeLine(point.px + 6, point.py - 2, point.px + 12, point.py + 18, 0x3a2d27, 3)
          break
        }
        default:
          break
      }
    }

    private drawExit(exit: SceneExit, params: ReturnType<typeof makeIsoParams>, mode: "idle" | "hover" | "active", timeSeconds: number) {
      const point = projectPoint(exit.anchorTile.x, exit.anchorTile.y, params)
      const accent = mode === "active" ? 0x8ed7ff : mode === "hover" ? 0x74c8ff : 0x5ca2d6
      this.drawPulse(point.px - 4, point.py - 42, mode === "active" ? 56 : 40, `#${accent.toString(16).padStart(6, "0")}`, mode)
      this.fillRect(point.px - 30, point.py - 78, 12, 54, 0x6d5236)
      this.fillRect(point.px - 18, point.py - 84, 30, 66, 0x241719)
      this.fillRect(point.px - 14, point.py - 78, 22, 56, 0x35203a)
      for (let index = 0; index < 5; index += 1) {
        const wobble = Math.sin(timeSeconds * 4 + index) * 2
        this.strokeLine(point.px - 10 + index * 4, point.py - 78 + index * 10, point.px - 2 + wobble, point.py - 68 + index * 7, accent, 2)
      }
      this.fillRect(point.px - 10, point.py - 18, 24, 10, 0x6a4630)
    }

    private drawDecor(decor: SceneDecor, params: ReturnType<typeof makeIsoParams>, timeSeconds: number) {
      const point = projectPoint(decor.tileX, decor.tileY, params)
      switch (decor.kind) {
        case "plant":
          this.fillRect(point.px - 10, point.py - 10, 16, 12, 0x7c5839)
          this.strokeLine(point.px - 2, point.py - 12, point.px - 10, point.py - 32 + Math.sin(timeSeconds) * 2, 0x5f8b56, 4)
          this.strokeLine(point.px - 1, point.py - 12, point.px + 8, point.py - 34 - Math.sin(timeSeconds * 1.1) * 2, 0x6d9d5f, 4)
          this.strokeLine(point.px + 1, point.py - 12, point.px + 1, point.py - 38, 0x84b26c, 4)
          break
        case "lamp":
          this.fillRect(point.px - 2, point.py - 44, 4, 38, 0x3a302c)
          this.fillRect(point.px - 12, point.py - 56, 24, 16, 0xf3d28b)
          this.drawGlow(point.px, point.py - 48, 52 + Math.sin(timeSeconds * 1.5) * 3, 0xf3d28b, 0.25)
          break
        case "armchair":
          this.fillRect(point.px - 28, point.py - 24, 40, 26, 0x506f4b)
          this.fillRect(point.px - 26, point.py - 42, 36, 20, 0x5f8358)
          break
        case "tent":
          this.strokeLine(point.px, point.py - 56, point.px - 28, point.py - 8, 0x2a1e19, 2)
          this.strokeLine(point.px, point.py - 56, point.px + 32, point.py - 10, 0x2a1e19, 2)
          this.strokeLine(point.px - 28, point.py - 8, point.px + 32, point.py - 10, 0x2a1e19, 2)
          this.worldGraphics.fillStyle(0xd0ad6d, 1)
          this.worldGraphics.fillTriangle(point.px, point.py - 56, point.px - 28, point.py - 8, point.px + 32, point.py - 10)
          this.fillRect(point.px - 8, point.py - 26, 12, 18, 0x62422f)
          break
        case "campfire":
          this.drawGlow(point.px, point.py - 18, 38 + Math.sin(timeSeconds * 7) * 2, 0xffb866, 0.22)
          this.strokeLine(point.px - 12, point.py - 2, point.px + 10, point.py - 18, 0x5d3c28, 4)
          this.strokeLine(point.px - 10, point.py - 18, point.px + 12, point.py - 2, 0x5d3c28, 4)
          this.fillRect(point.px - 8, point.py - 28, 6, 12, 0xffd27c)
          this.fillRect(point.px - 2, point.py - 34, 6, 18, 0xff8f55)
          this.fillRect(point.px + 4, point.py - 26, 5, 10, 0xffe09a)
          break
        case "memory-cache":
          this.fillRect(point.px - 20, point.py - 24, 28, 18, 0x6a4c34)
          this.fillRect(point.px - 16, point.py - 20, 20, 10, 0xd8b463)
          this.fillRect(point.px - 4, point.py - 30, 6, 8, 0x8aa8c5)
          if (decor.accent) {
            this.drawGlow(point.px - 1, point.py - 28, 12 + Math.sin(timeSeconds * 3) * 2, Number.parseInt(decor.accent.replace("#", ""), 16), 0.16)
          }
          break
        case "shore-wave":
          this.strokeLine(point.px - 22, point.py - 8, point.px - 6, point.py - 14 + Math.sin(timeSeconds * 2) * 2, 0xd8f7ff, 3)
          this.strokeLine(point.px - 6, point.py - 14 + Math.sin(timeSeconds * 2) * 2, point.px + 10, point.py - 8, 0xd8f7ff, 3)
          this.strokeLine(point.px + 10, point.py - 8, point.px + 28, point.py - 12, 0xd8f7ff, 3)
          break
        default:
          break
      }
    }

    private handlePointerInteraction(px: number, py: number, hitArea: InteractiveHitArea | null) {
      if (this.snapshot.inputLocked) return

      if (hitArea) {
        this.sendTargetInteraction(this.toHoverTarget(hitArea))
        return
      }

      const params = makeIsoParams(
        this.scale.width,
        this.scale.height,
        this.snapshot.scene.grid.cols,
        this.snapshot.scene.grid.rows,
        this.snapshot.scene.camera.paddingTop
      )
      const tile = unprojectPoint(px, py, params)
      bridge.send({
        type: "moveToTile",
        target: {
          x: tile.tx,
          y: tile.ty,
        },
      })
    }

    private sendTargetInteraction(target: HoverTarget) {
      if (target.kind === "dog") {
        bridge.send({ type: "interactDog" })
      } else if (target.kind === "npc") {
        bridge.send({ type: "interactNpc", npcId: target.npcId })
      } else if (target.kind === "exit") {
        bridge.send({ type: "interactExit", exitId: target.id })
      } else {
        bridge.send({ type: "interactHotspot", hotspotId: target.id })
      }
    }

    private getHitAreas() {
      const params = makeIsoParams(
        this.scale.width,
        this.scale.height,
        this.snapshot.scene.grid.cols,
        this.snapshot.scene.grid.rows,
        this.snapshot.scene.camera.paddingTop
      )
      const hitAreas: InteractiveHitArea[] = []

      for (const hotspot of this.snapshot.scene.hotspots) {
        const point = projectPoint(hotspot.anchorTile.x, hotspot.anchorTile.y, params)
        hitAreas.push({
          kind: "hotspot",
          id: hotspot.id,
          x: point.px + hotspot.hitbox.offsetX,
          y: point.py + hotspot.hitbox.offsetY,
          w: hotspot.hitbox.width,
          h: hotspot.hitbox.height,
          snapDistance: hotspot.hitbox.snapDistance,
        })
      }

      for (const exit of this.snapshot.scene.exits) {
        const point = projectPoint(exit.anchorTile.x, exit.anchorTile.y, params)
        hitAreas.push({
          kind: "exit",
          id: exit.id,
          x: point.px + exit.hitbox.offsetX,
          y: point.py + exit.hitbox.offsetY,
          w: exit.hitbox.width,
          h: exit.hitbox.height,
          snapDistance: exit.hitbox.snapDistance,
        })
      }

      const dogPoint = projectPoint(this.snapshot.dog.visual.x, this.snapshot.dog.visual.y, params)
      hitAreas.push({
        kind: "dog",
        id: "dog",
        x: dogPoint.px - 18,
        y: dogPoint.py - 24,
        w: 36,
        h: 28,
        snapDistance: 18,
      })

      return hitAreas
    }

    private resolveHitArea(px: number, py: number) {
      return resolveInteractiveTarget(px, py, this.getHitAreas())
    }

    private toHoverTarget(hitArea: InteractiveHitArea): HoverTarget {
      if (hitArea.kind === "dog") {
        return dogTarget()
      }
      if (hitArea.kind === "exit") {
        const exit = this.snapshot.scene.exits.find((item) => item.id === hitArea.id)
        return exit ? hoverTargetFromExit(exit) : dogTarget()
      }
      const hotspot = this.snapshot.scene.hotspots.find((item) => item.id === hitArea.id)
      return hotspot ? hoverTargetFromHotspot(hotspot) : dogTarget()
    }

    private fillDiamond(px: number, py: number, width: number, height: number, color: number, alpha: number) {
      const hw = width / 2
      const hh = height / 2
      this.worldGraphics.fillStyle(color, alpha)
      this.worldGraphics.beginPath()
      this.worldGraphics.moveTo(px, py)
      this.worldGraphics.lineTo(px + hw, py + hh)
      this.worldGraphics.lineTo(px, py + height)
      this.worldGraphics.lineTo(px - hw, py + hh)
      this.worldGraphics.closePath()
      this.worldGraphics.fillPath()
      this.worldGraphics.lineStyle(1, 0x241914, 1)
      this.worldGraphics.strokePath()
    }

    private drawRaisedBlock(px: number, py: number, topColor: number, sideColor: number) {
      this.fillDiamond(px, py - 8, TILE_W, TILE_H, topColor, 1)
      this.worldGraphics.fillStyle(sideColor, 1)
      this.worldGraphics.fillTriangle(px, py + TILE_H - 8, px + TILE_W / 2, py + TILE_H / 2 - 8, px, py + TILE_H)
      this.worldGraphics.fillStyle(0x5b4330, 1)
      this.worldGraphics.fillTriangle(px, py + TILE_H - 8, px - TILE_W / 2, py + TILE_H / 2 - 8, px, py + TILE_H)
    }

    private drawPulse(x: number, y: number, radius: number, accent: string, mode: "idle" | "hover" | "active") {
      if (mode === "idle") return
      const color = Number.parseInt(accent.replace("#", ""), 16)
      this.drawGlow(x, y, radius, color, mode === "active" ? 0.32 : 0.18)
    }

    private drawGlow(x: number, y: number, radius: number, color: number, alpha: number) {
      this.worldGraphics.fillStyle(color, alpha)
      this.worldGraphics.fillCircle(x, y, radius)
    }

    private fillRect(x: number, y: number, width: number, height: number, color: number) {
      this.worldGraphics.fillStyle(color, 1)
      this.worldGraphics.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height))
      this.worldGraphics.lineStyle(1, 0x1d1511, 1)
      this.worldGraphics.strokeRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height))
    }

    private fillCircle(x: number, y: number, radius: number, color: number) {
      this.worldGraphics.fillStyle(color, 1)
      this.worldGraphics.fillCircle(x, y, radius)
      this.worldGraphics.lineStyle(1, 0x1d1511, 1)
      this.worldGraphics.strokeCircle(x, y, radius)
    }

    private strokeCircle(x: number, y: number, radius: number, color: number) {
      this.worldGraphics.lineStyle(3, color, 1)
      this.worldGraphics.strokeCircle(x, y, radius)
      this.worldGraphics.lineStyle(1, 0x1d1511, 1)
      this.worldGraphics.strokeCircle(x, y, radius - 4)
    }

    private strokeLine(x1: number, y1: number, x2: number, y2: number, color: number, width: number) {
      this.worldGraphics.lineStyle(width, color, 1)
      this.worldGraphics.beginPath()
      this.worldGraphics.moveTo(x1, y1)
      this.worldGraphics.lineTo(x2, y2)
      this.worldGraphics.strokePath()
    }
  }
}

function hoverTargetFromHotspot(hotspot: SceneHotspot): HoverTarget {
  if (hotspot.kind === "npc" && hotspot.npcId) {
    return {
      kind: "npc",
      id: hotspot.id,
      label: hotspot.label,
      hint: hotspot.hint,
      accent: hotspot.accent,
      npcId: hotspot.npcId,
    }
  }

  return {
    kind: "hotspot",
    id: hotspot.id,
    label: hotspot.label,
    hint: hotspot.hint,
    accent: hotspot.accent,
  }
}

function hoverTargetFromExit(exit: SceneExit): HoverTarget {
  return {
    kind: "exit",
    id: exit.id,
    label: exit.label,
    hint: exit.hint,
    accent: exit.accent,
  }
}

function dogTarget(): HoverTarget {
  return {
    kind: "dog",
    id: "dog",
    label: "柴犬",
    hint: "点一下会摇尾巴并叫一声。",
    accent: "#f4c76d",
  }
}
