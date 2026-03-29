"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { SceneId, TimeOfDay, Weather } from "@/game/types"

type SoundEvent = "hover" | "confirm" | "open" | "switch" | "close" | "blocked"

type AmbienceProfile = {
  sceneId: SceneId
  timeOfDay: TimeOfDay
  weather: Weather
}

export type AudioFeedbackState = {
  enabled: boolean
  unlocked: boolean
  toggleEnabled: () => void
  prime: () => Promise<void>
  playSound: (event: SoundEvent) => void
  setAmbience: (sceneId: SceneId, timeOfDay: TimeOfDay, weather: Weather) => void
}

const baseSceneFrequency: Record<SceneId, number> = {
  room: 88,
  outpost: 118,
  ridge: 146,
  shore: 174,
}

const timeMultiplier: Record<TimeOfDay, number> = {
  day: 1,
  dusk: 0.92,
  night: 0.78,
}

const weatherGain: Record<Weather, number> = {
  clear: 0.082,
  drizzle: 0.102,
  fog: 0.094,
}

export function usePixelAudio(): AudioFeedbackState {
  const [enabled, setEnabled] = useState(true)
  const [unlocked, setUnlocked] = useState(false)

  const contextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const ambientGainRef = useRef<GainNode | null>(null)
  const ambientNodesRef = useRef<OscillatorNode[]>([])
  const hoverCooldownRef = useRef(0)
  const ambienceProfileRef = useRef<AmbienceProfile>({ sceneId: "room", timeOfDay: "day", weather: "clear" })

  const applyAmbience = useCallback((profile: AmbienceProfile) => {
    const context = contextRef.current
    const ambientGain = ambientGainRef.current
    const [a, b] = ambientNodesRef.current
    if (!context || !ambientGain || !a || !b) return

    const base = baseSceneFrequency[profile.sceneId] * timeMultiplier[profile.timeOfDay]
    const weatherOffset = profile.weather === "drizzle" ? -10 : profile.weather === "fog" ? -18 : 0
    const now = context.currentTime

    a.frequency.cancelScheduledValues(now)
    b.frequency.cancelScheduledValues(now)
    ambientGain.gain.cancelScheduledValues(now)

    a.frequency.linearRampToValueAtTime(base + weatherOffset, now + 0.35)
    b.frequency.linearRampToValueAtTime(base * 1.52 + weatherOffset * 0.35, now + 0.35)
    ambientGain.gain.linearRampToValueAtTime(enabled ? weatherGain[profile.weather] : 0, now + 0.3)
  }, [enabled])

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

      const ambientB = root.createOscillator()
      ambientB.type = "sine"

      const gainA = root.createGain()
      gainA.gain.value = 0.018
      const gainB = root.createGain()
      gainB.gain.value = 0.012

      ambientA.connect(gainA).connect(ambientGainRef.current)
      ambientB.connect(gainB).connect(ambientGainRef.current)

      ambientA.start()
      ambientB.start()
      ambientNodesRef.current = [ambientA, ambientB]
      applyAmbience(ambienceProfileRef.current)
    }

    setUnlocked(true)
  }, [applyAmbience])

  const prime = useCallback(async () => {
    if (typeof window === "undefined") return
    await ensureContext()
  }, [ensureContext])

  useEffect(() => {
    applyAmbience(ambienceProfileRef.current)
  }, [applyAmbience, enabled, unlocked])

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

  const setAmbience = useCallback((sceneId: SceneId, timeOfDay: TimeOfDay, weather: Weather) => {
    const profile = { sceneId, timeOfDay, weather }
    ambienceProfileRef.current = profile
    applyAmbience(profile)
  }, [applyAmbience])

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
    setAmbience,
  }
}
