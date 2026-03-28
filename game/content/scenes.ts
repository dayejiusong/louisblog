import { blogSections, roomHotspots } from "../../lib/blog-content.ts"
import { buildOutpostGrid } from "../../lib/outpost-grid.ts"
import { buildRoomGrid } from "../../lib/room-grid.ts"
import type { SceneDefinition, SceneExit, SceneHotspot, SceneId, WorldDestination } from "../types.ts"

const roomGrid = buildRoomGrid(roomHotspots)
const outpostGrid = buildOutpostGrid()

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

const worldDestinations: WorldDestination[] = [
  {
    id: "room-home",
    label: "出生点房间",
    description: "回到房间整理日志、音乐和旅行档案。",
    available: true,
    targetSceneId: "room",
  },
  {
    id: "ridge-trail",
    label: "山脊小道",
    description: "下一张可进入地图的预留出口。",
    available: false,
  },
  {
    id: "forest-edge",
    label: "森林边界",
    description: "未来会接剧情热点和更大的野外区域。",
    available: false,
  },
]

const outpostHotspots: SceneHotspot[] = [
  {
    id: "world-map",
    label: "营地路牌",
    hint: "在这里查看下一步能去哪里，未开放的区域也先挂在地图上。",
    accent: "#8ed7ff",
    drawOrder: 7.1,
    footprint: [],
    interactionTile: { x: 8, y: 8 },
    kind: "world-map",
    anchorTile: { x: 7.2, y: 7.6 },
    hitbox: { offsetX: -36, offsetY: -52, width: 82, height: 70, snapDistance: 40 },
    renderKind: "signpost",
    worldDestinations,
  },
]

const roomExit: SceneExit = {
  id: "room-outpost",
  label: "裂缝出口",
  hint: "靠近裂缝后就会带着狗离开出生点，走向营地前哨。",
  accent: "#8ed7ff",
  anchorTile: { x: 17.2, y: 3.1 },
  interactionTile: { x: 17, y: 3 },
  hitbox: { offsetX: -36, offsetY: -86, width: 80, height: 98, snapDistance: 48 },
  targetSceneId: "outpost",
  renderKind: "exit-crack",
}

const outpostExit: SceneExit = {
  id: "outpost-room",
  label: "回家裂缝",
  hint: "回到出生点房间，日志入口和整理后的状态都会保留。",
  accent: "#8ed7ff",
  anchorTile: { x: 2.3, y: 3.4 },
  interactionTile: { x: 2, y: 4 },
  hitbox: { offsetX: -48, offsetY: -82, width: 88, height: 98, snapDistance: 40 },
  targetSceneId: "room",
  renderKind: "return-crack",
}

export const sceneDefinitions: Record<SceneId, SceneDefinition> = {
  room: {
    id: "room",
    grid: roomGrid,
    spawn: {
      player: { x: 10, y: 10, facing: "N" },
      dog: { x: 7, y: 8, facing: "E" },
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
      title: "房间交互",
      description: "Phaser 运行时接管了房间和前哨，但日志弹窗仍然保留在 DOM 里。",
      primaryPanelTitle: "操作方式",
      primaryPanelBody: [
        "点击地板会沿网格移动，点击物件会先走近再打开对应栏目。",
        "点击裂缝会切到营地前哨，当前房间和前哨的位置都会分别记住。",
        "现在的世界层已经迁到 Phaser，后续新增场景不需要再写一套页面组件。",
      ],
      secondaryPanelTitle: "快捷入口",
      secondaryPanelBody: [
        "下方按钮会直接打开对应栏目，移动端和键盘用户都可以走同一套内容入口。",
      ],
    },
  },
  outpost: {
    id: "outpost",
    grid: outpostGrid,
    spawn: {
      player: { x: 6, y: 11, facing: "E" },
      dog: { x: 8, y: 12, facing: "E" },
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
      title: "营地前哨",
      description: "前哨现在已经变成可扩世界的 hub，路牌会打开世界导航而不是继续写死在页面逻辑里。",
      primaryPanelTitle: "营地规则",
      primaryPanelBody: [
        "点击地面继续探索，点击回家裂缝会返回出生点房间。",
        "点击路牌会打开世界导航面板，未开放区域会以锁定项先挂出来。",
        "Phaser 这一层只负责世界和输入，文本密度高的界面仍走 DOM 叠层。",
      ],
      secondaryPanelTitle: "前哨情报",
      secondaryPanelBody: [
        "这里是后续扩地图的入口场景，当前保留房间返回和世界导航两个稳定出口。",
      ],
    },
  },
}

export function getSceneDefinition(sceneId: SceneId) {
  return sceneDefinitions[sceneId]
}
