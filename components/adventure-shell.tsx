"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import ArchiveModal from "@/components/archive-modal"
import { createSceneBridge } from "@/game/phaser/adapters/sceneBridge"
import { createPhaserGame } from "@/game/phaser/createPhaserGame"
import { createAdventureStore } from "@/game/simulation/adventure-store"
import type { AdventureCommand } from "@/game/types"
import { usePixelAudio } from "@/hooks/use-pixel-audio"
import { blogSections, sectionList, type SectionSlug } from "@/lib/blog-content"

const OPEN_MS = 180
const CLOSE_MS = 220

function useSectionOverlay(activeSection: SectionSlug | null) {
  const [displayedSection, setDisplayedSection] = useState<SectionSlug | null>(activeSection)
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("open")

  useEffect(() => {
    let timer = 0

    if (activeSection) {
      setDisplayedSection(activeSection)
      setPhase("opening")
      timer = window.setTimeout(() => {
        setPhase("open")
      }, OPEN_MS)
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

  return {
    displayedSection,
    phase,
  }
}

type PhaserViewportProps = {
  bridge: ReturnType<typeof createSceneBridge>
}

function PhaserViewport({ bridge }: PhaserViewportProps) {
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

  useEffect(() => {
    return () => {
      store.destroy()
    }
  }, [store])

  useEffect(() => {
    if (snapshot.audioEnabled !== audio.enabled) {
      audio.toggleEnabled()
    }
  }, [audio, snapshot.audioEnabled])

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
  const contextLabel = snapshot.contextTarget?.label ?? snapshot.hoverTarget?.label ?? snapshot.scene.ui.title
  const contextHint = snapshot.contextTarget?.hint ?? snapshot.hoverTarget?.hint ?? snapshot.scene.ui.description

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="pixel-frame overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b-[3px] border-[rgba(29,21,17,0.18)] px-4 py-4">
            <div className="max-w-3xl">
              <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[rgba(255,247,226,0.8)]">
                {snapshot.scene.id === "room" ? "Phaser Room Runtime" : "Phaser Outpost Runtime"}
              </div>
              <div className="mt-2 text-xl font-black text-[color:var(--game-text)] sm:text-2xl">{contextLabel}</div>
              <p className="mt-2 text-sm leading-7 text-[color:var(--game-subtle)] sm:text-base">{contextHint}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="pixel-chip bg-[rgba(255,246,220,0.85)] text-xs">
                {snapshot.transitionState.phase === "switching"
                  ? `切换到 ${snapshot.scene.id === "room" ? "房间" : "前哨"}`
                  : `${snapshot.scene.id === "room" ? "房间" : "前哨"}坐标 ${snapshot.player.currentTile.x},${snapshot.player.currentTile.y}`}
              </div>
              {snapshot.player.bubble && <div className="pixel-chip text-xs">{snapshot.player.bubble}</div>}
              {snapshot.dog.bubble && <div className="pixel-chip text-xs">{snapshot.dog.bubble}</div>}
              <button type="button" className="pixel-button px-3 py-2 text-xs sm:text-sm" onClick={() => sendCommand({ type: "toggleAudio" })}>
                {snapshot.audioEnabled ? "环境音开启" : "环境音关闭"}
              </button>
            </div>
          </div>

          <div className="p-3 sm:p-4">
            <PhaserViewport bridge={bridge} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="pixel-panel">
            <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">{snapshot.scene.ui.primaryPanelTitle}</div>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-[color:var(--game-text)]">
              {snapshot.scene.ui.primaryPanelBody.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>

          <div className="pixel-panel">
            <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">{snapshot.scene.ui.secondaryPanelTitle}</div>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-[color:var(--game-text)]">
              {snapshot.scene.ui.secondaryPanelBody.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>

            {snapshot.scene.id === "room" ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {sectionList.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    className="pixel-button text-sm"
                    onClick={() => sendCommand({ type: "openSection", slug: item.slug })}
                  >
                    {item.roomLabel}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[4px] border-[3px] border-[color:var(--game-ink)] bg-[rgba(255,249,233,0.72)] px-4 py-4 text-sm leading-7 text-[color:var(--game-subtle)]">
                路牌会打开世界导航。第一版先把结构立住：可进入目标和未来区域会一起挂在面板里，而不是继续把出口写死在页面组件里。
              </div>
            )}
          </div>
        </section>
      </div>

      {snapshot.worldMapOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(10,8,7,0.72)]"
            aria-label="关闭世界导航"
            onClick={() => sendCommand({ type: "setWorldMapOpen", open: false })}
          />
          <div className="relative z-[1] w-full max-w-3xl pixel-frame p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[color:var(--game-muted)]">World Routes</div>
                <h2 className="mt-2 text-2xl font-black text-[color:var(--game-text)]">营地世界导航</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--game-subtle)]">
                  这里先承接前哨路牌。可进入区域会直接切场景，未开放区域先占位，后续只需要补 `scene definition` 就能继续扩世界。
                </p>
              </div>
              <button type="button" className="pixel-button px-3 py-2 text-xs sm:text-sm" onClick={() => sendCommand({ type: "setWorldMapOpen", open: false })}>
                关闭导航
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {snapshot.worldDestinations.map((destination) => {
                const disabled = !destination.available || !destination.targetSceneId
                const isCurrent = destination.targetSceneId === snapshot.scene.id
                return (
                  <button
                    key={destination.id}
                    type="button"
                    disabled={disabled || isCurrent}
                    className="journal-tab disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      if (!destination.targetSceneId) return
                      sendCommand({ type: "transitionToScene", sceneId: destination.targetSceneId })
                    }}
                  >
                    <span className="journal-tab__eyebrow">{disabled ? "Locked Route" : isCurrent ? "Current Zone" : "Open Route"}</span>
                    <span className="mt-2 text-sm font-black text-[color:var(--game-ink)]">{destination.label}</span>
                    <span className="mt-2 text-xs leading-6 text-[color:var(--game-muted)]">{destination.description}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
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
