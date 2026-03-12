"use client"

import { useEffect, useMemo, useRef } from "react"
import BlogSectionPage from "@/components/blog-section-page"
import { sectionList, type BlogSection, type SectionSlug } from "@/lib/blog-content"

type Props = {
  section: BlogSection
  phase: "opening" | "open" | "closing"
  audioEnabled: boolean
  audioUnlocked: boolean
  onClose: () => void
  onSelectSection: (slug: SectionSlug) => void
  onToggleAudio: () => void
  registerDialog: (node: HTMLDivElement | null) => void
}

function entryCount(section: BlogSection) {
  return section.groups.reduce((total, group) => total + group.entries.length, 0)
}

export default function ArchiveModal({
  section,
  phase,
  audioEnabled,
  audioUnlocked,
  onClose,
  onSelectSection,
  onToggleAudio,
  registerDialog,
}: Props) {
  const localDialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const dialog = localDialogRef.current
    if (!dialog) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== "Tab") return

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
        )
      ).filter((node) => !node.hasAttribute("disabled"))

      if (!focusable.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    dialog.addEventListener("keydown", handleKeyDown)
    return () => dialog.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const sectionProgress = useMemo(
    () => `${entryCount(section)} logs / ${section.groups.length} groups`,
    [section]
  )

  const hudItems = useMemo(
    () => [
      { label: "Room Object", value: section.roomLabel },
      ...section.display.hudStats,
      { label: "Progress", value: sectionProgress },
      {
        label: "Audio",
        value: audioUnlocked ? (audioEnabled ? "Pixel ambience on" : "Muted") : "Waiting for first interaction",
      },
    ],
    [audioEnabled, audioUnlocked, section, sectionProgress]
  )

  return (
    <div className={`archive-overlay archive-overlay--${phase}`}>
      <button type="button" className="archive-backdrop" aria-label="Close archive" onClick={onClose} />

      <div
        ref={(node) => {
          localDialogRef.current = node
          registerDialog(node)
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-title"
        className={`archive-window archive-window--${phase} archive-window--theme-${section.slug}`}
      >
        <header className="archive-header">
          <div className="archive-header__copy">
            <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[rgba(255,244,214,0.76)]">
              {section.display.eyebrow}
            </div>
            <h2 id="archive-title" className="mt-2 text-2xl font-black text-[rgba(255,248,228,0.98)] sm:text-3xl">
              {section.title}
            </h2>
            <p className="archive-header__subtitle">{section.display.sceneSubtitle}</p>
          </div>

          <div className="archive-header__actions">
            <button type="button" className="pixel-button px-3 py-2 text-xs sm:text-sm" onClick={onToggleAudio}>
              {audioEnabled ? "Audio on" : "Audio off"}
            </button>
            <button type="button" className="pixel-button px-3 py-2 text-xs sm:text-sm" onClick={onClose}>
              Return to room
            </button>
          </div>
        </header>

        <div className="archive-status">
          {hudItems.map((item) => (
            <div key={`${item.label}-${item.value}`} className="journal-stat">
              <span className="font-display text-[10px] uppercase tracking-[0.3em] text-[color:var(--game-muted)]">
                {item.label}
              </span>
              <strong className="mt-2 block text-sm text-[color:var(--game-text)]">{item.value}</strong>
            </div>
          ))}
        </div>

        <div className="archive-layout">
          <aside className="archive-sidebar">
            <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[color:var(--game-muted)]">
              {section.display.navLabel}
            </div>
            <div className="mt-4 grid gap-2">
              {sectionList.map((item) => {
                const active = item.slug === section.slug
                return (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => onSelectSection(item.slug)}
                    className={`journal-tab ${active ? "journal-tab--active" : ""}`}
                  >
                    <span className="journal-tab__eyebrow">{item.display.eyebrow}</span>
                    <span className="mt-2 text-sm font-black">{item.roomLabel}</span>
                    <span className="mt-2 text-xs leading-6 text-[color:var(--game-muted)]">{item.display.sceneTitle}</span>
                  </button>
                )
              })}
            </div>

            <div className="mt-5 pixel-panel archive-sidebar__notes">
              <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[color:var(--game-muted)]">
                System Feed
              </div>
              <div className="mt-4 grid gap-3">
                {section.stats.map((stat) => (
                  <div
                    key={stat}
                    className="rounded-sm border-2 border-[color:var(--game-ink)] bg-[rgba(27,21,18,0.06)] px-3 py-3 text-sm font-semibold text-[color:var(--game-text)]"
                  >
                    {stat}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="archive-content">
            <BlogSectionPage section={section} />
          </div>
        </div>
      </div>
    </div>
  )
}
