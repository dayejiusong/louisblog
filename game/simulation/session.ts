import type {
  AchievementId,
  ActorTileState,
  DynamicEventId,
  NpcId,
  ObjectiveId,
  QuestId,
  QuestStageId,
  SceneId,
  ScrapbookEntryId,
  TimeOfDay,
  Weather,
  WorldProgress,
} from "../types.ts"

export type AdventureSessionState = {
  currentSceneId: SceneId
  sceneActors: Record<SceneId, { player: ActorTileState; dog: ActorTileState }>
  audioEnabled: boolean
  progress: WorldProgress
}

export const ADVENTURE_SESSION_KEY = "adventure-runtime-state-v5"

export type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function isFacing(value: unknown): value is ActorTileState["facing"] {
  return value === "N" || value === "S" || value === "E" || value === "W"
}

function isSceneId(value: unknown): value is SceneId {
  return value === "room" || value === "outpost" || value === "ridge" || value === "shore"
}

function isObjectiveId(value: unknown): value is ObjectiveId {
  return value === "leave-room" || value === "find-ridge-cache" || value === "visit-shore" || value === "recover-shore-memory"
}

function isNpcId(value: unknown): value is NpcId {
  return value === "camp-keeper" || value === "ridge-scout" || value === "shore-listener"
}

function isQuestId(value: unknown): value is QuestId {
  return value === "camp-expedition"
}

function isQuestStageId(value: unknown): value is QuestStageId {
  return (
    value === "meet-camp-keeper" ||
    value === "reach-ridge-scout" ||
    value === "collect-ridge-cache" ||
    value === "report-to-camp" ||
    value === "reach-shore-listener" ||
    value === "collect-shore-memory" ||
    value === "final-report"
  )
}

function isTimeOfDay(value: unknown): value is TimeOfDay {
  return value === "day" || value === "dusk" || value === "night"
}

function isWeather(value: unknown): value is Weather {
  return value === "clear" || value === "drizzle" || value === "fog"
}

function isDynamicEventId(value: unknown): value is DynamicEventId {
  return value === "window-rain" || value === "campfire-circle" || value === "ridge-fog" || value === "luminous-tide"
}

function isAchievementId(value: unknown): value is AchievementId {
  return value === "night-watch" || value === "all-friends" || value === "memory-bearer" || value === "weather-reader" || value === "camp-complete"
}

function isScrapbookEntryId(value: unknown): value is ScrapbookEntryId {
  return (
    value === "first-departure" ||
    value === "campfire-note" ||
    value === "ridge-postcard" ||
    value === "shore-postcard" ||
    value === "expedition-epilogue"
  )
}

function isActorTileState(value: unknown): value is ActorTileState {
  if (!value || typeof value !== "object") return false
  const actor = value as Partial<ActorTileState>
  return typeof actor.x === "number" && typeof actor.y === "number" && isFacing(actor.facing)
}

function isArrayOf<T>(value: unknown, matcher: (entry: unknown) => entry is T): value is T[] {
  return Array.isArray(value) && value.every(matcher)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
}

function isWorldProgress(value: unknown): value is WorldProgress {
  if (!value || typeof value !== "object") return false
  const progress = value as Partial<WorldProgress>

  return (
    isArrayOf(progress.unlockedScenes, isSceneId) &&
    isArrayOf(progress.visitedScenes, isSceneId) &&
    isStringArray(progress.collectedMemories) &&
    isArrayOf(progress.completedObjectives, isObjectiveId) &&
    (progress.activeQuestId === null || isQuestId(progress.activeQuestId)) &&
    (progress.activeQuestStageId === null || isQuestStageId(progress.activeQuestStageId)) &&
    isArrayOf(progress.completedQuestStageIds, isQuestStageId) &&
    isArrayOf(progress.metNpcIds, isNpcId) &&
    typeof progress.taskPanelSeen === "boolean" &&
    isTimeOfDay(progress.timeOfDay) &&
    isWeather(progress.weather) &&
    isArrayOf(progress.seenTimesOfDay, isTimeOfDay) &&
    isArrayOf(progress.seenWeather, isWeather) &&
    isArrayOf(progress.seenDynamicEventIds, isDynamicEventId) &&
    isArrayOf(progress.unlockedAchievementIds, isAchievementId) &&
    isArrayOf(progress.unlockedScrapbookEntryIds, isScrapbookEntryId)
  )
}

export function parseAdventureSession(raw: string | null) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<AdventureSessionState>
    if (!parsed || typeof parsed !== "object") return null
    if (!isSceneId(parsed.currentSceneId)) return null
    if (typeof parsed.audioEnabled !== "boolean") return null

    const room = parsed.sceneActors?.room
    const outpost = parsed.sceneActors?.outpost
    const ridge = parsed.sceneActors?.ridge
    const shore = parsed.sceneActors?.shore
    if (!room || !outpost || !ridge || !shore) return null
    if (!isActorTileState(room.player) || !isActorTileState(room.dog)) return null
    if (!isActorTileState(outpost.player) || !isActorTileState(outpost.dog)) return null
    if (!isActorTileState(ridge.player) || !isActorTileState(ridge.dog)) return null
    if (!isActorTileState(shore.player) || !isActorTileState(shore.dog)) return null
    if (!isWorldProgress(parsed.progress)) return null

    return parsed as AdventureSessionState
  } catch {
    return null
  }
}

export function loadAdventureSession(storage?: StorageLike | null) {
  const targetStorage = storage ?? (typeof window === "undefined" ? null : window.sessionStorage)
  if (!targetStorage) return null
  return parseAdventureSession(targetStorage.getItem(ADVENTURE_SESSION_KEY))
}

export function saveAdventureSession(state: AdventureSessionState, storage?: StorageLike | null) {
  const targetStorage = storage ?? (typeof window === "undefined" ? null : window.sessionStorage)
  if (!targetStorage) return

  try {
    targetStorage.setItem(ADVENTURE_SESSION_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage failures in private or restricted environments.
  }
}
