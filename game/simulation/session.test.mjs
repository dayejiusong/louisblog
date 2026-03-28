import test from "node:test"
import assert from "node:assert/strict"

import { ADVENTURE_SESSION_KEY, loadAdventureSession, parseAdventureSession, saveAdventureSession } from "./session.ts"

test("parseAdventureSession accepts a valid saved session", () => {
  const parsed = parseAdventureSession(
    JSON.stringify({
      currentSceneId: "outpost",
      sceneActors: {
        room: {
          player: { x: 10, y: 10, facing: "N" },
          dog: { x: 7, y: 8, facing: "E" },
        },
        outpost: {
          player: { x: 6, y: 11, facing: "E" },
          dog: { x: 8, y: 12, facing: "E" },
        },
      },
      audioEnabled: false,
    })
  )

  assert.equal(parsed?.currentSceneId, "outpost")
  assert.equal(parsed?.audioEnabled, false)
  assert.deepEqual(parsed?.sceneActors.room.player, { x: 10, y: 10, facing: "N" })
})

test("parseAdventureSession rejects invalid payloads", () => {
  assert.equal(parseAdventureSession(null), null)
  assert.equal(parseAdventureSession("{bad json"), null)
  assert.equal(
    parseAdventureSession(
      JSON.stringify({
        currentSceneId: "forest",
        sceneActors: {},
        audioEnabled: true,
      })
    ),
    null
  )
})

test("saveAdventureSession writes to the provided storage and loadAdventureSession reads it back", () => {
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
      currentSceneId: "room",
      sceneActors: {
        room: {
          player: { x: 10, y: 10, facing: "N" },
          dog: { x: 7, y: 8, facing: "E" },
        },
        outpost: {
          player: { x: 6, y: 11, facing: "E" },
          dog: { x: 8, y: 12, facing: "E" },
        },
      },
      audioEnabled: true,
    },
    storage
  )

  const loaded = loadAdventureSession(storage)
  assert.equal(loaded?.currentSceneId, "room")
  assert.equal(loaded?.sceneActors.outpost.player.x, 6)
})
