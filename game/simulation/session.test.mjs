import test from "node:test"
import assert from "node:assert/strict"

import { ADVENTURE_SESSION_KEY, loadAdventureSession, parseAdventureSession, saveAdventureSession } from "./session.ts"

function createSceneActors() {
  return {
    room: {
      player: { x: 10, y: 10, facing: "N" },
      dog: { x: 9, y: 11, facing: "N" },
    },
    outpost: {
      player: { x: 6, y: 11, facing: "E" },
      dog: { x: 5, y: 12, facing: "E" },
    },
    ridge: {
      player: { x: 5, y: 12, facing: "E" },
      dog: { x: 4, y: 12, facing: "E" },
    },
    shore: {
      player: { x: 5, y: 12, facing: "E" },
      dog: { x: 4, y: 12, facing: "E" },
    },
  }
}

function createProgress(overrides = {}) {
  return {
    unlockedScenes: ["room", "outpost", "ridge"],
    visitedScenes: ["room", "outpost"],
    collectedMemories: ["ridge-cache"],
    completedObjectives: ["leave-room", "find-ridge-cache"],
    activeQuestId: "camp-expedition",
    activeQuestStageId: "report-to-camp",
    completedQuestStageIds: ["meet-camp-keeper", "reach-ridge-scout", "collect-ridge-cache"],
    metNpcIds: ["camp-keeper", "ridge-scout"],
    taskPanelSeen: true,
    timeOfDay: "dusk",
    weather: "drizzle",
    seenTimesOfDay: ["day", "dusk"],
    seenWeather: ["clear", "drizzle"],
    seenDynamicEventIds: ["campfire-circle"],
    unlockedAchievementIds: ["night-watch"],
    unlockedScrapbookEntryIds: ["first-departure", "campfire-note"],
    ...overrides,
  }
}

test("parseAdventureSession accepts a valid saved session", () => {
  const parsed = parseAdventureSession(
    JSON.stringify({
      currentSceneId: "outpost",
      sceneActors: createSceneActors(),
      audioEnabled: false,
      progress: createProgress(),
    })
  )

  assert.equal(parsed?.currentSceneId, "outpost")
  assert.equal(parsed?.audioEnabled, false)
  assert.equal(parsed?.progress.activeQuestStageId, "report-to-camp")
  assert.deepEqual(parsed?.progress.metNpcIds, ["camp-keeper", "ridge-scout"])
  assert.equal(parsed?.progress.weather, "drizzle")
  assert.deepEqual(parsed?.progress.unlockedScrapbookEntryIds, ["first-departure", "campfire-note"])
})

test("parseAdventureSession rejects invalid payloads", () => {
  assert.equal(parseAdventureSession(null), null)
  assert.equal(parseAdventureSession("{bad json"), null)
  assert.equal(
    parseAdventureSession(
      JSON.stringify({
        currentSceneId: "room",
        sceneActors: createSceneActors(),
        audioEnabled: true,
        progress: createProgress({ activeQuestStageId: "bad-stage" }),
      })
    ),
    null
  )
  assert.equal(
    parseAdventureSession(
      JSON.stringify({
        currentSceneId: "room",
        sceneActors: createSceneActors(),
        audioEnabled: true,
      })
    ),
    null
  )
})

test("saveAdventureSession writes and loadAdventureSession reads quest progress", () => {
  const storage = {
    value: null,
    getItem(key) {
      return key === ADVENTURE_SESSION_KEY ? this.value : null
    },
    setItem(key, value) {
      if (key === ADVENTURE_SESSION_KEY) {
        this.value = value
      }
    },
  }

  saveAdventureSession(
    {
      currentSceneId: "shore",
      sceneActors: createSceneActors(),
      audioEnabled: true,
      progress: createProgress({
        unlockedScenes: ["room", "outpost", "ridge", "shore"],
        visitedScenes: ["room", "outpost", "ridge", "shore"],
        collectedMemories: ["ridge-cache", "shore-memory"],
        completedObjectives: ["leave-room", "find-ridge-cache", "visit-shore", "recover-shore-memory"],
        activeQuestStageId: null,
        completedQuestStageIds: [
          "meet-camp-keeper",
          "reach-ridge-scout",
          "collect-ridge-cache",
          "report-to-camp",
          "reach-shore-listener",
          "collect-shore-memory",
          "final-report",
        ],
        metNpcIds: ["camp-keeper", "ridge-scout", "shore-listener"],
      }),
    },
    storage
  )

  const loaded = loadAdventureSession(storage)
  assert.equal(loaded?.currentSceneId, "shore")
  assert.equal(loaded?.sceneActors.outpost.player.x, 6)
  assert.deepEqual(loaded?.progress.metNpcIds, ["camp-keeper", "ridge-scout", "shore-listener"])
  assert.equal(loaded?.progress.activeQuestStageId, null)
  assert.deepEqual(loaded?.progress.seenWeather, ["clear", "drizzle"])
})
