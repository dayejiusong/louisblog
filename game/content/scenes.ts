import { blogSections, roomHotspots } from "../../lib/blog-content.ts"
import { buildRoomGrid, roomGridIndex, type RoomGrid } from "../../lib/room-grid.ts"
import type { NpcDefinition, QuestId, QuestStageDefinition, SceneDefinition, SceneExit, SceneHotspot, SceneId, WorldDestination } from "../types.ts"

const roomGrid = buildRoomGrid(roomHotspots)

function buildOutdoorGrid(cols: number, rows: number, blockers: Array<[number, number]>): RoomGrid {
  const walkable = new Array(cols * rows).fill(true)

  const block = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < cols && y < rows) {
      walkable[roomGridIndex(x, y, cols)] = false
    }
  }

  for (let x = 0; x < cols; x += 1) {
    block(x, 0)
    block(x, rows - 1)
  }

  for (let y = 0; y < rows; y += 1) {
    block(0, y)
    block(cols - 1, y)
  }

  blockers.forEach(([x, y]) => block(x, y))

  return {
    cols,
    rows,
    walkable,
  }
}

const outpostGrid = buildOutdoorGrid(22, 16, [
  [3, 4],
  [4, 4],
  [5, 4],
  [4, 5],
  [5, 5],
  [6, 5],
  [7, 6],
  [8, 6],
  [7, 7],
  [12, 8],
  [13, 8],
  [14, 8],
  [13, 9],
  [14, 9],
  [15, 9],
  [10, 3],
  [11, 3],
  [16, 5],
  [17, 5],
  [18, 5],
])

const ridgeGrid = buildOutdoorGrid(24, 17, [
  [4, 4],
  [5, 4],
  [6, 4],
  [5, 5],
  [8, 8],
  [9, 8],
  [10, 8],
  [12, 6],
  [12, 7],
  [12, 8],
  [15, 10],
  [16, 10],
  [17, 10],
  [18, 10],
  [18, 9],
  [20, 6],
  [20, 7],
  [20, 8],
])

const shoreGrid = buildOutdoorGrid(24, 17, [
  [3, 9],
  [4, 9],
  [5, 9],
  [6, 9],
  [9, 6],
  [10, 6],
  [11, 6],
  [14, 11],
  [15, 11],
  [16, 11],
  [17, 11],
  [18, 11],
  [18, 10],
  [19, 10],
  [20, 10],
])

const roomHotspotMeta: Record<
  keyof typeof blogSections,
  Pick<SceneHotspot, "anchorTile" | "hitbox" | "renderKind">
> = {
  games: {
    anchorTile: { x: 13.5, y: 3.9 },
    hitbox: { offsetX: -48, offsetY: -58, width: 96, height: 76, snapDistance: 42 },
    renderKind: "desk",
  },
  rides: {
    anchorTile: { x: 3.9, y: 12.2 },
    hitbox: { offsetX: -44, offsetY: -48, width: 92, height: 64, snapDistance: 42 },
    renderKind: "bike",
  },
  travel: {
    anchorTile: { x: 9.2, y: 1.2 },
    hitbox: { offsetX: -44, offsetY: -90, width: 88, height: 58, snapDistance: 42 },
    renderKind: "window",
  },
  books: {
    anchorTile: { x: 1.3, y: 7.2 },
    hitbox: { offsetX: -46, offsetY: -78, width: 56, height: 92, snapDistance: 42 },
    renderKind: "bookshelf",
  },
  music: {
    anchorTile: { x: 15.1, y: 12.7 },
    hitbox: { offsetX: -28, offsetY: -44, width: 66, height: 54, snapDistance: 42 },
    renderKind: "record-player",
  },
}

const roomSceneHotspots: SceneHotspot[] = roomHotspots.map((hotspot) => ({
  ...hotspot,
  kind: "section",
  ...roomHotspotMeta[hotspot.id],
}))

export const npcDefinitions: Record<NpcDefinition["id"], NpcDefinition> = {
  "camp-keeper": {
    id: "camp-keeper",
    label: "营地主理人",
    role: "前哨任务发布者",
    sceneId: "outpost",
    accent: "#f4c76d",
    profile: "负责把零散路线整理成任务，把你和狗重新派往新的区域。",
  },
  "ridge-scout": {
    id: "ridge-scout",
    label: "山脊侦察员",
    role: "中段线索引导者",
    sceneId: "ridge",
    accent: "#ffe18e",
    profile: "守在山脊风口，提醒你先把路线缓存带回前哨。",
  },
  "shore-listener": {
    id: "shore-listener",
    label: "潮汐听者",
    role: "海边收束角色",
    sceneId: "shore",
    accent: "#a8ecff",
    profile: "会把海边的最后一段记忆交给你，结束这一轮远行。",
  },
}

export const campExpeditionQuest: {
  id: QuestId
  label: string
  stageOrder: QuestStageDefinition["id"][]
  stages: Record<QuestStageDefinition["id"], QuestStageDefinition>
} = {
  id: "camp-expedition",
  label: "营地远行",
  stageOrder: [
    "meet-camp-keeper",
    "reach-ridge-scout",
    "collect-ridge-cache",
    "report-to-camp",
    "reach-shore-listener",
    "collect-shore-memory",
    "final-report",
  ],
  stages: {
    "meet-camp-keeper": {
      id: "meet-camp-keeper",
      label: "和营地主理人碰头",
      description: "先去前哨和营地主理人交谈，让这趟远行正式开始。",
      nextLocation: "前哨营地",
    },
    "reach-ridge-scout": {
      id: "reach-ridge-scout",
      label: "找到山脊侦察员",
      description: "营地主理人已经放开山脊路线，先去风口确认下一段线索。",
      nextLocation: "山脊小道",
    },
    "collect-ridge-cache": {
      id: "collect-ridge-cache",
      label: "取回山脊缓存",
      description: "和侦察员碰头后，再去把山脊缓存带回来。",
      nextLocation: "山脊小道",
    },
    "report-to-camp": {
      id: "report-to-camp",
      label: "回前哨汇报",
      description: "缓存已经拿到，先回前哨交给营地主理人，再决定下一张地图。",
      nextLocation: "前哨营地",
    },
    "reach-shore-listener": {
      id: "reach-shore-listener",
      label: "找到潮汐听者",
      description: "海边路线已经开放，先去和潮汐听者确认最后的收尾任务。",
      nextLocation: "海边营地",
    },
    "collect-shore-memory": {
      id: "collect-shore-memory",
      label: "带回潮汐记忆",
      description: "听完提示后，把海边的潮汐记忆收回来。",
      nextLocation: "海边营地",
    },
    "final-report": {
      id: "final-report",
      label: "完成最终汇报",
      description: "带着最后的记忆回到前哨，向营地主理人做这次远行的总结。",
      nextLocation: "前哨营地",
    },
  },
}

export const baseWorldDestinations: Record<SceneId, Omit<WorldDestination, "available">> = {
  room: {
    id: "room-home",
    label: "房间",
    description: "内容入口和返程安全区，适合整理日志或临时回城。",
    targetSceneId: "room",
    collectibleHint: "房间始终可返回。",
  },
  outpost: {
    id: "outpost-hub",
    label: "前哨营地",
    description: "任务发布、汇报和世界路牌都在这里，是整条任务链的中心。",
    targetSceneId: "outpost",
    collectibleHint: "主理人在这里更新路线。",
  },
  ridge: {
    id: "ridge-trail",
    label: "山脊小道",
    description: "风口、缓存和侦察员都在这里，是海边之前的第一段野外路线。",
    targetSceneId: "ridge",
    lockedReason: "先和前哨的营地主理人碰头，再开放山脊路线。",
    collectibleHint: "山脊缓存会推进下一段旅程。",
  },
  shore: {
    id: "shore-camp",
    label: "海边营地",
    description: "潮汐听者和最终记忆都在海边，是这轮任务链的最后一站。",
    targetSceneId: "shore",
    lockedReason: "先把山脊缓存带回前哨汇报，再开放海边路线。",
    collectibleHint: "海边记忆会收束这次远行。",
  },
}

const outpostHotspots: SceneHotspot[] = [
  {
    id: "world-map",
    label: "营地路牌",
    hint: "查看当前开放路线、锁定条件和下一步目的地。",
    accent: "#8ed7ff",
    drawOrder: 7.1,
    footprint: [],
    interactionTile: { x: 8, y: 8 },
    kind: "world-map",
    anchorTile: { x: 7.2, y: 7.6 },
    hitbox: { offsetX: -36, offsetY: -52, width: 82, height: 70, snapDistance: 40 },
    renderKind: "signpost",
  },
  {
    id: "camp-keeper",
    label: npcDefinitions["camp-keeper"].label,
    hint: "和营地主理人聊聊，接任务、汇报进展，或查看这趟远行还差什么。",
    accent: npcDefinitions["camp-keeper"].accent,
    drawOrder: 7.8,
    footprint: [],
    interactionTile: { x: 12, y: 10 },
    kind: "npc",
    npcId: "camp-keeper",
    anchorTile: { x: 12.2, y: 9.7 },
    hitbox: { offsetX: -28, offsetY: -60, width: 58, height: 82, snapDistance: 34 },
    renderKind: "npc",
  },
]

const ridgeHotspots: SceneHotspot[] = [
  {
    id: "ridge-scout",
    label: npcDefinitions["ridge-scout"].label,
    hint: "先和侦察员确认情况，再动手收集山脊缓存。",
    accent: npcDefinitions["ridge-scout"].accent,
    drawOrder: 7.1,
    footprint: [],
    interactionTile: { x: 11, y: 8 },
    kind: "npc",
    npcId: "ridge-scout",
    anchorTile: { x: 10.2, y: 7.6 },
    hitbox: { offsetX: -28, offsetY: -60, width: 58, height: 82, snapDistance: 34 },
    renderKind: "npc",
  },
  {
    id: "ridge-cache",
    label: "山脊缓存",
    hint: "把路线缓存带走，再回前哨汇报。",
    accent: "#ffe18e",
    drawOrder: 7.4,
    footprint: [],
    interactionTile: { x: 15, y: 8 },
    kind: "collectible",
    anchorTile: { x: 15.3, y: 7.7 },
    hitbox: { offsetX: -30, offsetY: -54, width: 66, height: 72, snapDistance: 40 },
    renderKind: "memory-cache",
    collectibleId: "ridge-cache",
    collectibleLabel: "山脊路线缓存",
  },
]

const shoreHotspots: SceneHotspot[] = [
  {
    id: "shore-listener",
    label: npcDefinitions["shore-listener"].label,
    hint: "先听完潮汐听者的话，再去收下最后的记忆。",
    accent: npcDefinitions["shore-listener"].accent,
    drawOrder: 7.1,
    footprint: [],
    interactionTile: { x: 12, y: 8 },
    kind: "npc",
    npcId: "shore-listener",
    anchorTile: { x: 12.1, y: 7.7 },
    hitbox: { offsetX: -28, offsetY: -60, width: 58, height: 82, snapDistance: 34 },
    renderKind: "npc",
  },
  {
    id: "shore-memory",
    label: "潮汐记忆",
    hint: "把海边的最后一段记忆带回前哨，完成这轮远行。",
    accent: "#a8ecff",
    drawOrder: 7.4,
    footprint: [],
    interactionTile: { x: 17, y: 8 },
    kind: "collectible",
    anchorTile: { x: 17.2, y: 7.9 },
    hitbox: { offsetX: -30, offsetY: -54, width: 66, height: 72, snapDistance: 40 },
    renderKind: "memory-cache",
    collectibleId: "shore-memory",
    collectibleLabel: "潮汐记忆",
  },
]

const roomExit: SceneExit = {
  id: "room-outpost",
  label: "裂缝出口",
  hint: "穿过裂缝离开房间，和狗一起到前哨营地报到。",
  accent: "#8ed7ff",
  anchorTile: { x: 17.2, y: 3.1 },
  interactionTile: { x: 17, y: 3 },
  hitbox: { offsetX: -36, offsetY: -86, width: 80, height: 98, snapDistance: 48 },
  targetSceneId: "outpost",
  renderKind: "exit-crack",
}

const outpostExit: SceneExit = {
  id: "outpost-room",
  label: "返家裂缝",
  hint: "回房间整理内容入口，当前的任务链进度会保留下来。",
  accent: "#8ed7ff",
  anchorTile: { x: 2.3, y: 3.4 },
  interactionTile: { x: 2, y: 4 },
  hitbox: { offsetX: -48, offsetY: -82, width: 88, height: 98, snapDistance: 40 },
  targetSceneId: "room",
  renderKind: "return-crack",
}

const ridgeExit: SceneExit = {
  id: "ridge-outpost",
  label: "回前哨",
  hint: "沿着返程裂缝回到前哨，把山脊那边的消息带回去。",
  accent: "#8ed7ff",
  anchorTile: { x: 2.4, y: 4.2 },
  interactionTile: { x: 2, y: 5 },
  hitbox: { offsetX: -48, offsetY: -82, width: 88, height: 98, snapDistance: 40 },
  targetSceneId: "outpost",
  renderKind: "return-crack",
}

const shoreExit: SceneExit = {
  id: "shore-outpost",
  label: "回前哨",
  hint: "带着潮汐记忆回前哨，让这轮任务链正式收尾。",
  accent: "#8ed7ff",
  anchorTile: { x: 2.4, y: 4.2 },
  interactionTile: { x: 2, y: 5 },
  hitbox: { offsetX: -48, offsetY: -82, width: 88, height: 98, snapDistance: 40 },
  targetSceneId: "outpost",
  renderKind: "return-crack",
}

export const sceneDefinitions: Record<SceneId, SceneDefinition> = {
  room: {
    id: "room",
    grid: roomGrid,
    spawn: {
      player: { x: 10, y: 10, facing: "N" },
      dog: { x: 9, y: 11, facing: "N" },
    },
    hotspots: roomSceneHotspots,
    exits: [roomExit],
    decor: [
      { id: "room-crack", kind: "exit-crack", tileX: 17.2, tileY: 3.1, drawOrder: 1.4, accent: "#8ed7ff" },
      { id: "room-plant", kind: "plant", tileX: 16.1, tileY: 4.4, drawOrder: 3.8 },
      { id: "room-armchair", kind: "armchair", tileX: 11.4, tileY: 10.3, drawOrder: 4.4 },
      { id: "room-lamp", kind: "lamp", tileX: 16.6, tileY: 13.3, drawOrder: 4.6 },
    ],
    theme: {
      backgroundTop: 0x17313d,
      backgroundMid: 0x315b69,
      backgroundBottom: 0xaf9561,
      dimOverlay: 0x080706,
      hudAccent: "#f4c76d",
    },
    camera: {
      mode: "fixed",
      paddingTop: 8,
    },
    ui: {
      title: "房间入口",
      description: "从这里进入世界，也可以随时回来看文章、音乐和书架。",
      primaryPanelTitle: "当前节奏",
      primaryPanelBody: [
        "房间继续承担内容入口，但远行任务已经从这里延伸到前哨、山脊和海边。",
        "离开房间之后，任务链会逐步替代原来的静态目标卡，形成更明确的游玩循环。",
        "文章内容仍然保留在 DOM 弹窗里，不会被塞回 Phaser 世界。",
      ],
      secondaryPanelTitle: "房间入口",
      secondaryPanelBody: [
        "这里依旧是快速打开栏目内容的地方，也适合作为跑图后的回城点。",
      ],
    },
  },
  outpost: {
    id: "outpost",
    grid: outpostGrid,
    spawn: {
      player: { x: 6, y: 11, facing: "E" },
      dog: { x: 5, y: 12, facing: "E" },
    },
    hotspots: outpostHotspots,
    exits: [outpostExit],
    decor: [
      { id: "outpost-crack", kind: "return-crack", tileX: 2.3, tileY: 3.4, drawOrder: 3.1, accent: "#8ed7ff" },
      { id: "outpost-tent", kind: "tent", tileX: 13.8, tileY: 8.8, drawOrder: 5.4 },
      { id: "outpost-signpost", kind: "signpost", tileX: 7.2, tileY: 7.6, drawOrder: 7.1 },
      { id: "outpost-campfire", kind: "campfire", tileX: 10.6, tileY: 9.5, drawOrder: 8.8 },
    ],
    theme: {
      backgroundTop: 0x183347,
      backgroundMid: 0x355d75,
      backgroundBottom: 0x7f6a3f,
      dimOverlay: 0x080706,
      hudAccent: "#8ed7ff",
    },
    camera: {
      mode: "fixed",
      paddingTop: 12,
    },
    ui: {
      title: "前哨营地",
      description: "任务发布、阶段汇报和路线切换都在这里完成。",
      primaryPanelTitle: "V2 任务链",
      primaryPanelBody: [
        "这次的远行从营地主理人开始，主线会在这里接取，也会在这里收尾。",
        "世界地图仍然保留，但路线提示会优先对齐当前任务阶段，而不是只显示静态说明。",
        "任务面板会记录你已经见过的人、完成的阶段，以及当前该去哪里。",
      ],
      secondaryPanelTitle: "营地情报",
      secondaryPanelBody: [
        "先和营地主理人对话，山脊路线才会正式开放；海边则要等你带回山脊缓存再说。",
      ],
    },
  },
  ridge: {
    id: "ridge",
    grid: ridgeGrid,
    spawn: {
      player: { x: 5, y: 12, facing: "E" },
      dog: { x: 4, y: 12, facing: "E" },
    },
    hotspots: ridgeHotspots,
    exits: [ridgeExit],
    decor: [
      { id: "ridge-return", kind: "return-crack", tileX: 2.4, tileY: 4.2, drawOrder: 3.1, accent: "#8ed7ff" },
      { id: "ridge-cache-decor", kind: "memory-cache", tileX: 15.3, tileY: 7.7, drawOrder: 7.4, accent: "#ffe18e" },
      { id: "ridge-campfire", kind: "campfire", tileX: 18.3, tileY: 11.2, drawOrder: 8.5 },
      { id: "ridge-plant", kind: "plant", tileX: 19.8, tileY: 8.3, drawOrder: 8.1 },
    ],
    theme: {
      backgroundTop: 0x1d3745,
      backgroundMid: 0x496a57,
      backgroundBottom: 0xa78d61,
      dimOverlay: 0x080706,
      hudAccent: "#ffe18e",
    },
    camera: {
      mode: "fixed",
      paddingTop: 12,
    },
    ui: {
      title: "山脊小道",
      description: "侦察员和路线缓存都在这里，是 V2 任务链的中段。",
      primaryPanelTitle: "山脊任务",
      primaryPanelBody: [
        "先找到侦察员，再去收集山脊缓存，任务链会按这个顺序推进。",
        "拿到缓存之后不会直接开放终点，你还得回前哨向主理人汇报。",
        "狗会始终跟在你身后，不再自己跑开巡逻。",
      ],
      secondaryPanelTitle: "风口线索",
      secondaryPanelBody: [
        "山脊这段更像真正的中途站，用来把任务推进和地图解锁绑定在一起。",
      ],
    },
  },
  shore: {
    id: "shore",
    grid: shoreGrid,
    spawn: {
      player: { x: 5, y: 12, facing: "E" },
      dog: { x: 4, y: 12, facing: "E" },
    },
    hotspots: shoreHotspots,
    exits: [shoreExit],
    decor: [
      { id: "shore-return", kind: "return-crack", tileX: 2.4, tileY: 4.2, drawOrder: 3.1, accent: "#8ed7ff" },
      { id: "shore-memory-decor", kind: "memory-cache", tileX: 17.2, tileY: 7.9, drawOrder: 7.4, accent: "#a8ecff" },
      { id: "shore-campfire", kind: "campfire", tileX: 9.4, tileY: 11.2, drawOrder: 8.2 },
      { id: "shore-wave-left", kind: "shore-wave", tileX: 19.4, tileY: 4.8, drawOrder: 2.2, accent: "#7cd7ff" },
      { id: "shore-wave-right", kind: "shore-wave", tileX: 20.6, tileY: 6.2, drawOrder: 2.3, accent: "#7cd7ff" },
    ],
    theme: {
      backgroundTop: 0x194264,
      backgroundMid: 0x4a8ba5,
      backgroundBottom: 0xc9b07f,
      dimOverlay: 0x080706,
      hudAccent: "#a8ecff",
    },
    camera: {
      mode: "fixed",
      paddingTop: 12,
    },
    ui: {
      title: "海边营地",
      description: "潮汐听者会把最后一步交给你，之后就该回前哨做最终汇报。",
      primaryPanelTitle: "海边任务",
      primaryPanelBody: [
        "海边是这条任务链的最后一段，要先和潮汐听者碰头，再去收下最后的记忆。",
        "拿到潮汐记忆后，任务不会直接完结，你还要带着它回前哨做最终汇报。",
        "这里仍然保留回前哨的返程点，方便把整条任务链闭环收束。",
      ],
      secondaryPanelTitle: "潮汐线索",
      secondaryPanelBody: [
        "潮汐记忆是这轮远行的终点，也是任务面板里最明确的收尾标记。",
      ],
    },
  },
}

export function getSceneDefinition(sceneId: SceneId) {
  return sceneDefinitions[sceneId]
}
