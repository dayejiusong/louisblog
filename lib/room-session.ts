export type Facing = "N" | "S" | "E" | "W"

export type RoomAvatarState = {
  x: number
  y: number
  facing: Facing
}

export type SceneMode = "room" | "departing" | "outpost"

export type AdventureScene = Exclude<SceneMode, "departing">

export type AdventureSessionState = {
  scene: AdventureScene
  roomAvatar: RoomAvatarState
  outpostAvatar: RoomAvatarState
}

export const ROOM_SESSION_KEY = "personal-room-state-v2"

const defaultRoomAvatar: RoomAvatarState = { x: 10, y: 10, facing: "N" }
const defaultOutpostAvatar: RoomAvatarState = { x: 6, y: 11, facing: "E" }

function isFacing(value: unknown): value is Facing {
  return value === "N" || value === "S" || value === "E" || value === "W"
}

function isAvatarState(value: unknown): value is RoomAvatarState {
  if (!value || typeof value !== "object") return false
  const avatar = value as Partial<RoomAvatarState>
  return typeof avatar.x === "number" && typeof avatar.y === "number" && isFacing(avatar.facing)
}

function defaultSession(): AdventureSessionState {
  return {
    scene: "room",
    roomAvatar: defaultRoomAvatar,
    outpostAvatar: defaultOutpostAvatar,
  }
}

export function loadAdventureSession() {
  if (typeof window === "undefined") return null

  try {
    const raw = window.sessionStorage.getItem(ROOM_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown

    if (isAvatarState(parsed)) {
      return {
        ...defaultSession(),
        roomAvatar: parsed,
      } satisfies AdventureSessionState
    }

    if (!parsed || typeof parsed !== "object") {
      return null
    }

    const session = parsed as Partial<AdventureSessionState>

    if (
      (session.scene === "room" || session.scene === "outpost") &&
      isAvatarState(session.roomAvatar) &&
      isAvatarState(session.outpostAvatar)
    ) {
      return session as AdventureSessionState
    }

    return null
  } catch {
    return null
  }
}

export function saveAdventureSession(state: AdventureSessionState) {
  if (typeof window === "undefined") return

  try {
    window.sessionStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage failures in private or restricted environments.
  }
}

function mergeAdventureSession(next: Partial<AdventureSessionState>) {
  const current = loadAdventureSession() ?? defaultSession()
  saveAdventureSession({
    ...current,
    ...next,
  })
}

export function loadRoomAvatarState() {
  return (loadAdventureSession() ?? defaultSession()).roomAvatar
}

export function loadOutpostAvatarState() {
  return (loadAdventureSession() ?? defaultSession()).outpostAvatar
}

export function loadAdventureScene() {
  return (loadAdventureSession() ?? defaultSession()).scene
}

export function saveRoomAvatarState(state: RoomAvatarState) {
  mergeAdventureSession({ roomAvatar: state })
}

export function saveOutpostAvatarState(state: RoomAvatarState) {
  mergeAdventureSession({ outpostAvatar: state })
}

export function saveAdventureScene(scene: AdventureScene) {
  mergeAdventureSession({ scene })
}
