"use client"

import type { AdventureSnapshot } from "@/game/types"

type TaskPanelProps = {
  snapshot: AdventureSnapshot
  onClose: () => void
  onAcknowledgeDialogue: () => void
}

export default function TaskPanel({ snapshot, onClose, onAcknowledgeDialogue }: TaskPanelProps) {
  const { quest, npcs, recentDialogue, progress, dynamicEvent, environment } = snapshot
  const unlockedAchievements = snapshot.achievements.filter((item) => item.unlocked).length
  const unlockedScrapbook = snapshot.scrapbook.filter((item) => item.unlocked).length

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-[rgba(10,8,7,0.72)]" aria-label="Close task panel" onClick={onClose} />
      <div className="relative z-[1] w-full max-w-6xl pixel-frame p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b-[3px] border-[rgba(29,21,17,0.18)] pb-4">
          <div className="max-w-3xl">
            <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[color:var(--game-muted)]">Task Journal</div>
            <h2 className="mt-2 text-2xl font-black text-[color:var(--game-text)]">{quest.label}</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--game-subtle)]">
              Stage: {quest.currentStageLabel} | Next stop: {quest.nextLocation}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="pixel-chip text-xs">{quest.progressLabel}</div>
            <div className="pixel-chip text-xs">NPCs {progress.metNpcIds.length}/3</div>
            <div className="pixel-chip text-xs">Memories {progress.collectedMemories.length}/2</div>
            <div className="pixel-chip text-xs">Achievements {unlockedAchievements}/{snapshot.achievements.length}</div>
            <button type="button" className="pixel-button px-3 py-2 text-xs sm:text-sm" onClick={onClose}>
              Close panel
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr_0.9fr]">
          <div className="grid gap-4">
            {recentDialogue && (
              <div className="pixel-panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">Recent Dialogue</div>
                    <h3 className="mt-2 text-lg font-black text-[color:var(--game-text)]">{recentDialogue.title}</h3>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[color:var(--game-muted)]">{recentDialogue.npcLabel}</p>
                  </div>
                  <button type="button" className="pixel-button px-3 py-2 text-xs" onClick={onAcknowledgeDialogue}>
                    Dismiss
                  </button>
                </div>
                <div className="mt-4 grid gap-3 text-sm leading-7 text-[color:var(--game-text)]">
                  {recentDialogue.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="pixel-panel">
              <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">Quest Stages</div>
              <div className="mt-4 grid gap-3">
                {quest.stages.map((stage) => (
                  <div key={stage.id} className="rounded-[4px] border-[3px] border-[color:var(--game-ink)] bg-[rgba(255,249,233,0.76)] px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="text-sm font-black text-[color:var(--game-text)]">{stage.label}</div>
                      <div className="pixel-chip px-2 py-1 text-[10px]">{stage.status === "completed" ? "Completed" : stage.status === "active" ? "Active" : "Locked"}</div>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[color:var(--game-subtle)]">{stage.description}</p>
                    <p className="mt-2 text-xs leading-6 text-[color:var(--game-muted)]">Location: {stage.nextLocation}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="pixel-panel">
              <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">Field Notes</div>
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
              <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">Atmosphere</div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-[4px] border-[3px] border-[color:var(--game-ink)] bg-[rgba(255,249,233,0.76)] px-4 py-3">
                  <div className="text-sm font-black text-[color:var(--game-text)]">
                    {environment.timeLabel} / {environment.weatherLabel}
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--game-subtle)]">{environment.sceneAmbience}</p>
                </div>
                {dynamicEvent ? (
                  <div className="rounded-[4px] border-[3px] border-[color:var(--game-ink)] bg-[rgba(255,249,233,0.76)] px-4 py-3">
                    <div className="text-sm font-black text-[color:var(--game-text)]">{dynamicEvent.label}</div>
                    <p className="mt-2 text-sm leading-7 text-[color:var(--game-subtle)]">{dynamicEvent.description}</p>
                  </div>
                ) : (
                  <div className="rounded-[4px] border-[3px] border-[color:var(--game-ink)] bg-[rgba(255,249,233,0.76)] px-4 py-3 text-sm leading-7 text-[color:var(--game-subtle)]">
                    No special event is active in this zone right now.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="pixel-panel">
              <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">NPC Archive</div>
              <div className="mt-4 grid gap-3">
                {npcs.map((npc) => (
                  <div key={npc.id} className="rounded-[4px] border-[3px] border-[color:var(--game-ink)] bg-[rgba(255,249,233,0.76)] px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="text-sm font-black text-[color:var(--game-text)]">{npc.label}</div>
                      <div className="pixel-chip px-2 py-1 text-[10px]">{npc.active ? "Current" : npc.met ? "Met" : "Unknown"}</div>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[color:var(--game-muted)]">{npc.role}</p>
                    <p className="mt-2 text-sm leading-7 text-[color:var(--game-subtle)]">{npc.profile}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pixel-panel">
              <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">Achievements</div>
              <div className="mt-4 grid gap-3">
                {snapshot.achievements.map((achievement) => (
                  <div key={achievement.id} className="rounded-[4px] border-[3px] border-[color:var(--game-ink)] bg-[rgba(255,249,233,0.76)] px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="text-sm font-black text-[color:var(--game-text)]">{achievement.label}</div>
                      <div className="pixel-chip px-2 py-1 text-[10px]">{achievement.unlocked ? "Unlocked" : "Locked"}</div>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[color:var(--game-subtle)]">{achievement.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pixel-panel">
              <div className="font-display text-xs uppercase tracking-[0.3em] text-[color:var(--game-muted)]">Scrapbook</div>
              <div className="mt-4 grid gap-3">
                {snapshot.scrapbook.map((entry) => (
                  <div key={entry.id} className="rounded-[4px] border-[3px] border-[color:var(--game-ink)] bg-[rgba(255,249,233,0.76)] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--game-muted)]">{entry.eyebrow}</p>
                    <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
                      <div className="text-sm font-black text-[color:var(--game-text)]">{entry.title}</div>
                      <div className="pixel-chip px-2 py-1 text-[10px]">{entry.unlocked ? "Pinned" : "Hidden"}</div>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[color:var(--game-subtle)]">
                      {entry.unlocked ? entry.caption : "Keep exploring the route and atmosphere cycle to unlock this page."}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-6 text-[color:var(--game-muted)]">
                Scrapbook pages unlocked: {unlockedScrapbook}/{snapshot.scrapbook.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
