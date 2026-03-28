import { generatedTextureKeys } from "../../assets/manifest.ts"

type PhaserModule = typeof import("phaser")

export function createBootScene(Phaser: PhaserModule) {
  return class BootScene extends Phaser.Scene {
    constructor() {
      super("boot")
    }

    create() {
      createAvatarTexture(this, Phaser)
      createDogTexture(this, Phaser)
      createShadowTexture(this, Phaser)
      this.scene.start("world")
    }
  }
}

function createAvatarTexture(scene: import("phaser").Scene, Phaser: PhaserModule) {
  if (scene.textures.exists(generatedTextureKeys.avatar)) return

  const graphics = scene.add.graphics()
  graphics.fillStyle(0x4470b5, 1)
  graphics.fillRect(14, 20, 20, 24)
  graphics.fillStyle(0xf1cfaa, 1)
  graphics.fillRect(12, 26, 4, 12)
  graphics.fillRect(32, 26, 4, 12)
  graphics.fillStyle(0x2f2523, 1)
  graphics.fillRect(16, 44, 6, 16)
  graphics.fillRect(26, 44, 6, 16)
  graphics.fillStyle(0xf0c58e, 1)
  graphics.fillCircle(24, 15, 10)
  graphics.fillStyle(0x4a3425, 1)
  graphics.fillRect(13, 2, 22, 10)
  graphics.fillRect(16, 10, 16, 4)
  graphics.generateTexture(generatedTextureKeys.avatar, 48, 64)
  graphics.destroy()
}

function createDogTexture(scene: import("phaser").Scene, Phaser: PhaserModule) {
  if (scene.textures.exists(generatedTextureKeys.dog)) return

  const graphics = scene.add.graphics()
  graphics.fillStyle(0xcf8741, 1)
  graphics.fillRoundedRect(10, 18, 30, 18, 6)
  graphics.fillRoundedRect(28, 10, 14, 12, 4)
  graphics.fillStyle(0x9c5a2b, 1)
  graphics.fillRect(6, 15, 8, 5)
  graphics.fillRect(30, 6, 4, 8)
  graphics.fillRect(35, 7, 4, 7)
  graphics.fillStyle(0xf3e7d2, 1)
  graphics.fillRect(29, 16, 10, 6)
  graphics.fillRect(14, 30, 18, 4)
  graphics.fillRect(11, 36, 4, 12)
  graphics.fillRect(20, 36, 4, 12)
  graphics.fillRect(29, 36, 4, 12)
  graphics.fillRect(36, 36, 4, 12)
  graphics.fillStyle(0x171312, 1)
  graphics.fillRect(35, 17, 2, 2)
  graphics.fillRect(38, 20, 2, 2)
  graphics.generateTexture(generatedTextureKeys.dog, 52, 52)
  graphics.destroy()
}

function createShadowTexture(scene: import("phaser").Scene, Phaser: PhaserModule) {
  if (scene.textures.exists(generatedTextureKeys.shadow)) return

  const graphics = scene.add.graphics()
  graphics.fillStyle(0x000000, 0.22)
  graphics.fillEllipse(18, 10, 36, 14)
  graphics.generateTexture(generatedTextureKeys.shadow, 36, 20)
  graphics.destroy()
}
