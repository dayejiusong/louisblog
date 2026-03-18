"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import ArchiveModal from "@/components/archive-modal"
import PersonalRoom from "@/components/personal-room"
import { useArchiveModal } from "@/hooks/use-archive-modal"
import { useDogNpc } from "@/hooks/use-dog-npc"
import { usePixelAudio } from "@/hooks/use-pixel-audio"
import { useRoomController } from "@/hooks/use-room-controller"
import { blogSections, roomHotspots, sectionList, type SectionSlug } from "@/lib/blog-content"
import { loadRoomAvatarState, type RoomAvatarState } from "@/lib/room-session"

const defaultAvatar: RoomAvatarState = { x: 10, y: 10, facing: "N" }

export default function Page() {
  const roomFocusRef = useRef<HTMLDivElement | null>(null)
  const [initialAvatar, setInitialAvatar] = useState<RoomAvatarState>(defaultAvatar)
  const [roomReady, setRoomReady] = useState(false)
  const audio = usePixelAudio()
  const modal = useArchiveModal({
    onPlaySound: audio.playSound,
  })

  useEffect(() => {
    const restored = loadRoomAvatarState() ?? defaultAvatar
    setInitialAvatar(restored)
    setRoomReady(true)
  }, [])

  const openSectionFromRoom = useCallback(
    (slug: SectionSlug) => {
      modal.openSection(slug, roomFocusRef.current)
    },
    [modal]
  )

  const room = useRoomController({
    initialAvatar,
    hotspots: roomHotspots,
    modalOpen: modal.phase !== "closed",
    activeSection: modal.activeSection,
    onOpenSection: openSectionFromRoom,
    onPrimeAudio: audio.prime,
    onPlaySound: audio.playSound,
  })

  const dog = useDogNpc({
    grid: room.grid,
    modalOpen: modal.phase !== "closed",
    inspectFlash: room.state.inspectFlash,
  })

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = modal.isMounted ? "hidden" : previousOverflow

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && modal.isMounted) {
        event.preventDefault()
        modal.requestClose()
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleEscape)
    }
  }, [modal])

  const openShortcut = useCallback(
    async (slug: SectionSlug, trigger: HTMLElement | null) => {
      void audio.prime().catch(() => undefined)
      modal.openSection(slug, trigger)
    },
    [audio, modal]
  )

  const section = modal.activeSection ? blogSections[modal.activeSection] : null

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="pixel-frame overflow-hidden">
          <div className="px-3 py-3 sm:px-4 sm:py-4">
            <PersonalRoom
              focusRef={roomFocusRef}
              hotspots={roomHotspots}
              interactionReady={roomReady}
              modalOpen={modal.phase !== "closed"}
              activeSection={modal.activeSection}
              currentTile={room.state.currentTile}
              hoverHotspotId={room.state.hoverHotspotId}
              linkedHotspotId={room.state.linkedHotspotId}
              bubble={room.state.bubble}
              inspectFlash={room.state.inspectFlash}
              audioEnabled={audio.enabled}
              avatarVisualRef={room.avatarVisualRef}
              dogVisualRef={dog.dogVisualRef}
              dogState={dog.dogState}
              onMoveToTile={room.queueGroundMove}
              onInteractHotspot={room.queueHotspot}
              onInteractDog={dog.onInteractDog}
              onHoverHotspot={room.updateHoverHotspot}
              onToggleAudio={audio.toggleEnabled}
              tick={room.tick}
              tickDog={dog.tickDog}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="pixel-panel">
            <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">操作方式</div>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-[color:var(--game-text)]">
              <p>点击地面：角色只会移动，不会打开内容。</p>
              <p>点击物件：角色先走到交互点，再弹出对应的冒险日志窗。</p>
              <p>点击柴犬：会摇尾巴并冒出“汪！”，但不会打断其他房间交互。</p>
              <p>按下 Esc 或点右上角关闭：会回到房间继续逛，不会离开首页。</p>
            </div>
          </div>

          <div className="pixel-panel">
            <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">备用入口</div>
            <div className="mt-4 flex flex-wrap gap-3">
              {sectionList.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  className="pixel-button text-sm"
                  onClick={(event) => void openShortcut(item.slug, event.currentTarget)}
                >
                  {item.roomLabel}
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm leading-7 text-[color:var(--game-muted)]">
              这组按钮和房间里的可点击物品一一对应，方便移动端和键盘用户直接打开同一套日志窗。
            </p>
          </div>
        </section>
      </div>

      {section && (
        <ArchiveModal
          section={section}
          phase={modal.phase === "closed" ? "open" : modal.phase}
          audioEnabled={audio.enabled}
          audioUnlocked={audio.unlocked}
          onClose={modal.requestClose}
          onSelectSection={(slug) => modal.openSection(slug, roomFocusRef.current)}
          onToggleAudio={audio.toggleEnabled}
          registerDialog={modal.registerDialog}
        />
      )}
    </main>
  )
}
