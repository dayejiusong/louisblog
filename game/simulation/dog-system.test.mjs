import test from "node:test"
import assert from "node:assert/strict"

import { buildRoomGrid } from "../../lib/room-grid.ts"
import { createDogRuntime, tickDogRuntime, triggerDogInteraction } from "./dog-system.ts"

const grid = buildRoomGrid([])

function advance(runtime, hero, seconds, heroMoving = false, step = 1 / 60) {
  const frames = Math.ceil(seconds / step)
  for (let index = 0; index < frames; index += 1) {
    tickDogRuntime(runtime, step, {
      grid,
      hero,
      heroMoving,
      pause: false,
      escortMode: false,
    })
  }
}

test("dog closes distance while the hero is moving", () => {
  const runtime = createDogRuntime({ x: 2, y: 2, facing: "E" })
  const hero = { x: 10, y: 10, facing: "E", moving: true }

  advance(runtime, hero, 3, true)
  assert.ok(Math.abs(runtime.currentTile.x - hero.x) <= 2)
})

test("dog also repositions near a stationary hero", () => {
  const runtime = createDogRuntime({ x: 2, y: 2, facing: "E" })
  const hero = { x: 8, y: 8, facing: "N", moving: false }

  advance(runtime, hero, 3, false)
  assert.ok(Math.abs(runtime.currentTile.x - hero.x) <= 2)
  assert.ok(Math.abs(runtime.currentTile.y - hero.y) <= 2)
})

test("dog interaction triggers wagging without breaking follow behavior", () => {
  const runtime = createDogRuntime({ x: 2, y: 2, facing: "E" })
  const hero = { x: 8, y: 8, facing: "E", moving: true }

  triggerDogInteraction(runtime)
  assert.equal(runtime.animation.wagging, true)

  advance(runtime, hero, 3, true)
  assert.ok(Math.abs(runtime.currentTile.x - hero.x) <= 2)
})
