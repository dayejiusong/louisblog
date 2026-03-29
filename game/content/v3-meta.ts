import type {
  AchievementId,
  DynamicEventId,
  SceneId,
  ScrapbookEntryId,
  TimeOfDay,
  Weather,
} from "../types.ts"

export const timeOfDayOrder: TimeOfDay[] = ["day", "dusk", "night"]
export const weatherOrder: Weather[] = ["clear", "drizzle", "fog"]

export const timeOfDayLabels: Record<TimeOfDay, string> = {
  day: "Day",
  dusk: "Dusk",
  night: "Night",
}

export const weatherLabels: Record<Weather, string> = {
  clear: "Clear",
  drizzle: "Drizzle",
  fog: "Fog",
}

export const achievementDefinitions: Record<AchievementId, { label: string; description: string }> = {
  "night-watch": {
    label: "Night Watch",
    description: "Stay in the world long enough to watch the first night settle in.",
  },
  "all-friends": {
    label: "All Friends",
    description: "Meet the camp keeper, the ridge scout, and the shore listener.",
  },
  "memory-bearer": {
    label: "Memory Bearer",
    description: "Bring both the ridge cache and the shore memory back through the route.",
  },
  "weather-reader": {
    label: "Weather Reader",
    description: "Experience clear skies, drizzle, and fog in the same save.",
  },
  "camp-complete": {
    label: "Camp Complete",
    description: "Close the full camp expedition loop with the final report.",
  },
}

export const scrapbookDefinitions: Record<ScrapbookEntryId, { eyebrow: string; title: string; caption: string }> = {
  "first-departure": {
    eyebrow: "Departure",
    title: "First Departure",
    caption: "The room stopped being the whole story the first time the crack led somewhere real.",
  },
  "campfire-note": {
    eyebrow: "Campfire",
    title: "Dusk Around the Fire",
    caption: "At dusk the outpost fire turns the whole route board into a map worth following.",
  },
  "ridge-postcard": {
    eyebrow: "Ridge",
    title: "Fog on the Switchback",
    caption: "The ridge trail feels like a postcard when the fog sits on the wind gap.",
  },
  "shore-postcard": {
    eyebrow: "Shore",
    title: "Luminous Tide",
    caption: "At night the surf picks up a glow that makes the last memory impossible to miss.",
  },
  "expedition-epilogue": {
    eyebrow: "Epilogue",
    title: "After the Report",
    caption: "Once the expedition closes, the outpost feels less like transit and more like a scrapbook page.",
  },
}

export const dynamicEventDefinitions: Record<
  DynamicEventId,
  {
    label: string
    description: string
    sceneId: SceneId
    timeOfDay?: TimeOfDay
    weather?: Weather
  }
> = {
  "window-rain": {
    label: "Window Rain",
    description: "Soft rain streaks past the room window and makes the departure feel immediate.",
    sceneId: "room",
    weather: "drizzle",
  },
  "campfire-circle": {
    label: "Campfire Circle",
    description: "Dusk gathers around the campfire and turns the outpost into a shared checkpoint.",
    sceneId: "outpost",
    timeOfDay: "dusk",
  },
  "ridge-fog": {
    label: "Ridge Fog",
    description: "Fog rolls over the ridge and makes the trail feel like a marked memory.",
    sceneId: "ridge",
    weather: "fog",
  },
  "luminous-tide": {
    label: "Luminous Tide",
    description: "Night surf on the shore carries a faint glow along the waterline.",
    sceneId: "shore",
    timeOfDay: "night",
  },
}

export function nextTimeOfDay(current: TimeOfDay) {
  const index = timeOfDayOrder.indexOf(current)
  return timeOfDayOrder[(index + 1) % timeOfDayOrder.length]
}

export function nextWeather(current: Weather) {
  const index = weatherOrder.indexOf(current)
  return weatherOrder[(index + 1) % weatherOrder.length]
}

export function getSceneAmbience(sceneId: SceneId, timeOfDay: TimeOfDay, weather: Weather) {
  const sceneLabel =
    sceneId === "room"
      ? "Room hush"
      : sceneId === "outpost"
        ? "Campfire air"
        : sceneId === "ridge"
          ? "Ridge wind"
          : "Shore wash"

  return `${timeOfDayLabels[timeOfDay]} / ${weatherLabels[weather]} / ${sceneLabel}`
}

export function getDynamicEvent(sceneId: SceneId, timeOfDay: TimeOfDay, weather: Weather): DynamicEventId | null {
  const match = (Object.keys(dynamicEventDefinitions) as DynamicEventId[]).find((eventId) => {
    const event = dynamicEventDefinitions[eventId]
    return event.sceneId === sceneId && (!event.timeOfDay || event.timeOfDay === timeOfDay) && (!event.weather || event.weather === weather)
  })

  return match ?? null
}
