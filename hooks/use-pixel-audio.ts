"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type SoundEvent = "hover" | "confirm" | "open" | "switch" | "close" | "blocked"

export type AudioFeedbackState = {
  enabled: boolean
  unlocked: boolean
  toggleEnabled: () => void
  prime: () => Promise<void>
  playSound: (event: SoundEvent) => void
}

export function usePixelAudio(): AudioFeedbackState {
  const [enabled, setEnabled] = useState(true)
  const [unlocked, setUnlocked] = useState(false)

  const contextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const ambientGainRef = useRef<GainNode | null>(null)
  const ambientNodesRef = useRef<OscillatorNode[]>([])
  const hoverCooldownRef = useRef(0)

  const ensureContext = useCallback(async () => {
    if (!contextRef.current) {
      const context = new window.AudioContext()
      const masterGain = context.createGain()
      masterGain.gain.value = 0.18
      masterGain.connect(context.destination)

      const ambientGain = context.createGain()
      ambientGain.gain.value = 0
      ambientGain.connect(masterGain)

      contextRef.current = context
      masterGainRef.current = masterGain
      ambientGainRef.current = ambientGain
    }

    const context = contextRef.current
    if (context.state === "suspended") {
      await context.resume()
    }

    if (!ambientNodesRef.current.length && ambientGainRef.current) {
      const root = contextRef.current!
      const ambientA = root.createOscillator()
      ambientA.type = "triangle"
      ambientA.frequency.value = 96
      ambientA.detune.value = -8

      const ambientB = root.createOscillator()
      ambientB.type = "sine"
      ambientB.frequency.value = 144
      ambientB.detune.value = 5

      const gainA = root.createGain()
      gainA.gain.value = 0.018
      const gainB = root.createGain()
      gainB.gain.value = 0.01

      ambientA.connect(gainA).connect(ambientGainRef.current)
      ambientB.connect(gainB).connect(ambientGainRef.current)

      ambientA.start()
      ambientB.start()
      ambientNodesRef.current = [ambientA, ambientB]
    }

    setUnlocked(true)
  }, [])

  const prime = useCallback(async () => {
    if (typeof window === "undefined") return
    await ensureContext()
  }, [ensureContext])

  useEffect(() => {
    const ambientGain = ambientGainRef.current
    const context = contextRef.current
    if (!ambientGain || !context) return

    const now = context.currentTime
    ambientGain.gain.cancelScheduledValues(now)
    ambientGain.gain.linearRampToValueAtTime(enabled ? 0.085 : 0, now + 0.2)
  }, [enabled, unlocked])

  const playSound = useCallback(
    (event: SoundEvent) => {
      const context = contextRef.current
      const masterGain = masterGainRef.current
      if (!enabled || !unlocked || !context || !masterGain) return

      if (event === "hover" && performance.now() - hoverCooldownRef.current < 120) {
        return
      }
      if (event === "hover") {
        hoverCooldownRef.current = performance.now()
      }

      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const filter = context.createBiquadFilter()

      oscillator.type = event === "blocked" ? "square" : "triangle"
      filter.type = "lowpass"
      filter.frequency.value = event === "blocked" ? 420 : 1600

      const now = context.currentTime
      const configs: Record<SoundEvent, { start: number; end: number; duration: number; volume: number }> = {
        hover: { start: 620, end: 700, duration: 0.05, volume: 0.045 },
        confirm: { start: 330, end: 510, duration: 0.1, volume: 0.06 },
        open: { start: 420, end: 720, duration: 0.16, volume: 0.075 },
        switch: { start: 540, end: 660, duration: 0.08, volume: 0.05 },
        close: { start: 640, end: 340, duration: 0.12, volume: 0.05 },
        blocked: { start: 240, end: 180, duration: 0.11, volume: 0.04 },
      }

      const config = configs[event]
      oscillator.frequency.setValueAtTime(config.start, now)
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(config.end, 80), now + config.duration)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(config.volume, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration)

      oscillator.connect(filter).connect(gain).connect(masterGain)
      oscillator.start(now)
      oscillator.stop(now + config.duration + 0.02)
    },
    [enabled, unlocked]
  )

  const toggleEnabled = useCallback(() => {
    setEnabled((value) => !value)
  }, [])

  useEffect(() => {
    return () => {
      ambientNodesRef.current.forEach((node) => node.stop())
      contextRef.current?.close().catch(() => undefined)
    }
  }, [])

  return {
    enabled,
    unlocked,
    toggleEnabled,
    prime,
    playSound,
  }
}
