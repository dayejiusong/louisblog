export type Facing = "N" | "S" | "E" | "W"

export type RoomAvatarState = {
  x: number
  y: number
  facing: Facing
}

export const ROOM_SESSION_KEY = "personal-room-state-v1"

export function loadRoomAvatarState() {
  if (typeof window === "undefined") return null

  try {
    const raw = window.sessionStorage.getItem(ROOM_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RoomAvatarState>
    if (
      typeof parsed.x !== "number" ||
      typeof parsed.y !== "number" ||
      !parsed.facing ||
      !["N", "S", "E", "W"].includes(parsed.facing)
    ) {
      return null
    }
    return parsed as RoomAvatarState
  } catch {
    return null
  }
}

export function saveRoomAvatarState(state: RoomAvatarState) {
  if (typeof window === "undefined") return

  try {
    window.sessionStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage failures in private or restricted environments.
  }
}
