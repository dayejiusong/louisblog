import type { SceneBridge } from "./adapters/sceneBridge.ts"
import { createBootScene } from "./boot/BootScene.ts"
import { createWorldScene } from "./scenes/WorldScene.ts"

export async function createPhaserGame(container: HTMLDivElement, bridge: SceneBridge) {
  const Phaser = await import("phaser")
  const BootScene = createBootScene(Phaser)
  const WorldScene = createWorldScene(Phaser, bridge)

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    transparent: true,
    backgroundColor: "#000000",
    render: {
      antialias: false,
      pixelArt: true,
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: container.clientWidth || 960,
      height: container.clientHeight || 720,
    },
    scene: [BootScene, WorldScene],
  })

  return {
    game,
    resize(width: number, height: number) {
      game.scale.resize(width, height)
    },
  }
}
