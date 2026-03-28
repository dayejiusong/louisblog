import type { ActorTileState, SceneId } from "../types.ts"

export type AdventureSessionState = {
  currentSceneId: SceneId
  sceneActors: Record<SceneId, { player: ActorTileState; dog: ActorTileState }>
  audioEnabled: boolean
}

export const ADVENTURE_SESSION_KEY = "adventure-runtime-state-v3"

export type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function isFacing(value: unknown): value is ActorTileState["facing"] {
  return value === "N" || value === "S" || value === "E" || value === "W"
}

function isActorTileState(value: unknown): value is ActorTileState {
  if (!value || typeof value !== "object") return false
  const actor = value as Partial<ActorTileState>
  return typeof actor.x === "number" && typeof actor.y === "number" && isFacing(actor.facing)
}

export function parseAdventureSession(raw: string | null) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<AdventureSessionState>
    if (!parsed || typeof parsed !== "object") return null
    if (parsed.currentSceneId !== "room" && parsed.currentSceneId !== "outpost") return null
    if (typeof parsed.audioEnabled !== "boolean") return null

    const room = parsed.sceneActors?.room
    const outpost = parsed.sceneActors?.outpost
    if (!room || !outpost) return null
    if (!isActorTileState(room.player) || !isActorTileState(room.dog)) return null
    if (!isActorTileState(outpost.player) || !isActorTileState(outpost.dog)) return null

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
