"use client"

import type { BlogSection } from "@/lib/blog-content"

type Props = {
  section: BlogSection
}

export default function BlogSectionPage({ section }: Props) {
  const totalEntries = section.groups.reduce((total, group) => total + group.entries.length, 0)

  return (
    <div className="journal-view">
      <section className="scene-hero">
        <div className="scene-copy">
          <div className="scene-eyebrow">{section.display.eyebrow}</div>
          <h3 className="scene-title">{section.display.sceneTitle}</h3>
          <p className="scene-subtitle">{section.display.sceneSubtitle}</p>

          <div className="scene-tags">
            {section.display.sceneTags.map((tag) => (
              <span key={tag} className="scene-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="scene-preview">
          <div className={`scene-preview__screen scene-preview__screen--${section.slug}`}>
            <div className="scene-preview__grid" />
            <div className={`scene-preview__sprite scene-preview__sprite--${section.slug}`} />
          </div>

          <div className="scene-preview__stats">
            {section.display.scenePanels.map((panel) => (
              <div key={panel.label} className="scene-preview__stat">
                <span>{panel.label}</span>
                <strong>{panel.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="journal-summary journal-summary--compact">
        <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[color:var(--game-muted)]">
          冒险摘要
        </div>
        <h3 className="mt-3 text-2xl font-black text-[color:var(--game-text)] sm:text-3xl">{section.subtitle}</h3>
        <p className="mt-3 text-sm leading-7 text-[color:var(--game-subtle)] sm:text-base">{section.description}</p>

        <div className="summary-stats">
          <div className="summary-chip">
            <span>分组数</span>
            <strong>{section.groups.length}</strong>
          </div>
          <div className="summary-chip">
            <span>记录数</span>
            <strong>{totalEntries}</strong>
          </div>
          <div className="summary-chip">
            <span>档案类型</span>
            <strong>{section.display.groupLabel}</strong>
          </div>
        </div>
      </section>

      <div className="anchor-strip">
        {section.groups.map((group) => (
          <a key={group.id} href={`#${group.id}`} className="anchor-pill">
            {group.label}
          </a>
        ))}
      </div>

      <div className="grid gap-5">
        {section.groups.map((group, groupIndex) => (
          <section key={group.id} id={group.id} className="journal-group scroll-mt-24">
            <div className="journal-group__header">
              <div>
                <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[color:var(--game-muted)]">
                  {section.display.groupLabel} {String(groupIndex + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-2 text-2xl font-black text-[color:var(--game-text)]">{group.label}</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--game-subtle)]">{group.description}</p>
              </div>
              <div className="pixel-chip text-xs">{group.entries.length} 条记录</div>
            </div>

            <div className="journal-entry-grid">
              {group.entries.map((entry) => (
                <article key={`${group.id}-${entry.title}`} className="journal-card">
                  <div className="journal-card__topline">
                    <span className="journal-card__badge">{section.display.cardLabel}</span>
                    <span className="journal-card__meta">{entry.meta}</span>
                  </div>

                  <h4 className="mt-4 text-lg font-black leading-snug text-[color:var(--game-ink)]">{entry.title}</h4>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--game-text)]">{entry.note}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
