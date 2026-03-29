import test from "node:test"
import assert from "node:assert/strict"

import { createAdventureStore } from "./adventure-store.ts"

function advance(store, seconds, step = 1 / 60) {
  const frames = Math.ceil(seconds / step)
  for (let index = 0; index < frames; index += 1) {
    store.tick(step)
  }
}

test("camp keeper starts the quest, opens the task panel, and unlocks the ridge", () => {
  const store = createAdventureStore()

  store.dispatch({ type: "transitionToScene", sceneId: "outpost" })
  advance(store, 1)
  store.dispatch({ type: "interactNpc", npcId: "camp-keeper" })
  advance(store, 6)

  const snapshot = store.getSnapshot()
  assert.equal(snapshot.sceneId, "outpost")
  assert.equal(snapshot.taskPanelOpen, true)
  assert.equal(snapshot.quest.currentStageId, "reach-ridge-scout")
  assert.ok(snapshot.progress.unlockedScenes.includes("ridge"))
  assert.ok(snapshot.progress.metNpcIds.includes("camp-keeper"))
})

test("ridge flow requires scout conversation before cache collection", () => {
  const store = createAdventureStore()

  store.dispatch({ type: "transitionToScene", sceneId: "outpost" })
  advance(store, 1)
  store.dispatch({ type: "interactNpc", npcId: "camp-keeper" })
  advance(store, 4)
  store.dispatch({ type: "closeTaskPanel" })
  store.dispatch({ type: "transitionToScene", sceneId: "ridge" })
  advance(store, 1)
  store.dispatch({ type: "interactHotspot", hotspotId: "ridge-cache" })
  const blockedSnapshot = store.getSnapshot()
  assert.equal(blockedSnapshot.quest.currentStageId, "reach-ridge-scout")

  store.dispatch({ type: "interactNpc", npcId: "ridge-scout" })
  advance(store, 6)
  store.dispatch({ type: "closeTaskPanel" })
  store.dispatch({ type: "interactHotspot", hotspotId: "ridge-cache" })
  advance(store, 7)

  const snapshot = store.getSnapshot()
  assert.equal(snapshot.quest.currentStageId, "report-to-camp")
  assert.ok(snapshot.progress.collectedMemories.includes("ridge-cache"))
  assert.equal(snapshot.worldDestinations.find((item) => item.targetSceneId === "shore")?.available, false)
})

test("reporting to camp unlocks the shore and final report completes the quest", () => {
  const store = createAdventureStore()

  store.dispatch({ type: "transitionToScene", sceneId: "outpost" })
  advance(store, 1)
  store.dispatch({ type: "interactNpc", npcId: "camp-keeper" })
  advance(store, 6)
  store.dispatch({ type: "closeTaskPanel" })
  store.dispatch({ type: "transitionToScene", sceneId: "ridge" })
  advance(store, 1)
  store.dispatch({ type: "interactNpc", npcId: "ridge-scout" })
  advance(store, 6)
  store.dispatch({ type: "closeTaskPanel" })
  store.dispatch({ type: "interactHotspot", hotspotId: "ridge-cache" })
  advance(store, 7)
  store.dispatch({ type: "transitionToScene", sceneId: "outpost" })
  advance(store, 1)
  store.dispatch({ type: "interactNpc", npcId: "camp-keeper" })
  advance(store, 6)
  store.dispatch({ type: "closeTaskPanel" })
  store.dispatch({ type: "transitionToScene", sceneId: "shore" })
  advance(store, 1)
  store.dispatch({ type: "interactNpc", npcId: "shore-listener" })
  advance(store, 6)
  store.dispatch({ type: "closeTaskPanel" })
  store.dispatch({ type: "interactHotspot", hotspotId: "shore-memory" })
  advance(store, 7)
  store.dispatch({ type: "transitionToScene", sceneId: "outpost" })
  advance(store, 1)
  store.dispatch({ type: "interactNpc", npcId: "camp-keeper" })
  advance(store, 6)

  const snapshot = store.getSnapshot()
  assert.equal(snapshot.quest.status, "completed")
  assert.equal(snapshot.quest.currentStageId, null)
  assert.ok(snapshot.progress.unlockedScenes.includes("shore"))
  assert.ok(snapshot.progress.completedQuestStageIds.includes("final-report"))
  assert.ok(snapshot.progress.collectedMemories.includes("shore-memory"))
})

test("task panel locks world input until closed", () => {
  const store = createAdventureStore()

  store.dispatch({ type: "transitionToScene", sceneId: "outpost" })
  advance(store, 1)
  store.dispatch({ type: "interactNpc", npcId: "camp-keeper" })
  advance(store, 4)

  const before = store.getSnapshot().player.currentTile
  store.dispatch({ type: "moveToTile", target: { x: before.x + 2, y: before.y } })
  advance(store, 1)

  const locked = store.getSnapshot().player.currentTile
  assert.deepEqual(locked, before)

  store.dispatch({ type: "closeTaskPanel" })
  store.dispatch({ type: "moveToTile", target: { x: before.x + 2, y: before.y } })
  advance(store, 2)

  const after = store.getSnapshot().player.currentTile
  assert.notDeepEqual(after, before)
})

test("environment cycle unlocks atmosphere achievements and scrapbook pages", () => {
  const store = createAdventureStore()

  store.dispatch({ type: "transitionToScene", sceneId: "outpost" })
  advance(store, 61)

  const snapshot = store.getSnapshot()
  assert.equal(snapshot.environment.weather, "fog")
  assert.ok(snapshot.progress.seenTimesOfDay.includes("night"))
  assert.ok(snapshot.progress.unlockedAchievementIds.includes("night-watch"))
  assert.ok(snapshot.progress.unlockedAchievementIds.includes("weather-reader"))
  assert.ok(snapshot.progress.unlockedScrapbookEntryIds.includes("campfire-note"))
})

test("quest completion unlocks v3 route achievements and epilogue scrapbook", () => {
  const store = createAdventureStore()

  store.dispatch({ type: "transitionToScene", sceneId: "outpost" })
  advance(store, 1)
  store.dispatch({ type: "interactNpc", npcId: "camp-keeper" })
  advance(store, 6)
  store.dispatch({ type: "closeTaskPanel" })
  store.dispatch({ type: "transitionToScene", sceneId: "ridge" })
  advance(store, 1)
  store.dispatch({ type: "interactNpc", npcId: "ridge-scout" })
  advance(store, 6)
  store.dispatch({ type: "closeTaskPanel" })
  store.dispatch({ type: "interactHotspot", hotspotId: "ridge-cache" })
  advance(store, 7)
  store.dispatch({ type: "transitionToScene", sceneId: "outpost" })
  advance(store, 1)
  store.dispatch({ type: "interactNpc", npcId: "camp-keeper" })
  advance(store, 6)
  store.dispatch({ type: "closeTaskPanel" })
  store.dispatch({ type: "transitionToScene", sceneId: "shore" })
  advance(store, 1)
  store.dispatch({ type: "interactNpc", npcId: "shore-listener" })
  advance(store, 6)
  store.dispatch({ type: "closeTaskPanel" })
  store.dispatch({ type: "interactHotspot", hotspotId: "shore-memory" })
  advance(store, 7)
  store.dispatch({ type: "transitionToScene", sceneId: "outpost" })
  advance(store, 1)
  store.dispatch({ type: "interactNpc", npcId: "camp-keeper" })
  advance(store, 6)

  const snapshot = store.getSnapshot()
  assert.ok(snapshot.progress.unlockedAchievementIds.includes("all-friends"))
  assert.ok(snapshot.progress.unlockedAchievementIds.includes("memory-bearer"))
  assert.ok(snapshot.progress.unlockedAchievementIds.includes("camp-complete"))
  assert.ok(snapshot.progress.unlockedScrapbookEntryIds.includes("expedition-epilogue"))
})
