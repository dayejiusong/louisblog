import type { AdventureStore } from "../../simulation/adventure-store.ts"
import type { AdventureCommand } from "../../types.ts"

export type SceneBridge = {
  getSnapshot: AdventureStore["getSnapshot"]
  subscribe: AdventureStore["subscribe"]
  tick: AdventureStore["tick"]
  send: (command: AdventureCommand) => void
}

export function createSceneBridge(store: AdventureStore, send: (command: AdventureCommand) => void): SceneBridge {
  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    tick: store.tick,
    send,
  }
}
