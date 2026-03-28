import type { DogAnimationState } from "@/hooks/use-dog-npc"
import type { RoomAvatarState } from "@/lib/room-session"

export function drawDogSprite(
  ctx: CanvasRenderingContext2D,
  point: { px: number; py: number },
  tileH: number,
  time: number,
  dog: RoomAvatarState,
  animation: DogAnimationState
) {
  const furMain = "#cf8741"
  const furDark = "#9c5a2b"
  const furShade = "#b86d33"
  const furLight = "#f3e7d2"
  const pawLight = "#efe0c8"
  const eyeColor = "#171312"

  const pace = animation.speed === "run" ? 15 : animation.speed === "walk" ? 9 : 3
  const cycle = time * pace
  const strideFront = animation.moving ? Math.sin(cycle) : 0
  const strideRear = animation.moving ? Math.sin(cycle + Math.PI) : 0
  const bodyCompression = animation.moving
    ? Math.abs(Math.sin(cycle)) * (animation.speed === "run" ? 1.7 : 1)
    : animation.sniffing
      ? 0.95 + Math.abs(Math.sin(time * 5)) * 0.34
      : 0.24 + Math.abs(Math.sin(time * 2.2)) * 0.26
  const headDip = animation.sniffing ? 2.4 : animation.alert ? 0.7 : 0
  const tailSwing = animation.wagging
    ? Math.sin(time * 18) * 3.4
    : animation.moving
      ? Math.sin(cycle * 0.9) * 1.1
      : Math.sin(time * 2.5) * 0.55
  const bodyDrift = animation.moving ? Math.sin(cycle) * (animation.speed === "run" ? 0.9 : 0.4) : 0
  const earNudge = animation.alert ? Math.sin(time * 7) * 0.4 : 0
  const rearFarLift = strideRear > 0 ? strideRear * 2.2 : 0
  const rearNearLift = strideRear < 0 ? -strideRear * 1.4 : 0
  const frontFarLift = strideFront < 0 ? -strideFront * 1.5 : 0
  const frontNearLift = strideFront > 0 ? strideFront * 2.4 : 0
  const facingLeft = dog.facing === "W"
  const bodyBaseY = point.py + 10 - bodyCompression
  const shadowY = point.py + tileH * 0.75

  ctx.fillStyle = "rgba(0, 0, 0, 0.18)"
  ctx.beginPath()
  ctx.ellipse(point.px, shadowY, animation.moving ? 17.5 : 16, animation.moving ? 5.8 : 6.5, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.translate(point.px + bodyDrift, bodyBaseY)
  if (facingLeft) {
    ctx.scale(-1, 1)
  }

  rect(ctx, -19 + tailSwing, -18, 4, 9, furDark)
  rect(ctx, -17 + tailSwing, -23, 3, 7, furLight)

  rect(ctx, -15, -23, 8, 8, furDark)
  rect(ctx, -11, -25, 16, 10, furMain)
  rect(ctx, 2, -24, 10, 9, furMain)
  rect(ctx, -17, -19, 31, 11, furMain)
  rect(ctx, -15, -12, 27, 7, furShade)
  rect(ctx, -8, -10, 12, 5, furLight)
  rect(ctx, -12, -22, 11, 3, furLight)
  rect(ctx, 4, -22, 7, 3, furLight)
  rect(ctx, -15, -15, 5, 5, furDark)
  rect(ctx, 8, -15, 5, 5, furDark)

  rect(ctx, 8, -29 - headDip, 11, 10, furMain)
  rect(ctx, 16, -25 - headDip, 6, 6, furLight)
  rect(ctx, 13, -31 - headDip, 5, 3, furLight)
  rect(ctx, 10, -34 - headDip + earNudge, 3, 8, furDark)
  rect(ctx, 15, -33 - headDip, 3, 7, furDark)
  rect(ctx, 8, -20 - headDip, 3, 3, furDark)

  rect(ctx, -12, -8, 6, 4, furShade)
  rect(ctx, -4, -8, 6, 4, furShade)
  rect(ctx, 5, -8, 6, 4, furShade)
  rect(ctx, 11, -8, 5, 4, furShade)

  rect(ctx, -11, -4 - rearFarLift, 3, 11 + rearFarLift, furLight)
  rect(ctx, -4, -4 - rearNearLift, 3, 11 + rearNearLift, furLight)
  rect(ctx, 6, -4 - frontFarLift, 3, 11 + frontFarLift, furLight)
  rect(ctx, 12, -4 - frontNearLift, 3, 11 + frontNearLift, furLight)
  rect(ctx, -12, 7, 5, 2, pawLight)
  rect(ctx, -5, 7, 5, 2, pawLight)
  rect(ctx, 5, 7, 5, 2, pawLight)
  rect(ctx, 11, 7, 5, 2, pawLight)

  ctx.fillStyle = eyeColor
  ctx.fillRect(15, -23 - headDip, 2, 2)
  ctx.fillRect(19, -21 - headDip, 2, 2)
  ctx.fillRect(18, -18 - headDip, 2, 2)
  ctx.fillRect(17, -17 - headDip, 2, 1)
  ctx.restore()
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  ctx.strokeStyle = "#1d1511"
  ctx.lineWidth = 1
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h))
}
