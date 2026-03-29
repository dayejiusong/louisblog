import type { SectionSlug, RoomHotspot } from "../lib/blog-content.ts"
import type { RoomGrid, RoomPoint } from "../lib/room-grid.ts"

export type SceneId = "room" | "outpost" | "ridge" | "shore"
export type Facing = "N" | "S" | "E" | "W"
export type ObjectiveId = "leave-room" | "find-ridge-cache" | "visit-shore" | "recover-shore-memory"
export type NpcId = "camp-keeper" | "ridge-scout" | "shore-listener"
export type QuestId = "camp-expedition"
export type QuestStageId =
  | "meet-camp-keeper"
  | "reach-ridge-scout"
  | "collect-ridge-cache"
  | "report-to-camp"
  | "reach-shore-listener"
  | "collect-shore-memory"
  | "final-report"

export type TimeOfDay = "day" | "dusk" | "night"
export type Weather = "clear" | "drizzle" | "fog"
export type DynamicEventId = "window-rain" | "campfire-circle" | "ridge-fog" | "luminous-tide"
export type AchievementId = "night-watch" | "all-friends" | "memory-bearer" | "weather-reader" | "camp-complete"
export type ScrapbookEntryId = "first-departure" | "campfire-note" | "ridge-postcard" | "shore-postcard" | "expedition-epilogue"

export type ObjectiveSummary = {
  id: string
  label: string
  description: string
  status: "active" | "completed" | "locked"
}

export type WorldProgress = {
  unlockedScenes: SceneId[]
  visitedScenes: SceneId[]
  collectedMemories: string[]
  completedObjectives: ObjectiveId[]
  activeQuestId: QuestId | null
  activeQuestStageId: QuestStageId | null
  completedQuestStageIds: QuestStageId[]
  metNpcIds: NpcId[]
  taskPanelSeen: boolean
  timeOfDay: TimeOfDay
  weather: Weather
  seenTimesOfDay: TimeOfDay[]
  seenWeather: Weather[]
  seenDynamicEventIds: DynamicEventId[]
  unlockedAchievementIds: AchievementId[]
  unlockedScrapbookEntryIds: ScrapbookEntryId[]
}

export type WorldDestination = {
  id: string
  label: string
  description: string
  available: boolean
  targetSceneId: SceneId
  lockedReason?: string
  collectibleHint?: string
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
  | "memory-cache"
  | "shore-wave"
  | "npc"

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
  kind: "section" | "world-map" | "collectible" | "npc"
  anchorTile: { x: number; y: number }
  hitbox: Hitbox
  renderKind: Extract<
    SceneDecorKind,
    "desk" | "bookshelf" | "window" | "bike" | "record-player" | "signpost" | "memory-cache" | "npc"
  >
  worldDestinations?: WorldDestination[]
  collectibleId?: string
  collectibleLabel?: string
  npcId?: NpcId
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

export type NpcDefinition = {
  id: NpcId
  label: string
  role: string
  sceneId: SceneId
  accent: string
  profile: string
}

export type QuestStageDefinition = {
  id: QuestStageId
  label: string
  description: string
  nextLocation: string
}

export type DialogueSummary = {
  npcId: NpcId
  npcLabel: string
  sceneId: SceneId
  title: string
  lines: string[]
}

export type NpcSummary = {
  id: NpcId
  label: string
  role: string
  sceneId: SceneId
  accent: string
  met: boolean
  active: boolean
  profile: string
}

export type QuestStageSummary = {
  id: QuestStageId
  label: string
  description: string
  nextLocation: string
  status: "active" | "completed" | "locked"
}

export type QuestSummary = {
  id: QuestId
  label: string
  status: "active" | "completed"
  currentStageId: QuestStageId | null
  currentStageLabel: string | null
  currentStageDescription: string | null
  nextLocation: string | null
  progressLabel: string
  completedStageIds: QuestStageId[]
  stages: QuestStageSummary[]
}

export type EnvironmentSummary = {
  timeOfDay: TimeOfDay
  weather: Weather
  timeLabel: string
  weatherLabel: string
  sceneAmbience: string
}

export type DynamicEventSummary = {
  id: DynamicEventId
  label: string
  sceneId: SceneId
  description: string
  active: boolean
}

export type AchievementSummary = {
  id: AchievementId
  label: string
  description: string
  unlocked: boolean
}

export type ScrapbookEntrySummary = {
  id: ScrapbookEntryId
  title: string
  eyebrow: string
  caption: string
  unlocked: boolean
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
      kind: "npc"
      id: string
      label: string
      hint: string
      accent: string
      npcId: NpcId
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
      kind: "npc"
      id: string
      label: string
      npcId: NpcId
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
  phase: "idle" | "follow" | "wag"
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
  activeNpc: NpcSummary | null
  audioEnabled: boolean
  transitionState: TransitionState
  worldMapOpen: boolean
  worldDestinations: WorldDestination[]
  progress: WorldProgress
  objectives: ObjectiveSummary[]
  quest: QuestSummary
  npcs: NpcSummary[]
  taskPanelOpen: boolean
  recentDialogue: DialogueSummary | null
  environment: EnvironmentSummary
  dynamicEvent: DynamicEventSummary | null
  achievements: AchievementSummary[]
  scrapbook: ScrapbookEntrySummary[]
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
      type: "interactNpc"
      npcId: NpcId
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
      type: "openTaskPanel"
    }
  | {
      type: "closeTaskPanel"
    }
  | {
      type: "acknowledgeDialogue"
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
