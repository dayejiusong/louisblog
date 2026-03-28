export function directionFromKey(key: string) {
  switch (key) {
    case "W":
    case "ArrowUp":
      return { x: 0, y: -1 }
    case "S":
    case "ArrowDown":
      return { x: 0, y: 1 }
    case "A":
    case "ArrowLeft":
      return { x: -1, y: 0 }
    case "D":
    case "ArrowRight":
      return { x: 1, y: 0 }
    default:
      return null
  }
}
