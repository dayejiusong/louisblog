"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { SectionSlug } from "@/lib/blog-content"

const OPEN_MS = 180
const CLOSE_MS = 220

export type ArchiveModalState = {
  activeSection: SectionSlug | null
  phase: "closed" | "opening" | "open" | "closing"
  isMounted: boolean
  isBlockingRoom: boolean
  openSection: (slug: SectionSlug, trigger?: HTMLElement | null) => void
  requestClose: () => void
  registerDialog: (node: HTMLDivElement | null) => void
}

type Options = {
  onPlaySound: (event: "open" | "switch" | "close") => void
}

export function useArchiveModal({ onPlaySound }: Options): ArchiveModalState {
  const [activeSection, setActiveSection] = useState<SectionSlug | null>(null)
  const [phase, setPhase] = useState<"closed" | "opening" | "open" | "closing">("closed")
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const timerRef = useRef<number | null>(null)

  const registerDialog = useCallback((node: HTMLDivElement | null) => {
    dialogRef.current = node
  }, [])

  const openSection = useCallback(
    (slug: SectionSlug, trigger?: HTMLElement | null) => {
      if (trigger) {
        triggerRef.current = trigger
      }

      setActiveSection((current) => {
        if (current && current !== slug) {
          onPlaySound("switch")
        } else if (!current) {
          onPlaySound("open")
        }
        return slug
      })

      setPhase((current) => (current === "closed" ? "opening" : "open"))
    },
    [onPlaySound]
  )

  const requestClose = useCallback(() => {
    if (phase === "closed" || phase === "closing") return
    onPlaySound("close")
    setPhase("closing")
  }, [onPlaySound, phase])

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (phase === "opening") {
      timerRef.current = window.setTimeout(() => {
        setPhase("open")
      }, OPEN_MS)
    }

    if (phase === "closing") {
      timerRef.current = window.setTimeout(() => {
        setPhase("closed")
        setActiveSection(null)
        triggerRef.current?.focus()
      }, CLOSE_MS)
    }

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [phase])

  useEffect(() => {
    if (phase !== "open" || !dialogRef.current) return
    const focusable = dialogRef.current.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    )
    focusable?.focus()
  }, [phase, activeSection])

  const isMounted = phase !== "closed"
  const isBlockingRoom = phase !== "closed" && phase !== "closing"

  return useMemo(
    () => ({
      activeSection,
      phase,
      isMounted,
      isBlockingRoom,
      openSection,
      requestClose,
      registerDialog,
    }),
    [activeSection, isBlockingRoom, isMounted, openSection, phase, registerDialog, requestClose]
  )
}
