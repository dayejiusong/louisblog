import { aStar } from "../../lib/pathfinding.ts"
import { clampTileToInterior, roomGridIndex, type RoomPoint } from "../../lib/room-grid.ts"
import { getSceneDefinition, sceneDefinitions } from "../content/scenes.ts"
import { buildDialogue, destinationCopy, hintForExit, hintForHotspot, labelForExit, labelForHotspot, normalizedSceneUi, npcCopy, questStageOrder, questStages } from "../content/v3-copy.ts"
import { nextTimeOfDay, nextWeather } from "../content/v3-meta.ts"
import type {
  ActorTileState,
  AdventureCommand,
  AdventureDispatchResult,
  AdventureSnapshot,
  HoverTarget,
  NpcId,
  ObjectiveId,
  ObjectiveSummary,
  QueuedInteraction,
  QuestSummary,
  SceneDefinition,
  SceneExit,
  SceneHotspot,
  SceneId,
  SoundEvent,
  TransitionState,
  WorldProgress,
} from "../types.ts"
import { createDogRuntime, placeDogNearHero, tickDogRuntime, triggerDogInteraction, type DogRuntime } from "./dog-system.ts"
import { loadAdventureSession, saveAdventureSession, type AdventureSessionState } from "./session.ts"
import { computeAchievements, computeDynamicEvent, computeEnvironment, computeScrapbook, syncV3Progress } from "./v3-progress.ts"

type Listener = () => void
type PathState = { nodes: RoomPoint[]; progress: number; speed: number }
type PendingAction =
  | { kind: "hotspot"; hotspotId: string }
  | { kind: "npc"; hotspotId: string; npcId: NpcId }
  | { kind: "exit"; exitId: string }
  | { kind: "world-map"; hotspotId: string }
  | { kind: "collectible"; hotspotId: string; collectibleId: string }
  | null

type SceneRuntime = {
  player: ActorTileState
  playerVisual: { x: number; y: number; facing: ActorTileState["facing"] }
  path: PathState | null
  dog: DogRuntime
}

const PLAYER_SPEED = 3.7
const TRANSITION_DURATION_MS = 720
const PLAYER_BUBBLE_DURATION = 1.8
const TIME_OF_DAY_INTERVAL = 18
const WEATHER_INTERVAL = 30

const stageNpc: Partial<Record<keyof typeof questStages, NpcId>> = {
  "meet-camp-keeper": "camp-keeper",
  "reach-ridge-scout": "ridge-scout",
  "report-to-camp": "camp-keeper",
  "reach-shore-listener": "shore-listener",
  "final-report": "camp-keeper",
}

function cloneActor(actor: ActorTileState): ActorTileState {
  return { x: actor.x, y: actor.y, facing: actor.facing }
}

function roundActor(actor: { x: number; y: number; facing: ActorTileState["facing"] }) {
  return { x: Math.round(actor.x), y: Math.round(actor.y), facing: actor.facing }
}

function addUnique<T>(items: T[], value: T) {
  return items.includes(value) ? items : [...items, value]
}

function makeSceneRuntime(player: ActorTileState, dog: ActorTileState): SceneRuntime {
  return { player: cloneActor(player), playerVisual: { ...player }, path: null, dog: createDogRuntime(cloneActor(dog)) }
}

function createDefaultProgress(): WorldProgress {
  return {
    unlockedScenes: ["room", "outpost"],
    visitedScenes: ["room"],
    collectedMemories: [],
    completedObjectives: [],
    activeQuestId: "camp-expedition",
    activeQuestStageId: "meet-camp-keeper",
    completedQuestStageIds: [],
    metNpcIds: [],
    taskPanelSeen: false,
    timeOfDay: "day",
    weather: "clear",
    seenTimesOfDay: ["day"],
    seenWeather: ["clear"],
    seenDynamicEventIds: [],
    unlockedAchievementIds: [],
    unlockedScrapbookEntryIds: [],
  }
}

function createDefaultSession(): AdventureSessionState {
  return {
    currentSceneId: "room",
    sceneActors: {
      room: { player: cloneActor(sceneDefinitions.room.spawn.player), dog: cloneActor(sceneDefinitions.room.spawn.dog) },
      outpost: { player: cloneActor(sceneDefinitions.outpost.spawn.player), dog: cloneActor(sceneDefinitions.outpost.spawn.dog) },
      ridge: { player: cloneActor(sceneDefinitions.ridge.spawn.player), dog: cloneActor(sceneDefinitions.ridge.spawn.dog) },
      shore: { player: cloneActor(sceneDefinitions.shore.spawn.player), dog: cloneActor(sceneDefinitions.shore.spawn.dog) },
    },
    audioEnabled: true,
    progress: createDefaultProgress(),
  }
}

function hoverTargetFromHotspot(hotspot: SceneHotspot): HoverTarget {
  if (hotspot.kind === "npc" && hotspot.npcId) {
    return { kind: "npc", id: hotspot.id, label: labelForHotspot(hotspot), hint: hintForHotspot(hotspot), accent: hotspot.accent, npcId: hotspot.npcId }
  }
  return { kind: "hotspot", id: hotspot.id, label: labelForHotspot(hotspot), hint: hintForHotspot(hotspot), accent: hotspot.accent }
}

function hoverTargetFromExit(exit: SceneExit): HoverTarget {
  return { kind: "exit", id: exit.id, label: labelForExit(exit), hint: hintForExit(exit), accent: exit.accent }
}

function dogTarget(): HoverTarget {
  return { kind: "dog", id: "dog", label: "Dog", hint: "Pat the dog. It will wag, bark, and keep following you.", accent: "#f4c76d" }
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
  const restored = loadAdventureSession() ?? createDefaultSession()
  const runtimes: Record<SceneId, SceneRuntime> = {
    room: makeSceneRuntime(restored.sceneActors.room.player, restored.sceneActors.room.dog),
    outpost: makeSceneRuntime(restored.sceneActors.outpost.player, restored.sceneActors.outpost.dog),
    ridge: makeSceneRuntime(restored.sceneActors.ridge.player, restored.sceneActors.ridge.dog),
    shore: makeSceneRuntime(restored.sceneActors.shore.player, restored.sceneActors.shore.dog),
  }

  let currentSceneId: SceneId = restored.currentSceneId
  let hoverTarget: HoverTarget | null = null
  let activeSection: AdventureSnapshot["activeSection"] = null
  let taskPanelOpen = false
  let worldMapOpen = false
  let audioEnabled = restored.audioEnabled
  let progress: WorldProgress = {
    ...restored.progress,
    unlockedScenes: [...restored.progress.unlockedScenes],
    visitedScenes: [...restored.progress.visitedScenes],
    collectedMemories: [...restored.progress.collectedMemories],
    completedObjectives: [...restored.progress.completedObjectives],
    completedQuestStageIds: [...restored.progress.completedQuestStageIds],
    metNpcIds: [...restored.progress.metNpcIds],
    seenTimesOfDay: [...restored.progress.seenTimesOfDay],
    seenWeather: [...restored.progress.seenWeather],
    seenDynamicEventIds: [...restored.progress.seenDynamicEventIds],
    unlockedAchievementIds: [...restored.progress.unlockedAchievementIds],
    unlockedScrapbookEntryIds: [...restored.progress.unlockedScrapbookEntryIds],
  }
  let recentDialogue: AdventureSnapshot["recentDialogue"] = null
  let queuedInteraction: PendingAction = null
  let playerBubble: { text: string; remaining: number } | null = null
  let transitionTimerMs = 0
  let transitionState: TransitionState = { phase: "idle" }
  let timeOfDayTimer = 0
  let weatherTimer = 0
  let snapshot!: AdventureSnapshot

  const getScene = () => getSceneDefinition(currentSceneId)
  const getRuntime = () => runtimes[currentSceneId]

  function reconcileProgress(sceneId = currentSceneId) {
    progress = syncV3Progress(progress, sceneId)
  }

  function persist() {
    reconcileProgress()
    saveAdventureSession({
      currentSceneId,
      sceneActors: {
        room: { player: cloneActor(runtimes.room.player), dog: cloneActor(runtimes.room.dog.currentTile) },
        outpost: { player: cloneActor(runtimes.outpost.player), dog: cloneActor(runtimes.outpost.dog.currentTile) },
        ridge: { player: cloneActor(runtimes.ridge.player), dog: cloneActor(runtimes.ridge.dog.currentTile) },
        shore: { player: cloneActor(runtimes.shore.player), dog: cloneActor(runtimes.shore.dog.currentTile) },
      },
      audioEnabled,
      progress,
    })
  }

  function notify() {
    reconcileProgress()
    snapshot = computeSnapshot()
    listeners.forEach((listener) => listener())
  }

  function inputLocked() {
    return Boolean(activeSection) || taskPanelOpen || worldMapOpen || transitionState.phase !== "idle"
  }

  function updatePlayerBubble(text: string | null, duration = PLAYER_BUBBLE_DURATION) {
    playerBubble = text ? { text, remaining: duration } : null
  }

  function completeObjective(id: ObjectiveId) {
    progress = { ...progress, completedObjectives: addUnique(progress.completedObjectives, id) }
  }

  function unlockScene(sceneId: SceneId) {
    progress = { ...progress, unlockedScenes: addUnique(progress.unlockedScenes, sceneId) }
  }

  function visitScene(sceneId: SceneId) {
    progress = { ...progress, visitedScenes: addUnique(progress.visitedScenes, sceneId) }
    if (sceneId === "outpost") completeObjective("leave-room")
    if (sceneId === "shore") completeObjective("visit-shore")
    reconcileProgress(sceneId)
  }

  function addMetNpc(npcId: NpcId) {
    progress = { ...progress, metNpcIds: addUnique(progress.metNpcIds, npcId) }
  }

  function completeStage(stageId: keyof typeof questStages, nextStageId: keyof typeof questStages | null) {
    progress = {
      ...progress,
      activeQuestId: nextStageId ? "camp-expedition" : null,
      activeQuestStageId: nextStageId,
      completedQuestStageIds: addUnique(progress.completedQuestStageIds, stageId),
    }
  }

  function isCollected(id: string | undefined) {
    return id ? progress.collectedMemories.includes(id) : false
  }

  function visibleHotspots(scene: SceneDefinition) {
    return scene.hotspots.filter((hotspot) => hotspot.kind !== "collectible" || !isCollected(hotspot.collectibleId))
  }

  function normalizedScene(scene: SceneDefinition): SceneDefinition {
    return {
      ...scene,
      hotspots: visibleHotspots(scene).map((hotspot) => ({
        ...hotspot,
        label: labelForHotspot(hotspot),
        hint: hintForHotspot(hotspot),
        collectibleLabel: hotspot.collectibleLabel ? labelForHotspot(hotspot) : hotspot.collectibleLabel,
      })),
      exits: scene.exits.map((exit) => ({
        ...exit,
        label: labelForExit(exit),
        hint: hintForExit(exit),
      })),
      ui: normalizedSceneUi[scene.id],
    }
  }

  function setDogNearHero(sceneId: SceneId) {
    const scene = sceneDefinitions[sceneId]
    const runtime = runtimes[sceneId]
    placeDogNearHero(runtime.dog, runtime.player, scene.grid)
  }

  function activeStage() {
    return progress.activeQuestStageId ? questStages[progress.activeQuestStageId] : null
  }

  function activeNpcId() {
    return progress.activeQuestStageId ? stageNpc[progress.activeQuestStageId] ?? null : null
  }

  function openTaskPanel() {
    taskPanelOpen = true
    worldMapOpen = false
    activeSection = null
    progress = { ...progress, taskPanelSeen: true }
  }

  function collectMemory(id: string) {
    if (progress.collectedMemories.includes(id)) return
    progress = { ...progress, collectedMemories: addUnique(progress.collectedMemories, id) }
    if (id === "ridge-cache") {
      completeObjective("find-ridge-cache")
      completeStage("collect-ridge-cache", "report-to-camp")
    }
    if (id === "shore-memory") {
      completeObjective("recover-shore-memory")
      completeStage("collect-shore-memory", "final-report")
    }
  }

  function collectBlockedReason(hotspot: SceneHotspot) {
    if (hotspot.collectibleId === "ridge-cache" && progress.activeQuestStageId !== "collect-ridge-cache") return "Talk to the ridge scout before taking the cache."
    if (hotspot.collectibleId === "shore-memory" && progress.activeQuestStageId !== "collect-shore-memory") return "Talk to the shore listener before collecting the final memory."
    return null
  }

  function computeQuest(): QuestSummary {
    const current = activeStage()
    return {
      id: "camp-expedition",
      label: "Camp Expedition",
      status: progress.completedQuestStageIds.includes("final-report") ? "completed" : "active",
      currentStageId: progress.activeQuestStageId,
      currentStageLabel: current?.label ?? "Expedition complete",
      currentStageDescription: current?.description ?? "The current expedition loop is closed. The world can keep expanding from here.",
      nextLocation: current?.nextLocation ?? "Awaiting the next route",
      progressLabel: `${progress.completedQuestStageIds.length}/${questStageOrder.length} stages cleared`,
      completedStageIds: [...progress.completedQuestStageIds],
      stages: questStageOrder.map((id) => ({
        ...questStages[id],
        status: progress.completedQuestStageIds.includes(id) ? "completed" : progress.activeQuestStageId === id ? "active" : "locked",
      })),
    }
  }

  function computeObjectives(quest: QuestSummary): ObjectiveSummary[] {
    const met = progress.metNpcIds.length
    const memories = progress.collectedMemories.length
    const weatherCount = progress.seenWeather.length
    const timeCount = progress.seenTimesOfDay.length
    return [
      { id: "quest-stage", label: quest.currentStageLabel ?? "Quest complete", description: quest.currentStageDescription ?? "The quest chain is complete.", status: quest.status === "completed" ? "completed" : "active" },
      { id: "npc-network", label: `NPC meetings ${met}/3`, description: met === 3 ? "All three route contacts have been met." : "Keep following the quest chain to meet the full outpost network.", status: met === 3 ? "completed" : met > 0 ? "active" : "locked" },
      { id: "memory-chain", label: `Memories carried ${memories}/2`, description: memories === 2 ? "Both expedition collectibles are secured." : "The ridge cache and shore memory are the key collectibles in the route.", status: memories === 2 ? "completed" : memories > 0 ? "active" : "locked" },
      { id: "atmosphere-log", label: `Atmosphere log ${timeCount}/3 times, ${weatherCount}/3 weather`, description: "V3 tracks world mood for events, achievements, and scrapbook entries.", status: timeCount === 3 && weatherCount === 3 ? "completed" : timeCount > 1 || weatherCount > 1 ? "active" : "locked" },
    ]
  }

  function computeWorldDestinations() {
    const stageId = progress.activeQuestStageId
    return (Object.keys(destinationCopy) as SceneId[]).map((sceneId) => {
      const base = destinationCopy[sceneId]
      let hint = base.collectibleHint
      let reason = base.lockedReason
      if (sceneId === "outpost" && stageId === "meet-camp-keeper") hint = "Go to the outpost and take the expedition briefing."
      if (sceneId === "ridge" && stageId === "reach-ridge-scout") hint = "The ridge scout is waiting at the trail."
      if (sceneId === "ridge" && stageId === "collect-ridge-cache") hint = "Pick up the ridge cache, then return to camp."
      if (sceneId === "outpost" && stageId === "report-to-camp") hint = "Return to the outpost and report the ridge cache."
      if (sceneId === "shore" && stageId === "reach-shore-listener") hint = "The shore route is open. Meet the listener first."
      if (sceneId === "shore" && stageId === "collect-shore-memory") hint = "Collect the shore memory, then carry it back to camp."
      if (sceneId === "outpost" && stageId === "final-report") hint = "Return to the outpost for the final report."
      if (sceneId === "ridge" && !progress.unlockedScenes.includes("ridge")) reason = "Meet the camp keeper before the ridge can open."
      if (sceneId === "shore" && !progress.unlockedScenes.includes("shore")) reason = "Report the ridge cache before the shore route unlocks."
      return { ...base, available: progress.unlockedScenes.includes(sceneId), collectibleHint: hint, lockedReason: reason }
    })
  }

  function computeContextTarget(scene: SceneDefinition, runtime: SceneRuntime): HoverTarget | null {
    if (inputLocked()) return null
    for (const exit of scene.exits) {
      if (Math.hypot(exit.interactionTile.x - runtime.player.x, exit.interactionTile.y - runtime.player.y) <= 1.2) return hoverTargetFromExit(exit)
    }
    for (const hotspot of visibleHotspots(scene)) {
      if (Math.hypot(hotspot.interactionTile.x - runtime.player.x, hotspot.interactionTile.y - runtime.player.y) <= 1.2) return hoverTargetFromHotspot(hotspot)
    }
    if (Math.hypot(runtime.dog.currentTile.x - runtime.player.x, runtime.dog.currentTile.y - runtime.player.y) <= 1.4) return dogTarget()
    return null
  }

  function buildQueuedInteraction(pending: PendingAction, scene: SceneDefinition): QueuedInteraction {
    if (!pending) return null
    if (pending.kind === "exit") {
      const exit = scene.exits.find((item) => item.id === pending.exitId)
      return exit ? { kind: "exit", id: exit.id, label: labelForExit(exit) } : null
    }
    const hotspot = scene.hotspots.find((item) => item.id === pending.hotspotId)
    if (!hotspot) return null
    if (pending.kind === "world-map") return { kind: "world-map", id: hotspot.id, label: labelForHotspot(hotspot) }
    if (pending.kind === "npc") return { kind: "npc", id: hotspot.id, label: labelForHotspot(hotspot), npcId: pending.npcId }
    return { kind: "hotspot", id: hotspot.id, label: labelForHotspot(hotspot) }
  }

  function completePendingAction() {
    const scene = getScene()
    if (!queuedInteraction) return
    const pending = queuedInteraction
    queuedInteraction = null
    hoverTarget = null

    if (pending.kind === "hotspot") {
      const hotspot = scene.hotspots.find((item) => item.id === pending.hotspotId)
      if (hotspot?.kind === "section") activeSection = hotspot.id as AdventureSnapshot["activeSection"]
      notify()
      return
    }

    if (pending.kind === "npc") {
      advanceNpcQuest(pending.npcId)
      recentDialogue = buildDialogue(pending.npcId, progress.activeQuestStageId)
      openTaskPanel()
      notify()
      return
    }

    if (pending.kind === "world-map") {
      worldMapOpen = true
      taskPanelOpen = false
      notify()
      return
    }

    if (pending.kind === "collectible") {
      const hotspot = scene.hotspots.find((item) => item.id === pending.hotspotId)
      collectMemory(pending.collectibleId)
      updatePlayerBubble(`${hotspot ? labelForHotspot(hotspot) : "Memory"} added to pack`)
      notify()
      return
    }

    const exit = scene.exits.find((item) => item.id === pending.exitId)
    if (!exit) {
      notify()
      return
    }

    currentSceneId = exit.targetSceneId
    visitScene(currentSceneId)
    setDogNearHero(currentSceneId)
    transitionTimerMs = TRANSITION_DURATION_MS
    transitionState = { phase: "switching", toSceneId: exit.targetSceneId, remainingMs: transitionTimerMs }
    notify()
  }

  function queuePath(target: RoomPoint, pending: PendingAction, sounds: SoundEvent[]) {
    const scene = getScene()
    const runtime = getRuntime()
    const start = roundActor(runtime.playerVisual)
    const goal = clampTileToInterior(target, scene.grid)
    if (!scene.grid.walkable[roomGridIndex(goal.x, goal.y, scene.grid.cols)]) {
      if (pending) sounds.push("blocked")
      return
    }
    if (goal.x === start.x && goal.y === start.y) {
      queuedInteraction = pending
      completePendingAction()
      return
    }
    const path = aStar(start, goal, scene.grid.cols, scene.grid.rows, (x, y) => scene.grid.walkable[roomGridIndex(x, y, scene.grid.cols)])
    if (path.length <= 1) {
      if (pending) sounds.push("blocked")
      return
    }
    queuedInteraction = pending
    runtime.path = { nodes: path, progress: 0, speed: PLAYER_SPEED }
    const next = path[1]
    const dx = next.x - runtime.player.x
    const dy = next.y - runtime.player.y
    runtime.player.facing = Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? "E" : "W") : dy >= 0 ? "S" : "N"
    runtime.playerVisual.facing = runtime.player.facing
    sounds.push("confirm")
  }

  function computeSnapshot(): AdventureSnapshot {
    const scene = getScene()
    const runtime = getRuntime()
    const quest = computeQuest()
    const activeNpc = activeNpcId()
    const npcs = (Object.keys(npcCopy) as NpcId[]).map((id) => ({
      id,
      label: npcCopy[id].label,
      role: npcCopy[id].role,
      sceneId: npcCopy[id].sceneId,
      accent: npcCopy[id].accent,
      met: progress.metNpcIds.includes(id),
      active: id === activeNpc,
      profile: npcCopy[id].profile,
    }))
    return {
      sceneId: currentSceneId,
      scene: normalizedScene(scene),
      player: { currentTile: cloneActor(runtime.player), visual: { x: runtime.playerVisual.x, y: runtime.playerVisual.y, facing: runtime.playerVisual.facing, moving: Boolean(runtime.path) }, bubble: playerBubble?.text ?? null },
      dog: { currentTile: cloneActor(runtime.dog.currentTile), visual: { x: runtime.dog.visual.x, y: runtime.dog.visual.y, facing: runtime.dog.visual.facing, moving: runtime.dog.visual.moving }, bubble: runtime.dog.bubble, animation: runtime.dog.animation },
      hoverTarget: inputLocked() ? null : hoverTarget,
      contextTarget: computeContextTarget(scene, runtime),
      queuedInteraction: buildQueuedInteraction(queuedInteraction, scene),
      activeSection,
      activeNpc: activeNpc ? npcs.find((npc) => npc.id === activeNpc) ?? null : null,
      audioEnabled,
      transitionState,
      worldMapOpen,
      worldDestinations: computeWorldDestinations(),
      progress,
      objectives: computeObjectives(quest),
      quest,
      npcs,
      taskPanelOpen,
      recentDialogue,
      environment: computeEnvironment(currentSceneId, progress),
      dynamicEvent: computeDynamicEvent(currentSceneId, progress),
      achievements: computeAchievements(progress),
      scrapbook: computeScrapbook(progress),
      inputLocked: inputLocked(),
    }
  }

  function advanceNpcQuest(npcId: NpcId) {
    addMetNpc(npcId)
    if (npcId === "camp-keeper" && progress.activeQuestStageId === "meet-camp-keeper") {
      completeStage("meet-camp-keeper", "reach-ridge-scout")
      unlockScene("ridge")
      return
    }
    if (npcId === "ridge-scout" && progress.activeQuestStageId === "reach-ridge-scout") {
      completeStage("reach-ridge-scout", "collect-ridge-cache")
      return
    }
    if (npcId === "camp-keeper" && progress.activeQuestStageId === "report-to-camp") {
      completeStage("report-to-camp", "reach-shore-listener")
      unlockScene("shore")
      return
    }
    if (npcId === "shore-listener" && progress.activeQuestStageId === "reach-shore-listener") {
      completeStage("reach-shore-listener", "collect-shore-memory")
      return
    }
    if (npcId === "camp-keeper" && progress.activeQuestStageId === "final-report") {
      completeStage("final-report", null)
    }
  }

  function dispatch(command: AdventureCommand): AdventureDispatchResult {
    const sounds: SoundEvent[] = []
    const scene = getScene()
    const runtime = getRuntime()

    switch (command.type) {
      case "moveToTile":
        if (!inputLocked()) queuePath(command.target, null, sounds)
        break
      case "interactHotspot": {
        if (inputLocked()) break
        const hotspot = scene.hotspots.find((item) => item.id === command.hotspotId)
        if (!hotspot) break
        if (hotspot.kind === "npc" && hotspot.npcId) return dispatch({ type: "interactNpc", npcId: hotspot.npcId })
        if (hotspot.kind === "collectible" && isCollected(hotspot.collectibleId)) break
        const blocked = hotspot.kind === "collectible" ? collectBlockedReason(hotspot) : null
        if (blocked) {
          updatePlayerBubble(blocked)
          sounds.push("blocked")
          break
        }
        updatePlayerBubble(hintForHotspot(hotspot))
        const pending: PendingAction =
          hotspot.kind === "world-map"
            ? { kind: "world-map", hotspotId: hotspot.id }
            : hotspot.kind === "collectible"
              ? { kind: "collectible", hotspotId: hotspot.id, collectibleId: hotspot.collectibleId ?? hotspot.id }
              : { kind: "hotspot", hotspotId: hotspot.id }
        queuePath(hotspot.interactionTile, pending, sounds)
        break
      }
      case "interactNpc": {
        if (inputLocked()) break
        const hotspot = scene.hotspots.find((item) => item.kind === "npc" && item.npcId === command.npcId)
        if (!hotspot) break
        updatePlayerBubble(hintForHotspot(hotspot))
        queuePath(hotspot.interactionTile, { kind: "npc", hotspotId: hotspot.id, npcId: command.npcId }, sounds)
        break
      }
      case "interactExit": {
        if (inputLocked()) break
        const exit = scene.exits.find((item) => item.id === command.exitId)
        if (!exit) break
        updatePlayerBubble(hintForExit(exit))
        queuePath(exit.interactionTile, { kind: "exit", exitId: exit.id }, sounds)
        break
      }
      case "interactDog":
        if (!inputLocked()) {
          triggerDogInteraction(runtime.dog)
          sounds.push("confirm")
        }
        break
      case "transitionToScene":
        if (!worldMapOpen && inputLocked()) break
        if (!progress.unlockedScenes.includes(command.sceneId)) {
          sounds.push("blocked")
          break
        }
        worldMapOpen = false
        taskPanelOpen = false
        activeSection = null
        hoverTarget = null
        if (command.sceneId !== currentSceneId) {
          currentSceneId = command.sceneId
          visitScene(currentSceneId)
          setDogNearHero(currentSceneId)
          transitionTimerMs = TRANSITION_DURATION_MS
          transitionState = { phase: "switching", toSceneId: command.sceneId, remainingMs: transitionTimerMs }
          sounds.push("open")
        }
        break
      case "returnHome":
        return dispatch({ type: "transitionToScene", sceneId: "room" })
      case "openSection":
        if (activeSection && activeSection !== command.slug) sounds.push("switch")
        if (!activeSection) sounds.push("open")
        activeSection = command.slug
        taskPanelOpen = false
        worldMapOpen = false
        break
      case "closeSection":
        if (activeSection) sounds.push("close")
        activeSection = null
        break
      case "openTaskPanel":
        if (!taskPanelOpen) sounds.push("open")
        openTaskPanel()
        break
      case "closeTaskPanel":
        if (taskPanelOpen) sounds.push("close")
        taskPanelOpen = false
        break
      case "acknowledgeDialogue":
        recentDialogue = null
        break
      case "toggleAudio":
        audioEnabled = !audioEnabled
        break
      case "setHoverTarget": {
        if (inputLocked()) {
          hoverTarget = null
          break
        }
        const changed = command.target?.kind !== hoverTarget?.kind || command.target?.id !== hoverTarget?.id
        hoverTarget = command.target
        if (changed && command.target) sounds.push("hover")
        break
      }
      case "setWorldMapOpen":
        worldMapOpen = command.open
        if (command.open) {
          taskPanelOpen = false
          activeSection = null
        }
        break
      default:
        break
    }

    persist()
    notify()
    return { sounds }
  }

  function tickPlayer(runtime: SceneRuntime, dt: number) {
    const path = runtime.path
    if (!path) return
    path.progress += path.speed * dt
    if (path.progress >= path.nodes.length - 1) {
      const last = path.nodes[path.nodes.length - 1]
      runtime.player = { x: last.x, y: last.y, facing: runtime.playerVisual.facing }
      runtime.playerVisual = { x: last.x, y: last.y, facing: runtime.playerVisual.facing }
      runtime.path = null
      completePendingAction()
      return
    }
    const index = Math.min(Math.floor(path.progress), path.nodes.length - 2)
    const start = path.nodes[index]
    const end = path.nodes[index + 1]
    const t = path.progress - index
    const dx = end.x - start.x
    const dy = end.y - start.y
    runtime.playerVisual = { x: start.x + dx * t, y: start.y + dy * t, facing: Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? "E" : "W") : dy >= 0 ? "S" : "N" }
    runtime.player = roundActor(runtime.playerVisual)
  }

  function tickEnvironment(dt: number) {
    let changed = false
    timeOfDayTimer += dt
    while (timeOfDayTimer >= TIME_OF_DAY_INTERVAL) {
      timeOfDayTimer -= TIME_OF_DAY_INTERVAL
      progress = { ...progress, timeOfDay: nextTimeOfDay(progress.timeOfDay) }
      changed = true
    }
    weatherTimer += dt
    while (weatherTimer >= WEATHER_INTERVAL) {
      weatherTimer -= WEATHER_INTERVAL
      progress = { ...progress, weather: nextWeather(progress.weather) }
      changed = true
    }
    if (changed) reconcileProgress()
    return changed
  }

  function tick(dt: number) {
    const runtime = getRuntime()
    const scene = getScene()
    let changed = false

    if (playerBubble) {
      const next = Math.max(0, playerBubble.remaining - dt)
      if (next !== playerBubble.remaining) {
        playerBubble.remaining = next
        changed = true
      }
      if (playerBubble.remaining === 0) {
        playerBubble = null
        changed = true
      }
    }

    if (transitionTimerMs > 0) {
      transitionTimerMs = Math.max(0, transitionTimerMs - dt * 1000)
      transitionState = transitionTimerMs > 0 ? { phase: "switching", toSceneId: currentSceneId, remainingMs: transitionTimerMs } : { phase: "idle" }
      changed = true
    }

    if (tickEnvironment(dt)) changed = true

    const hadPath = Boolean(runtime.path)
    tickPlayer(runtime, dt)
    if (hadPath || runtime.path) changed = true

    const dogBefore = `${runtime.dog.visual.x},${runtime.dog.visual.y},${runtime.dog.bubble ?? ""},${runtime.dog.animation.phase},${runtime.dog.animation.wagging}`
    tickDogRuntime(runtime.dog, dt, {
      grid: scene.grid,
      hero: { x: runtime.playerVisual.x, y: runtime.playerVisual.y, facing: runtime.playerVisual.facing, moving: Boolean(runtime.path) },
      heroMoving: Boolean(runtime.path),
      pause: inputLocked() && !queuedInteraction,
      escortMode: queuedInteraction?.kind === "exit" || transitionState.phase === "switching",
    })
    const dogAfter = `${runtime.dog.visual.x},${runtime.dog.visual.y},${runtime.dog.bubble ?? ""},${runtime.dog.animation.phase},${runtime.dog.animation.wagging}`
    if (dogBefore !== dogAfter) changed = true

    if (changed) {
      persist()
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

  visitScene(currentSceneId)
  setDogNearHero(currentSceneId)
  reconcileProgress()
  snapshot = computeSnapshot()
  persist()

  return { subscribe, getSnapshot: () => snapshot, dispatch, tick, destroy }
}
