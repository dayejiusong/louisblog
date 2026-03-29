"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"

import ArchiveModal from "@/components/archive-modal"
import TaskPanel from "@/components/task-panel"
import { createSceneBridge } from "@/game/phaser/adapters/sceneBridge"
import { createPhaserGame } from "@/game/phaser/createPhaserGame"
import { createAdventureStore } from "@/game/simulation/adventure-store"
import type { AdventureCommand, SceneId, WorldDestination } from "@/game/types"
import { usePixelAudio } from "@/hooks/use-pixel-audio"
import { blogSections, sectionList, type SectionSlug } from "@/lib/blog-content"

const OPEN_MS = 180
const CLOSE_MS = 220

const sceneLabels: Record<SceneId, string> = {
  room: "Room",
  outpost: "Outpost",
  ridge: "Ridge",
  shore: "Shore",
}

function useSectionOverlay(activeSection: SectionSlug | null) {
  const [displayedSection, setDisplayedSection] = useState<SectionSlug | null>(activeSection)
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("open")

  useEffect(() => {
    let timer = 0

    if (activeSection) {
      setDisplayedSection(activeSection)
      setPhase("opening")
      timer = window.setTimeout(() => setPhase("open"), OPEN_MS)
      return () => window.clearTimeout(timer)
    }

    if (displayedSection) {
      setPhase("closing")
      timer = window.setTimeout(() => {
        setDisplayedSection(null)
        setPhase("open")
      }, CLOSE_MS)
    }

    return () => window.clearTimeout(timer)
  }, [activeSection, displayedSection])

  return { displayedSection, phase }
}

function getDestinationStatus(destination: WorldDestination, currentSceneId: SceneId) {
  if (!destination.available) return "Locked Route"
  if (destination.targetSceneId === currentSceneId) return "Current Zone"
  return "Open Route"
}

function PhaserViewport({ bridge }: { bridge: ReturnType<typeof createSceneBridge> }) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let controller: Awaited<ReturnType<typeof createPhaserGame>> | null = null

    void createPhaserGame(container, bridge).then((created) => {
      if (disposed) {
        created.game.destroy(true)
        return
      }
      controller = created
    })

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect || !controller) return
      controller.resize(Math.max(320, Math.floor(rect.width)), Math.max(520, Math.floor(rect.height)))
    })
    resizeObserver.observe(container)

    return () => {
      disposed = true
      resizeObserver.disconnect()
      controller?.game.destroy(true)
    }
  }, [bridge])

  return <div ref={containerRef} className="relative h-[min(78vw,820px)] min-h-[520px] w-full overflow-hidden rounded-[10px] border-[4px] border-[color:var(--game-ink)] bg-black" />
}

export default function AdventureShell() {
  const [store] = useState(() => createAdventureStore())
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const audio = usePixelAudio()
  const audioRef = useRef(audio)

  useEffect(() => {
    audioRef.current = audio
  }, [audio])

  useEffect(() => () => store.destroy(), [store])

  useEffect(() => {
    if (snapshot.audioEnabled !== audio.enabled) {
      audio.toggleEnabled()
    }
  }, [audio, snapshot.audioEnabled])

  useEffect(() => {
    audio.setAmbience(snapshot.sceneId, snapshot.environment.timeOfDay, snapshot.environment.weather)
  }, [audio, snapshot.environment.timeOfDay, snapshot.environment.weather, snapshot.sceneId])

  const sendCommand = useCallback(
    (command: AdventureCommand) => {
      const currentAudio = audioRef.current
      if (command.type !== "setHoverTarget") {
        void currentAudio.prime().catch(() => undefined)
      }
      const result = store.dispatch(command)
      result.sounds.forEach((sound) => currentAudio.playSound(sound))
    },
    [store]
  )

  const bridge = useMemo(() => createSceneBridge(store, sendCommand), [sendCommand, store])
  const { displayedSection, phase } = useSectionOverlay(snapshot.activeSection)
  const section = displayedSection ? blogSections[displayedSection] : null
  const contextLabel = snapshot.contextTarget?.label ?? snapshot.hoverTarget?.label ?? snapshot.activeNpc?.label ?? snapshot.scene.ui.title
  const contextHint = snapshot.contextTarget?.hint ?? snapshot.hoverTarget?.hint ?? snapshot.activeNpc?.profile ?? snapshot.scene.ui.description
  const unlockedRoutes = snapshot.worldDestinations.filter((destination) => destination.available).length
  const unlockedAchievements = snapshot.achievements.filter((item) => item.unlocked).length
  const unlockedScrapbook = snapshot.scrapbook.filter((item) => item.unlocked).length

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="pixel-frame overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b-[3px] border-[rgba(29,21,17,0.18)] px-4 py-4">
            <div className="max-w-3xl">
              <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[rgba(255,247,226,0.8)]">{snapshot.scene.ui.title}</div>
              <div className="mt-2 text-xl font-black text-[color:var(--game-text)] sm:text-2xl">{contextLabel}</div>
              <p className="mt-2 text-sm leading-7 text-[color:var(--game-subtle)] sm:text-base">{contextHint}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="pixel-chip bg-[rgba(255,246,220,0.85)] text-xs">
                {snapshot.transitionState.phase === "switching"
                  ? `Switching to ${sceneLabels[snapshot.scene.id]}`
                  : `${sceneLabels[snapshot.scene.id]} tile ${snapshot.player.currentTile.x},${snapshot.player.currentTile.y}`}
              </div>
              <div className="pixel-chip text-xs">{snapshot.environment.timeLabel}</div>
              <div className="pixel-chip text-xs">{snapshot.environment.weatherLabel}</div>
              <div className="pixel-chip text-xs">Stage: {snapshot.quest.currentStageLabel}</div>
              {snapshot.dynamicEvent && <div className="pixel-chip text-xs">Event: {snapshot.dynamicEvent.label}</div>}
              {snapshot.player.bubble && <div className="pixel-chip text-xs">{snapshot.player.bubble}</div>}
              {snapshot.dog.bubble && <div className="pixel-chip text-xs">{snapshot.dog.bubble}</div>}
              <button type="button" className="pixel-button px-3 py-2 text-xs sm:text-sm" onClick={() => sendCommand({ type: "openTaskPanel" })}>
                Task journal
              </button>
              <button type="button" className="pixel-button px-3 py-2 text-xs sm:text-sm" onClick={() => sendCommand({ type: "toggleAudio" })}>
                {snapshot.audioEnabled ? "Ambient on" : "Ambient off"}
              </button>
            </div>
          </div>

          <div className="p-3 sm:p-4">
            <PhaserViewport bridge={bridge} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="grid gap-4">
            <div className="pixel-panel">
              <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">{snapshot.scene.ui.primaryPanelTitle}</div>
              <div className="mt-4 grid gap-3 text-sm leading-7 text-[color:var(--game-text)]">
                {snapshot.scene.ui.primaryPanelBody.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>

            <div className="pixel-panel">
              <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">V3 Atmosphere</div>
              <div className="mt-4 grid gap-3 text-sm leading-7 text-[color:var(--game-text)]">
                <p>{snapshot.environment.sceneAmbience}</p>
                <p>{snapshot.dynamicEvent ? snapshot.dynamicEvent.description : "No special event is active in this zone right now."}</p>
                <p>
                  Achievements unlocked: {unlockedAchievements}/{snapshot.achievements.length}. Scrapbook pages pinned: {unlockedScrapbook}/{snapshot.scrapbook.length}.
                </p>
              </div>
              {snapshot.scene.id === "room" ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  {sectionList.map((item) => (
                    <button key={item.slug} type="button" className="pixel-button text-sm" onClick={() => sendCommand({ type: "openSection", slug: item.slug })}>
                      {item.roomLabel}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[4px] border-[3px] border-[color:var(--game-ink)] bg-[rgba(255,249,233,0.72)] px-4 py-4 text-sm leading-7 text-[color:var(--game-subtle)]">
                  The task journal now combines route progress, atmosphere, achievements, and scrapbook unlocks in one place.
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="pixel-panel">
              <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">Current Stage</div>
              <h2 className="mt-2 text-lg font-black text-[color:var(--game-text)]">{snapshot.quest.currentStageLabel}</h2>
              <p className="mt-3 text-sm leading-7 text-[color:var(--game-subtle)]">{snapshot.quest.currentStageDescription}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <div className="pixel-chip text-xs">{snapshot.quest.progressLabel}</div>
                <div className="pixel-chip text-xs">Next stop: {snapshot.quest.nextLocation}</div>
                {snapshot.activeNpc && <div className="pixel-chip text-xs">Key contact: {snapshot.activeNpc.label}</div>}
              </div>
              <div className="mt-4 grid gap-3">
                {snapshot.objectives.map((objective) => (
                  <div key={objective.id} className="rounded-[4px] border-[3px] border-[color:var(--game-ink)] bg-[rgba(255,249,233,0.76)] px-4 py-3">
                    <div className="text-sm font-black text-[color:var(--game-text)]">{objective.label}</div>
                    <p className="mt-2 text-sm leading-7 text-[color:var(--game-subtle)]">{objective.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pixel-panel">
              <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">Route Intel</div>
              <div className="mt-4 grid gap-3">
                {snapshot.worldDestinations.map((destination) => (
                  <div key={destination.id} className="rounded-[4px] border-[3px] border-[color:var(--game-ink)] bg-[rgba(255,249,233,0.78)] px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="text-sm font-black text-[color:var(--game-text)]">{destination.label}</div>
                      <div className="pixel-chip px-2 py-1 text-[10px]">{getDestinationStatus(destination, snapshot.scene.id)}</div>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[color:var(--game-subtle)]">{destination.description}</p>
                    {destination.collectibleHint && <p className="mt-2 text-xs leading-6 text-[color:var(--game-muted)]">Hint: {destination.collectibleHint}</p>}
                    {!destination.available && destination.lockedReason && <p className="mt-2 text-xs leading-6 text-[color:var(--game-muted)]">Unlock: {destination.lockedReason}</p>}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-6 text-[color:var(--game-muted)]">
                Open routes: {unlockedRoutes}/{snapshot.worldDestinations.length}
              </p>
            </div>
          </div>
        </section>
      </div>

      {snapshot.worldMapOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-[rgba(10,8,7,0.72)]" aria-label="Close world navigation" onClick={() => sendCommand({ type: "setWorldMapOpen", open: false })} />
          <div className="relative z-[1] w-full max-w-3xl pixel-frame p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[color:var(--game-muted)]">World Routes</div>
                <h2 className="mt-2 text-2xl font-black text-[color:var(--game-text)]">Expedition Navigation</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--game-subtle)]">
                  Route hints follow the current quest stage, so this board now acts like part of the playable mission flow instead of a static map.
                </p>
              </div>
              <button type="button" className="pixel-button px-3 py-2 text-xs sm:text-sm" onClick={() => sendCommand({ type: "setWorldMapOpen", open: false })}>
                Close routes
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {snapshot.worldDestinations.map((destination) => {
                const disabled = !destination.available || destination.targetSceneId === snapshot.scene.id
                return (
                  <button
                    key={destination.id}
                    type="button"
                    disabled={disabled}
                    className="journal-tab disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => sendCommand({ type: "transitionToScene", sceneId: destination.targetSceneId })}
                  >
                    <span className="journal-tab__eyebrow">{getDestinationStatus(destination, snapshot.scene.id)}</span>
                    <span className="mt-2 text-sm font-black text-[color:var(--game-ink)]">{destination.label}</span>
                    <span className="mt-2 text-xs leading-6 text-[color:var(--game-muted)]">{destination.description}</span>
                    {destination.collectibleHint && <span className="mt-2 text-xs leading-6 text-[color:var(--game-muted)]">Hint: {destination.collectibleHint}</span>}
                    {!destination.available && destination.lockedReason && <span className="mt-2 text-xs leading-6 text-[color:var(--game-muted)]">Unlock: {destination.lockedReason}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {snapshot.taskPanelOpen && (
        <TaskPanel snapshot={snapshot} onClose={() => sendCommand({ type: "closeTaskPanel" })} onAcknowledgeDialogue={() => sendCommand({ type: "acknowledgeDialogue" })} />
      )}

      {section && (
        <ArchiveModal
          section={section}
          phase={phase}
          audioEnabled={snapshot.audioEnabled}
          audioUnlocked={audio.unlocked}
          onClose={() => sendCommand({ type: "closeSection" })}
          onSelectSection={(slug) => sendCommand({ type: "openSection", slug })}
          onToggleAudio={() => sendCommand({ type: "toggleAudio" })}
          registerDialog={() => undefined}
        />
      )}
    </main>
  )
}
