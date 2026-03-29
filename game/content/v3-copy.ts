import type {
  DialogueSummary,
  NpcId,
  NpcSummary,
  QuestStageDefinition,
  QuestStageId,
  SceneDefinition,
  SceneExit,
  SceneHotspot,
  SceneId,
  WorldDestination,
} from "../types.ts"

export const questStages: Record<QuestStageId, QuestStageDefinition> = {
  "meet-camp-keeper": {
    id: "meet-camp-keeper",
    label: "Meet the camp keeper",
    description: "Head to the outpost and officially pick up the expedition route.",
    nextLocation: "Outpost",
  },
  "reach-ridge-scout": {
    id: "reach-ridge-scout",
    label: "Reach the ridge scout",
    description: "The ridge route is open now. Check in with the scout before taking the cache.",
    nextLocation: "Ridge",
  },
  "collect-ridge-cache": {
    id: "collect-ridge-cache",
    label: "Recover the ridge cache",
    description: "After speaking with the scout, pick up the route cache from the ridge trail.",
    nextLocation: "Ridge",
  },
  "report-to-camp": {
    id: "report-to-camp",
    label: "Report back to camp",
    description: "Bring the ridge cache back to the outpost before the shore route can open.",
    nextLocation: "Outpost",
  },
  "reach-shore-listener": {
    id: "reach-shore-listener",
    label: "Reach the shore listener",
    description: "The shore is finally open. Meet the listener before collecting the last memory.",
    nextLocation: "Shore",
  },
  "collect-shore-memory": {
    id: "collect-shore-memory",
    label: "Collect the shore memory",
    description: "Pick up the final memory by the water once the listener has briefed you.",
    nextLocation: "Shore",
  },
  "final-report": {
    id: "final-report",
    label: "Deliver the final report",
    description: "Return to the outpost and close the expedition with the camp keeper.",
    nextLocation: "Outpost",
  },
}

export const questStageOrder: QuestStageId[] = [
  "meet-camp-keeper",
  "reach-ridge-scout",
  "collect-ridge-cache",
  "report-to-camp",
  "reach-shore-listener",
  "collect-shore-memory",
  "final-report",
]

export const npcCopy: Record<NpcId, Pick<NpcSummary, "label" | "role" | "profile" | "sceneId" | "accent">> = {
  "camp-keeper": {
    label: "Camp Keeper",
    role: "Route coordinator",
    sceneId: "outpost",
    accent: "#f4c76d",
    profile: "Keeps the expedition loop stitched together and turns scattered notes into a route worth following.",
  },
  "ridge-scout": {
    label: "Ridge Scout",
    role: "Trail contact",
    sceneId: "ridge",
    accent: "#ffe18e",
    profile: "Waits by the wind gap and makes sure you do not skip the middle leg of the trip.",
  },
  "shore-listener": {
    label: "Shore Listener",
    role: "Final witness",
    sceneId: "shore",
    accent: "#a8ecff",
    profile: "Hands over the last memory and points you back toward the outpost for the close-out.",
  },
}

export const normalizedSceneUi: Record<SceneId, SceneDefinition["ui"]> = {
  room: {
    title: "Room Gateway",
    description: "The room still holds the archive, but now it also serves as the quiet launch point for the wider world.",
    primaryPanelTitle: "Room Notes",
    primaryPanelBody: [
      "The room is the safe return point and the archive hub for the blog sections.",
      "Leaving through the crack now feeds into a longer expedition loop instead of a one-off transition.",
      "Long-form writing still stays in the DOM overlay, not inside the Phaser world.",
    ],
    secondaryPanelTitle: "Quick Access",
    secondaryPanelBody: ["Use the room hotspots for the archive. Use the crack to continue the expedition route."],
  },
  outpost: {
    title: "Outpost Camp",
    description: "The outpost is the task hub, report point, and route board for the whole expedition.",
    primaryPanelTitle: "Camp Flow",
    primaryPanelBody: [
      "This is where the main route begins, branches, and closes.",
      "NPC conversations and world routes now work together instead of living as separate overlays.",
      "As V3 runs, the outpost also changes mood with dusk, weather, and event states.",
    ],
    secondaryPanelTitle: "Camp Intel",
    secondaryPanelBody: ["Check in with the camp keeper here whenever the quest points you back toward the center of the route."],
  },
  ridge: {
    title: "Ridge Trail",
    description: "The ridge is the middle leg of the journey, where route cache and atmosphere start to matter.",
    primaryPanelTitle: "Ridge Notes",
    primaryPanelBody: [
      "The scout gates the route cache so the task chain cannot be skipped.",
      "Fog and wind are now part of the V3 mood system, not just scenery.",
      "The dog keeps formation near the player through this whole stretch.",
    ],
    secondaryPanelTitle: "Trail Advice",
    secondaryPanelBody: ["Meet the scout first, grab the cache second, and only then head back to camp."],
  },
  shore: {
    title: "Shore Camp",
    description: "The shore closes the route with the final memory, late-night light, and the last report back home.",
    primaryPanelTitle: "Shore Notes",
    primaryPanelBody: [
      "The listener is the handoff point for the final collectible in the chain.",
      "Night at the shore now has its own event state and scrapbook unlock.",
      "The route is only complete once you carry the memory back to the outpost.",
    ],
    secondaryPanelTitle: "Tide Advice",
    secondaryPanelBody: ["Speak with the listener, collect the memory, and then return to camp for the last report."],
  },
}

export const destinationCopy: Record<SceneId, Omit<WorldDestination, "available">> = {
  room: {
    id: "room-home",
    label: "Room",
    description: "Archive hub and safe return point.",
    targetSceneId: "room",
    collectibleHint: "Always available as a fallback.",
  },
  outpost: {
    id: "outpost-hub",
    label: "Outpost",
    description: "Task hub, route board, and reporting center.",
    targetSceneId: "outpost",
    collectibleHint: "The camp keeper updates the route here.",
  },
  ridge: {
    id: "ridge-trail",
    label: "Ridge",
    description: "Mid-route trail where the scout and route cache wait.",
    targetSceneId: "ridge",
    lockedReason: "Meet the camp keeper first to unlock the ridge route.",
    collectibleHint: "The ridge cache advances the expedition.",
  },
  shore: {
    id: "shore-camp",
    label: "Shore",
    description: "Final route leg with the listener and the last memory.",
    targetSceneId: "shore",
    lockedReason: "Report the ridge cache to camp before the shore opens.",
    collectibleHint: "The shore memory closes the main loop.",
  },
}

const sectionLabels: Record<string, string> = {
  games: "Games Desk",
  rides: "Ride Log",
  travel: "Travel Window",
  books: "Book Shelf",
  music: "Music Corner",
}

const sectionHints: Record<string, string> = {
  games: "Open the games archive from the room desk.",
  rides: "Open the ride log and route notes.",
  travel: "Open the travel journal by the window.",
  books: "Open the bookshelf archive.",
  music: "Open the record shelf and playlists.",
}

export function labelForHotspot(hotspot: SceneHotspot): string {
  if (hotspot.kind === "npc" && hotspot.npcId) return npcCopy[hotspot.npcId].label
  if (hotspot.kind === "world-map") return "Route Board"
  if (hotspot.kind === "collectible" && hotspot.collectibleId === "ridge-cache") return "Ridge Cache"
  if (hotspot.kind === "collectible" && hotspot.collectibleId === "shore-memory") return "Shore Memory"
  return sectionLabels[hotspot.id] ?? hotspot.label
}

export function hintForHotspot(hotspot: SceneHotspot): string {
  if (hotspot.kind === "npc" && hotspot.npcId === "camp-keeper") return "Talk to the camp keeper to start or report progress on the expedition."
  if (hotspot.kind === "npc" && hotspot.npcId === "ridge-scout") return "Check in with the ridge scout before taking the route cache."
  if (hotspot.kind === "npc" && hotspot.npcId === "shore-listener") return "Speak with the shore listener before collecting the final memory."
  if (hotspot.kind === "world-map") return "Open the world route board and review available paths."
  if (hotspot.kind === "collectible" && hotspot.collectibleId === "ridge-cache") return "Recover the ridge cache and bring it back to camp."
  if (hotspot.kind === "collectible" && hotspot.collectibleId === "shore-memory") return "Pick up the shore memory and close the route back at camp."
  return sectionHints[hotspot.id] ?? hotspot.hint
}

export function labelForExit(exit: SceneExit): string {
  if (exit.targetSceneId === "room") return "Return Crack"
  if (exit.targetSceneId === "outpost" && exit.id === "room-outpost") return "Leave the Room"
  if (exit.targetSceneId === "outpost") return "Back to Outpost"
  return exit.label
}

export function hintForExit(exit: SceneExit): string {
  if (exit.id === "room-outpost") return "Step through the crack and head into the outpost with the dog."
  if (exit.targetSceneId === "room") return "Head back to the room without losing expedition progress."
  if (exit.targetSceneId === "outpost") return "Return to the outpost to continue or report the route."
  return exit.hint
}

export function buildDialogue(npcId: NpcId, stageId: QuestStageId | null): DialogueSummary {
  let title = "Route update"
  let lines: string[] = ["Keep the route moving. The task journal will tell you what comes next."]

  if (npcId === "camp-keeper" && stageId === "meet-camp-keeper") {
    title = "Expedition accepted"
    lines = [
      "The ridge route is ready. Find the scout first and do not skip the handoff.",
      "Bring the ridge cache back here before worrying about the shore.",
    ]
  } else if (npcId === "camp-keeper" && stageId === "report-to-camp") {
    title = "Shore route unlocked"
    lines = [
      "The ridge cache is logged. The shore path is open now.",
      "Find the shore listener and bring the last memory back for the final report.",
    ]
  } else if (npcId === "camp-keeper" && stageId === "final-report") {
    title = "Expedition closed"
    lines = [
      "You brought the route home. Ridge and shore are both recorded now.",
      "The outpost will keep this trip as part of the scrapbook from here on.",
    ]
  } else if (npcId === "ridge-scout" && stageId === "reach-ridge-scout") {
    title = "Scout contact made"
    lines = [
      "The cache is deeper on the ridge trail. Pick it up before you head back.",
      "Do not skip the camp report. The shore only opens after that return.",
    ]
  } else if (npcId === "shore-listener" && stageId === "reach-shore-listener") {
    title = "Shore brief received"
    lines = [
      "The final memory is waiting close to the waterline.",
      "Once you collect it, bring it back to the outpost to close the loop.",
    ]
  } else if (npcId === "shore-listener") {
    title = "One last return"
    lines = [
      "The tide has already handed over what it needed to.",
      "Only the final report at camp remains now.",
    ]
  }

  return {
    npcId,
    npcLabel: npcCopy[npcId].label,
    sceneId: npcCopy[npcId].sceneId,
    title,
    lines,
  }
}
