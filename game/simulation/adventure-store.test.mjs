import test from "node:test"
import assert from "node:assert/strict"

import { createAdventureStore } from "./adventure-store.ts"

function advance(store, seconds, step = 1 / 60) {
  const frames = Math.ceil(seconds / step)
  for (let index = 0; index < frames; index += 1) {
    store.tick(step)
  }
}

test("room hotspot interaction walks to the object and opens the matching section", () => {
  const store = createAdventureStore()

  store.dispatch({ type: "interactHotspot", hotspotId: "games" })
  advance(store, 4)

  const snapshot = store.getSnapshot()
  assert.equal(snapshot.activeSection, "games")
  assert.equal(snapshot.sceneId, "room")
  assert.equal(snapshot.inputLocked, true)
})

test("room exit moves the player to the outpost and preserves the scene switch state", () => {
  const store = createAdventureStore()

  store.dispatch({ type: "interactExit", exitId: "room-outpost" })
  advance(store, 6)

  const snapshot = store.getSnapshot()
  assert.equal(snapshot.sceneId, "outpost")
  assert.equal(snapshot.transitionState.phase, "idle")
})

test("outpost signpost opens the world map and exposes destination entries", () => {
  const store = createAdventureStore()

  store.dispatch({ type: "transitionToScene", sceneId: "outpost" })
  advance(store, 1)
  store.dispatch({ type: "interactHotspot", hotspotId: "world-map" })
  advance(store, 3)

  const snapshot = store.getSnapshot()
  assert.equal(snapshot.sceneId, "outpost")
  assert.equal(snapshot.worldMapOpen, true)
  assert.ok(snapshot.worldDestinations.length >= 3)
})

test("dog runtime follows the player when the player walks away in the outpost", () => {
  const store = createAdventureStore()

  store.dispatch({ type: "transitionToScene", sceneId: "outpost" })
  advance(store, 1)

  const before = store.getSnapshot().dog.currentTile
  store.dispatch({ type: "moveToTile", target: { x: 14, y: 12 } })
  advance(store, 3)

  const after = store.getSnapshot().dog.currentTile
  assert.notDeepEqual(after, before)
})
