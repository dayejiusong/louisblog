import { getSceneDefinition, sceneDefinitions } from "../content/scenes.ts"
import { createDogRuntime, tickDogRuntime, triggerDogInteraction } from "./dog-system.ts"
import { loadAdventureSession, saveAdventureSession, type AdventureSessionState } from "./session.ts"
import type {
  ActorTileState,
  AdventureCommand,
  AdventureDispatchResult,
  AdventureSnapshot,
  HoverTarget,
  QueuedInteraction,
  SceneDefinition,
  SceneExit,
  SceneHotspot,
  SceneId,
  SoundEvent,
  TransitionState,
} from "../types.ts"
import { aStar } from "../../lib/pathfinding.ts"
import { clampTileToInterior, roomGridIndex, type RoomPoint } from "../../lib/room-grid.ts"

type Listener = () => void

type PathState = {
  nodes: RoomPoint[]
  progress: number
  speed: number
}

type PendingAction =
  | {
      kind: "hotspot"
      hotspotId: string
    }
  | {
      kind: "exit"
      exitId: string
    }
  | {
      kind: "world-map"
      hotspotId: string
    }
  | null

type SceneRuntime = {
  player: ActorTileState
  playerVisual: {
    x: number
    y: number
    facing: ActorTileState["facing"]
  }
  path: PathState | null
  dog: ReturnType<typeof createDogRuntime>
}

const PLAYER_SPEED = 3.7
const TRANSITION_DURATION_MS = 720
const PLAYER_BUBBLE_DURATION = 1.8

function cloneActor(actor: ActorTileState): ActorTileState {
  return {
    x: actor.x,
    y: actor.y,
    facing: actor.facing,
  }
}

function roundActor(actor: { x: number; y: number; facing: ActorTileState["facing"] }) {
  return {
    x: Math.round(actor.x),
    y: Math.round(actor.y),
    facing: actor.facing,
  }
}

function makeSceneRuntime(scene: SceneDefinition, player: ActorTileState, dog: ActorTileState): SceneRuntime {
  return {
    player: cloneActor(player),
    playerVisual: { ...player },
    path: null,
    dog: createDogRuntime(cloneActor(dog)),
  }
}

function createDefaultSession(): AdventureSessionState {
  return {
    currentSceneId: "room",
    sceneActors: {
      room: {
        player: cloneActor(sceneDefinitions.room.spawn.player),
        dog: cloneActor(sceneDefinitions.room.spawn.dog),
      },
      outpost: {
        player: cloneActor(sceneDefinitions.outpost.spawn.player),
        dog: cloneActor(sceneDefinitions.outpost.spawn.dog),
      },
    },
    audioEnabled: true,
  }
}

function hoverTargetFromHotspot(hotspot: SceneHotspot): HoverTarget {
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

function buildQueuedInteraction(kind: PendingAction, scene: SceneDefinition): QueuedInteraction {
  if (!kind) return null
  if (kind.kind === "hotspot") {
    const hotspot = scene.hotspots.find((item) => item.id === kind.hotspotId)
    return hotspot ? { kind: "hotspot", id: hotspot.id, label: hotspot.label } : null
  }
  if (kind.kind === "world-map") {
    const hotspot = scene.hotspots.find((item) => item.id === kind.hotspotId)
    return hotspot ? { kind: "world-map", id: hotspot.id, label: hotspot.label } : null
  }
  const exit = scene.exits.find((item) => item.id === kind.exitId)
  return exit ? { kind: "exit", id: exit.id, label: exit.label } : null
}

function isNear(target: RoomPoint, actor: ActorTileState, threshold = 1.2) {
  return Math.hypot(target.x - actor.x, target.y - actor.y) <= threshold
}

export type AdventureStore = {
  subscribe: (listener: Listener) => () => void
  getSnapshot: () => AdventureSnapshot
  dispatch: (command: AdventureCommand) => AdventureDispatchResult
  tick: (dt: number) => void
  destroy: () => void
}

export function createAdventureStore(): AdventureStore {
  const listeners = new Set<Listener>()
  const restoredSession = loadAdventureSession() ?? createDefaultSession()

  const sceneRuntimes: Record<SceneId, SceneRuntime> = {
    room: makeSceneRuntime(sceneDefinitions.room, restoredSession.sceneActors.room.player, restoredSession.sceneActors.room.dog),
    outpost: makeSceneRuntime(
      sceneDefinitions.outpost,
      restoredSession.sceneActors.outpost.player,
      restoredSession.sceneActors.outpost.dog
    ),
  }

  let currentSceneId: SceneId = restoredSession.currentSceneId
  let hoverTarget: HoverTarget | null = null
  let activeSection: AdventureSnapshot["activeSection"] = null
  let worldMapOpen = false
  let audioEnabled = restoredSession.audioEnabled
  let queuedInteraction: PendingAction = null
  let playerBubble: { text: string; remaining: number } | null = null
  let transitionTimerMs = 0
  let transitionState: TransitionState = { phase: "idle" }
  let snapshot = computeSnapshot()

  function notify() {
    snapshot = computeSnapshot()
    listeners.forEach((listener) => listener())
  }

  function persistSession() {
    saveAdventureSession({
      currentSceneId,
      sceneActors: {
        room: {
          player: cloneActor(sceneRuntimes.room.player),
          dog: cloneActor(sceneRuntimes.room.dog.currentTile),
        },
        outpost: {
          player: cloneActor(sceneRuntimes.outpost.player),
          dog: cloneActor(sceneRuntimes.outpost.dog.currentTile),
        },
      },
      audioEnabled,
    })
  }

  function getCurrentScene() {
    return getSceneDefinition(currentSceneId)
  }

  function getCurrentRuntime() {
    return sceneRuntimes[currentSceneId]
  }

  function inputLocked() {
    return Boolean(activeSection) || worldMapOpen || transitionState.phase !== "idle"
  }

  function updatePlayerBubble(text: string | null, duration = PLAYER_BUBBLE_DURATION) {
    playerBubble = text ? { text, remaining: duration } : null
  }

  function updatePlayerFacing(nextX: number, nextY: number) {
    const runtime = getCurrentRuntime()
    const dx = nextX - runtime.player.x
    const dy = nextY - runtime.player.y
    runtime.player.facing = Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? "E" : "W") : dy >= 0 ? "S" : "N"
    runtime.playerVisual.facing = runtime.player.facing
  }

  function completePendingAction() {
    const scene = getCurrentScene()
    if (!queuedInteraction) return
    const currentInteraction = queuedInteraction

    if (currentInteraction.kind === "hotspot") {
      const hotspot = scene.hotspots.find((item) => item.id === currentInteraction.hotspotId)
      if (hotspot && hotspot.kind === "section") {
        activeSection = hotspot.id as AdventureSnapshot["activeSection"]
      }
      queuedInteraction = null
      hoverTarget = null
      notify()
      return
    }

    if (currentInteraction.kind === "world-map") {
      worldMapOpen = true
      queuedInteraction = null
      hoverTarget = null
      notify()
      return
    }

    const exit = scene.exits.find((item) => item.id === currentInteraction.exitId)
    queuedInteraction = null
    if (!exit) {
      notify()
      return
    }

    currentSceneId = exit.targetSceneId
    transitionTimerMs = TRANSITION_DURATION_MS
    transitionState = {
      phase: "switching",
      toSceneId: exit.targetSceneId,
      remainingMs: transitionTimerMs,
    }
    hoverTarget = null
    notify()
  }

  function queuePath(target: RoomPoint, pending: PendingAction, sounds: SoundEvent[]) {
    const scene = getCurrentScene()
    const runtime = getCurrentRuntime()
    const start = roundActor(runtime.playerVisual)
    const goal = clampTileToInterior(target, scene.grid)
    const walkable = scene.grid.walkable[roomGridIndex(goal.x, goal.y, scene.grid.cols)]

    const runImmediateAction = () => {
      queuedInteraction = pending
      completePendingAction()
    }

    if (!walkable) {
      if (pending) {
        sounds.push("blocked")
      }
      return
    }

    if (goal.x === start.x && goal.y === start.y) {
      runImmediateAction()
      return
    }

    const path = aStar(start, goal, scene.grid.cols, scene.grid.rows, (x, y) => scene.grid.walkable[roomGridIndex(x, y, scene.grid.cols)])
    if (path.length <= 1) {
      if (pending) {
        sounds.push("blocked")
      }
      return
    }

    queuedInteraction = pending
    runtime.path = {
      nodes: path,
      progress: 0,
      speed: PLAYER_SPEED,
    }
    const nextNode = path[1]
    updatePlayerFacing(nextNode.x, nextNode.y)
    sounds.push("confirm")
  }

  function computeContextTarget(scene: SceneDefinition, runtime: SceneRuntime): HoverTarget | null {
    if (inputLocked()) return null
    if (isNear(runtime.dog.currentTile, runtime.player, 1.4)) {
      return dogTarget()
    }

    for (const exit of scene.exits) {
      if (isNear(exit.interactionTile, runtime.player)) {
        return hoverTargetFromExit(exit)
      }
    }

    for (const hotspot of scene.hotspots) {
      if (isNear(hotspot.interactionTile, runtime.player)) {
        return hoverTargetFromHotspot(hotspot)
      }
    }

    return null
  }

  function computeSnapshot(): AdventureSnapshot {
    const scene = getCurrentScene()
    const runtime = getCurrentRuntime()
    const contextTarget = computeContextTarget(scene, runtime)

    return {
      sceneId: currentSceneId,
      scene,
      player: {
        currentTile: cloneActor(runtime.player),
        visual: {
          x: runtime.playerVisual.x,
          y: runtime.playerVisual.y,
          facing: runtime.playerVisual.facing,
          moving: Boolean(runtime.path),
        },
        bubble: playerBubble?.text ?? null,
      },
      dog: {
        currentTile: cloneActor(runtime.dog.currentTile),
        visual: {
          x: runtime.dog.visual.x,
          y: runtime.dog.visual.y,
          facing: runtime.dog.visual.facing,
          moving: runtime.dog.visual.moving,
        },
        bubble: runtime.dog.bubble,
        animation: runtime.dog.animation,
      },
      hoverTarget: inputLocked() ? null : hoverTarget,
      contextTarget,
      queuedInteraction: buildQueuedInteraction(queuedInteraction, scene),
      activeSection,
      audioEnabled,
      transitionState,
      worldMapOpen,
      worldDestinations:
        scene.hotspots.find((item) => item.kind === "world-map")?.worldDestinations?.map((item) => ({ ...item })) ?? [],
      inputLocked: inputLocked(),
    }
  }

  function dispatch(command: AdventureCommand): AdventureDispatchResult {
    const sounds: SoundEvent[] = []
    const scene = getCurrentScene()
    const runtime = getCurrentRuntime()

    switch (command.type) {
      case "moveToTile": {
        if (inputLocked()) break
        queuePath(command.target, null, sounds)
        break
      }
      case "interactHotspot": {
        if (inputLocked()) break
        const hotspot = scene.hotspots.find((item) => item.id === command.hotspotId)
        if (!hotspot) break
        updatePlayerBubble(hotspot.hint)
        queuePath(
          hotspot.interactionTile,
          hotspot.kind === "world-map" ? { kind: "world-map", hotspotId: hotspot.id } : { kind: "hotspot", hotspotId: hotspot.id },
          sounds
        )
        break
      }
      case "interactExit": {
        if (inputLocked()) break
        const exit = scene.exits.find((item) => item.id === command.exitId)
        if (!exit) break
        updatePlayerBubble(exit.hint)
        queuePath(exit.interactionTile, { kind: "exit", exitId: exit.id }, sounds)
        break
      }
      case "interactDog": {
        if (inputLocked()) break
        triggerDogInteraction(runtime.dog)
        sounds.push("confirm")
        break
      }
      case "transitionToScene": {
        if (!worldMapOpen && inputLocked()) break
        worldMapOpen = false
        activeSection = null
        hoverTarget = null
        if (command.sceneId !== currentSceneId) {
          currentSceneId = command.sceneId
          transitionTimerMs = TRANSITION_DURATION_MS
          transitionState = { phase: "switching", toSceneId: command.sceneId, remainingMs: transitionTimerMs }
          sounds.push("open")
        }
        break
      }
      case "returnHome": {
        return dispatch({ type: "interactExit", exitId: "outpost-room" })
      }
      case "openSection": {
        if (activeSection && activeSection !== command.slug) {
          sounds.push("switch")
        } else if (!activeSection) {
          sounds.push("open")
        }
        activeSection = command.slug
        worldMapOpen = false
        break
      }
      case "closeSection": {
        if (activeSection) {
          sounds.push("close")
        }
        activeSection = null
        break
      }
      case "toggleAudio": {
        audioEnabled = !audioEnabled
        break
      }
      case "setHoverTarget": {
        if (inputLocked()) {
          hoverTarget = null
          break
        }
        const changed = command.target?.kind !== hoverTarget?.kind || command.target?.id !== hoverTarget?.id
        hoverTarget = command.target
        if (changed && command.target) {
          sounds.push("hover")
        }
        break
      }
      case "setWorldMapOpen": {
        if (command.open) {
          worldMapOpen = true
          activeSection = null
        } else {
          worldMapOpen = false
        }
        break
      }
      default: {
        break
      }
    }

    persistSession()
    notify()
    return { sounds }
  }

  function tickPlayer(runtime: SceneRuntime, dt: number) {
    const path = runtime.path
    if (!path) return

    path.progress += path.speed * dt
    const maxProgress = path.nodes.length - 1

    if (path.progress >= maxProgress) {
      const lastNode = path.nodes[path.nodes.length - 1]
      runtime.player = {
        x: lastNode.x,
        y: lastNode.y,
        facing: runtime.playerVisual.facing,
      }
      runtime.playerVisual = {
        x: lastNode.x,
        y: lastNode.y,
        facing: runtime.playerVisual.facing,
      }
      runtime.path = null
      completePendingAction()
      return
    }

    const segmentIndex = Math.min(Math.floor(path.progress), path.nodes.length - 2)
    const startNode = path.nodes[segmentIndex]
    const endNode = path.nodes[segmentIndex + 1]
    const t = path.progress - segmentIndex
    const dx = endNode.x - startNode.x
    const dy = endNode.y - startNode.y

    runtime.playerVisual = {
      x: startNode.x + dx * t,
      y: startNode.y + dy * t,
      facing: Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? "E" : "W") : dy >= 0 ? "S" : "N",
    }
    runtime.player = roundActor(runtime.playerVisual)
  }

  function tick(dt: number) {
    const runtime = getCurrentRuntime()
    const scene = getCurrentScene()
    let changed = false

    if (playerBubble) {
      const nextRemaining = Math.max(0, playerBubble.remaining - dt)
      if (nextRemaining !== playerBubble.remaining) {
        playerBubble.remaining = nextRemaining
        changed = true
      }
      if (playerBubble.remaining === 0) {
        playerBubble = null
        changed = true
      }
    }

    if (transitionTimerMs > 0) {
      transitionTimerMs = Math.max(0, transitionTimerMs - dt * 1000)
      transitionState =
        transitionTimerMs > 0
          ? {
              phase: "switching",
              toSceneId: currentSceneId,
              remainingMs: transitionTimerMs,
            }
          : { phase: "idle" }
      changed = true
    }

    const hadPath = Boolean(runtime.path)
    tickPlayer(runtime, dt)
    if (hadPath || runtime.path) {
      changed = true
    }

    const dogBefore = `${runtime.dog.visual.x},${runtime.dog.visual.y},${runtime.dog.bubble ?? ""},${runtime.dog.animation.phase},${runtime.dog.animation.wagging}`
    tickDogRuntime(runtime.dog, dt, {
      grid: scene.grid,
      hero: {
        x: runtime.playerVisual.x,
        y: runtime.playerVisual.y,
        facing: runtime.playerVisual.facing,
        moving: Boolean(runtime.path),
      },
      heroMoving: Boolean(runtime.path),
      pause: inputLocked() && !queuedInteraction,
      escortMode: queuedInteraction?.kind === "exit" || transitionState.phase === "switching",
      patrolPredicate: scene.id === "outpost" ? (point, grid) => point.x >= 2 && point.x <= grid.cols - 3 && point.y >= 5 && point.y <= grid.rows - 3 : undefined,
    })
    const dogAfter = `${runtime.dog.visual.x},${runtime.dog.visual.y},${runtime.dog.bubble ?? ""},${runtime.dog.animation.phase},${runtime.dog.animation.wagging}`
    if (dogBefore !== dogAfter) {
      changed = true
    }

    if (changed) {
      persistSession()
      notify()
    }
  }

  function subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function destroy() {
    listeners.clear()
  }

  persistSession()

  return {
    subscribe,
    getSnapshot: () => snapshot,
    dispatch,
    tick,
    destroy,
  }
}
