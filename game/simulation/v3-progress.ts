import {
  achievementDefinitions,
  dynamicEventDefinitions,
  getDynamicEvent,
  getSceneAmbience,
  scrapbookDefinitions,
  timeOfDayLabels,
  weatherLabels,
} from "../content/v3-meta.ts"
import type {
  AchievementId,
  AchievementSummary,
  DynamicEventId,
  DynamicEventSummary,
  SceneId,
  ScrapbookEntryId,
  ScrapbookEntrySummary,
  WorldProgress,
} from "../types.ts"

function addUnique<T>(items: T[], value: T) {
  return items.includes(value) ? items : [...items, value]
}

export function syncV3Progress(progress: WorldProgress, sceneId: SceneId): WorldProgress {
  let next = {
    ...progress,
    seenTimesOfDay: addUnique(progress.seenTimesOfDay, progress.timeOfDay),
    seenWeather: addUnique(progress.seenWeather, progress.weather),
  }

  const eventId = getDynamicEvent(sceneId, next.timeOfDay, next.weather)
  if (eventId) {
    next = { ...next, seenDynamicEventIds: addUnique(next.seenDynamicEventIds, eventId) }
  }

  if (next.visitedScenes.includes("outpost")) {
    next = { ...next, unlockedScrapbookEntryIds: addUnique(next.unlockedScrapbookEntryIds, "first-departure") }
  }
  if (next.seenDynamicEventIds.includes("campfire-circle")) {
    next = { ...next, unlockedScrapbookEntryIds: addUnique(next.unlockedScrapbookEntryIds, "campfire-note") }
  }
  if (next.seenDynamicEventIds.includes("ridge-fog")) {
    next = { ...next, unlockedScrapbookEntryIds: addUnique(next.unlockedScrapbookEntryIds, "ridge-postcard") }
  }
  if (next.seenDynamicEventIds.includes("luminous-tide")) {
    next = { ...next, unlockedScrapbookEntryIds: addUnique(next.unlockedScrapbookEntryIds, "shore-postcard") }
  }
  if (next.completedQuestStageIds.includes("final-report")) {
    next = { ...next, unlockedScrapbookEntryIds: addUnique(next.unlockedScrapbookEntryIds, "expedition-epilogue") }
  }

  if (next.seenTimesOfDay.includes("night")) {
    next = { ...next, unlockedAchievementIds: addUnique(next.unlockedAchievementIds, "night-watch") }
  }
  if (next.metNpcIds.length === 3) {
    next = { ...next, unlockedAchievementIds: addUnique(next.unlockedAchievementIds, "all-friends") }
  }
  if (next.collectedMemories.includes("ridge-cache") && next.collectedMemories.includes("shore-memory")) {
    next = { ...next, unlockedAchievementIds: addUnique(next.unlockedAchievementIds, "memory-bearer") }
  }
  if (next.seenWeather.includes("clear") && next.seenWeather.includes("drizzle") && next.seenWeather.includes("fog")) {
    next = { ...next, unlockedAchievementIds: addUnique(next.unlockedAchievementIds, "weather-reader") }
  }
  if (next.completedQuestStageIds.includes("final-report")) {
    next = { ...next, unlockedAchievementIds: addUnique(next.unlockedAchievementIds, "camp-complete") }
  }

  return next
}

export function computeEnvironment(sceneId: SceneId, progress: WorldProgress) {
  return {
    timeOfDay: progress.timeOfDay,
    weather: progress.weather,
    timeLabel: timeOfDayLabels[progress.timeOfDay],
    weatherLabel: weatherLabels[progress.weather],
    sceneAmbience: getSceneAmbience(sceneId, progress.timeOfDay, progress.weather),
  }
}

export function computeDynamicEvent(sceneId: SceneId, progress: WorldProgress): DynamicEventSummary | null {
  const eventId = getDynamicEvent(sceneId, progress.timeOfDay, progress.weather)
  if (!eventId) return null
  const event = dynamicEventDefinitions[eventId]
  return {
    id: eventId,
    label: event.label,
    sceneId: event.sceneId,
    description: event.description,
    active: true,
  }
}

export function computeAchievements(progress: WorldProgress): AchievementSummary[] {
  return (Object.keys(achievementDefinitions) as AchievementId[]).map((id) => ({
    id,
    label: achievementDefinitions[id].label,
    description: achievementDefinitions[id].description,
    unlocked: progress.unlockedAchievementIds.includes(id),
  }))
}

export function computeScrapbook(progress: WorldProgress): ScrapbookEntrySummary[] {
  return (Object.keys(scrapbookDefinitions) as ScrapbookEntryId[]).map((id) => ({
    id,
    title: scrapbookDefinitions[id].title,
    eyebrow: scrapbookDefinitions[id].eyebrow,
    caption: scrapbookDefinitions[id].caption,
    unlocked: progress.unlockedScrapbookEntryIds.includes(id),
  }))
}

export function hasSeenEvent(progress: WorldProgress, eventId: DynamicEventId) {
  return progress.seenDynamicEventIds.includes(eventId)
}
