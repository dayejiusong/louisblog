import type { SectionSlug, RoomHotspot } from "../lib/blog-content.ts"
import type { RoomGrid, RoomPoint } from "../lib/room-grid.ts"

export type SceneId = "room" | "outpost"
export type Facing = "N" | "S" | "E" | "W"

export type WorldDestination = {
  id: string
  label: string
  description: string
  available: boolean
  targetSceneId?: SceneId
}

export type Hitbox = {
  offsetX: number
  offsetY: number
  width: number
  height: number
  snapDistance: number
}

export type SceneTheme = {
  backgroundTop: number
  backgroundMid: number
  backgroundBottom: number
  dimOverlay: number
  hudAccent: string
}

export type SceneUiCopy = {
  title: string
  description: string
  primaryPanelTitle: string
  primaryPanelBody: string[]
  secondaryPanelTitle: string
  secondaryPanelBody: string[]
}

export type SceneDecorKind =
  | "desk"
  | "bookshelf"
  | "window"
  | "bike"
  | "record-player"
  | "exit-crack"
  | "plant"
  | "lamp"
  | "armchair"
  | "return-crack"
  | "tent"
  | "signpost"
  | "campfire"

export type SceneDecor = {
  id: string
  kind: SceneDecorKind
  tileX: number
  tileY: number
  drawOrder: number
  accent?: string
}

export type SceneHotspot = Omit<RoomHotspot, "id"> & {
  id: string
  kind: "section" | "world-map"
  anchorTile: { x: number; y: number }
  hitbox: Hitbox
  renderKind: Extract<SceneDecorKind, "desk" | "bookshelf" | "window" | "bike" | "record-player" | "signpost">
  worldDestinations?: WorldDestination[]
}

export type SceneExit = {
  id: string
  label: string
  hint: string
  accent: string
  anchorTile: { x: number; y: number }
  interactionTile: RoomPoint
  hitbox: Hitbox
  targetSceneId: SceneId
  renderKind: Extract<SceneDecorKind, "exit-crack" | "return-crack">
}

export type SceneDefinition = {
  id: SceneId
  grid: RoomGrid
  spawn: { player: ActorTileState; dog: ActorTileState }
  hotspots: SceneHotspot[]
  exits: SceneExit[]
  decor: SceneDecor[]
  theme: SceneTheme
  camera: {
    mode: "fixed"
    paddingTop: number
  }
  ui: SceneUiCopy
}

export type ActorTileState = {
  x: number
  y: number
  facing: Facing
}

export type ActorVisualState = {
  x: number
  y: number
  facing: Facing
  moving: boolean
}

export type HoverTarget =
  | {
      kind: "hotspot"
      id: string
      label: string
      hint: string
      accent: string
    }
  | {
      kind: "exit"
      id: string
      label: string
      hint: string
      accent: string
    }
  | {
      kind: "dog"
      id: "dog"
      label: string
      hint: string
      accent: string
    }

export type QueuedInteraction =
  | {
      kind: "hotspot"
      id: string
      label: string
    }
  | {
      kind: "exit"
      id: string
      label: string
    }
  | {
      kind: "world-map"
      id: string
      label: string
    }
  | null

export type TransitionState =
  | {
      phase: "idle"
    }
  | {
      phase: "switching"
      toSceneId: SceneId
      remainingMs: number
    }

export type DogAnimationState = {
  phase: "idle" | "patrol" | "follow" | "wag"
  moving: boolean
  wagging: boolean
  speed: "idle" | "walk" | "run"
}

export type AdventureSnapshot = {
  sceneId: SceneId
  scene: SceneDefinition
  player: {
    currentTile: ActorTileState
    visual: ActorVisualState
    bubble: string | null
  }
  dog: {
    currentTile: ActorTileState
    visual: ActorVisualState
    bubble: string | null
    animation: DogAnimationState
  }
  hoverTarget: HoverTarget | null
  contextTarget: HoverTarget | null
  queuedInteraction: QueuedInteraction
  activeSection: SectionSlug | null
  audioEnabled: boolean
  transitionState: TransitionState
  worldMapOpen: boolean
  worldDestinations: WorldDestination[]
  inputLocked: boolean
}

export type AdventureCommand =
  | {
      type: "moveToTile"
      target: RoomPoint
    }
  | {
      type: "interactHotspot"
      hotspotId: string
    }
  | {
      type: "interactExit"
      exitId: string
    }
  | {
      type: "interactDog"
    }
  | {
      type: "transitionToScene"
      sceneId: SceneId
    }
  | {
      type: "returnHome"
    }
  | {
      type: "openSection"
      slug: SectionSlug
    }
  | {
      type: "closeSection"
    }
  | {
      type: "toggleAudio"
    }
  | {
      type: "setHoverTarget"
      target: HoverTarget | null
    }
  | {
      type: "setWorldMapOpen"
      open: boolean
    }

export type SoundEvent = "hover" | "confirm" | "open" | "switch" | "close" | "blocked"

export type AdventureDispatchResult = {
  sounds: SoundEvent[]
}
