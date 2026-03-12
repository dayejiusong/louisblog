export type SectionSlug = "games" | "rides" | "travel" | "books" | "music"

export type BlogEntry = {
  title: string
  meta: string
  note: string
}

export type BlogGroup = {
  id: string
  label: string
  description: string
  entries: BlogEntry[]
}

export type SectionDisplayStat = {
  label: string
  value: string
}

export type SectionDisplay = {
  eyebrow: string
  sceneTitle: string
  sceneSubtitle: string
  sceneTags: string[]
  hudStats: SectionDisplayStat[]
  scenePanels: SectionDisplayStat[]
  navLabel: string
  groupLabel: string
  cardLabel: string
}

export type BlogSection = {
  slug: SectionSlug
  roomLabel: string
  title: string
  subtitle: string
  description: string
  accent: string
  stats: string[]
  groups: BlogGroup[]
  display: SectionDisplay
}

export type RoomTile = {
  x: number
  y: number
}

export type RoomHotspot = {
  id: SectionSlug
  label: string
  hint: string
  accent: string
  drawOrder: number
  footprint: RoomTile[]
  interactionTile: RoomTile
}

export const sectionOrder: SectionSlug[] = ["games", "rides", "travel", "books", "music"]

export const roomHotspots: RoomHotspot[] = [
  {
    id: "travel",
    label: "窗边旅行板",
    hint: "看过的风景会在这里继续发光。",
    accent: "#9bd0ff",
    drawOrder: 1,
    footprint: [{ x: 8, y: 1 }, { x: 9, y: 1 }, { x: 10, y: 1 }],
    interactionTile: { x: 9, y: 2 },
  },
  {
    id: "books",
    label: "满格书架",
    hint: "翻过的书页都堆在这面墙上。",
    accent: "#d2ad6d",
    drawOrder: 2,
    footprint: [{ x: 1, y: 6 }, { x: 1, y: 7 }, { x: 1, y: 8 }],
    interactionTile: { x: 2, y: 7 },
  },
  {
    id: "games",
    label: "桌上电脑",
    hint: "一开机就是存档、地图和漫长的夜。",
    accent: "#67f0ba",
    drawOrder: 3,
    footprint: [{ x: 13, y: 3 }, { x: 14, y: 3 }, { x: 13, y: 4 }, { x: 14, y: 4 }],
    interactionTile: { x: 12, y: 4 },
  },
  {
    id: "rides",
    label: "角落自行车",
    hint: "风大的地方，记忆都会更清楚。",
    accent: "#f7c56f",
    drawOrder: 4,
    footprint: [{ x: 3, y: 12 }, { x: 4, y: 12 }],
    interactionTile: { x: 5, y: 11 },
  },
  {
    id: "music",
    label: "唱片机",
    hint: "很多夜晚都是从第一首歌开始变慢的。",
    accent: "#ff8fb1",
    drawOrder: 5,
    footprint: [{ x: 15, y: 12 }, { x: 15, y: 13 }],
    interactionTile: { x: 14, y: 12 },
  },
]

const sectionDisplays: Record<SectionSlug, SectionDisplay> = {
  games: {
    eyebrow: "Gaming Terminal",
    sceneTitle: "Load into the save room",
    sceneSubtitle: "Boss rush notes, co-op nights, and backlog obsessions all live in this glowing corner.",
    sceneTags: ["Boss logs", "Late-night queues", "Replay routes"],
    hudStats: [
      { label: "Mode", value: "Boss Rush" },
      { label: "Loadout", value: "PC / Console / Mobile" },
    ],
    scenePanels: [
      { label: "Primary Rig", value: "CRT glow + fast restarts" },
      { label: "Party Slot", value: "Story games and co-op runs" },
      { label: "Save Habit", value: "Always one more round" },
    ],
    navLabel: "Select save file",
    groupLabel: "Quest lines",
    cardLabel: "save slot",
  },
  rides: {
    eyebrow: "Ride Tracker",
    sceneTitle: "Open the route computer",
    sceneSubtitle: "City loops, long-distance efforts, and wind-heavy memories are mapped like unlocked stages.",
    sceneTags: ["City loops", "Suburb exits", "Long haul runs"],
    hudStats: [
      { label: "Cadence", value: "Steady / Endurance" },
      { label: "Terrain", value: "City + coast + rolling hills" },
    ],
    scenePanels: [
      { label: "Start Point", value: "Morning bridge and riverside" },
      { label: "Best Condition", value: "Crosswind with clear sky" },
      { label: "Finish State", value: "Legs empty, head clear" },
    ],
    navLabel: "Select route",
    groupLabel: "Ride sets",
    cardLabel: "route log",
  },
  travel: {
    eyebrow: "World Map Console",
    sceneTitle: "Scan the map wall",
    sceneSubtitle: "Cities, coastlines, stations, and weather memories appear like discovered zones on a campaign screen.",
    sceneTags: ["City maps", "Nature routes", "Return visits"],
    hudStats: [
      { label: "Range", value: "Domestic + overseas" },
      { label: "Focus", value: "Streets / light / weather" },
    ],
    scenePanels: [
      { label: "Current View", value: "Stations and side streets" },
      { label: "Return Rate", value: "Sea edges and old towns" },
      { label: "Travel Style", value: "Walk slow, notice more" },
    ],
    navLabel: "Select destination",
    groupLabel: "Map sectors",
    cardLabel: "map pin",
  },
  books: {
    eyebrow: "Archive Shelf",
    sceneTitle: "Browse the reading vault",
    sceneSubtitle: "Novels, history, nonfiction, and tech books sit here like categorized relics with recurring pull.",
    sceneTags: ["Fiction", "History", "Nonfiction", "Tech shelf"],
    hudStats: [
      { label: "Shelf State", value: "Re-read heavy" },
      { label: "Index", value: "Literature / history / product" },
    ],
    scenePanels: [
      { label: "Most Used", value: "Bookmarks and margin memory" },
      { label: "Search Mode", value: "Mood + structure + insight" },
      { label: "Return Trigger", value: "Different life stages" },
    ],
    navLabel: "Select shelf",
    groupLabel: "Shelf rows",
    cardLabel: "archive note",
  },
  music: {
    eyebrow: "Audio Deck",
    sceneTitle: "Drop the needle",
    sceneSubtitle: "Commute lists, late-night loops, soundtracks, and Mandarin favorites play like unlockable audio channels.",
    sceneTags: ["Late-night glow", "Commute pace", "Soundtrack mode"],
    hudStats: [
      { label: "Channel", value: "Loop / commute / soundtrack" },
      { label: "Peak Window", value: "Night sessions" },
    ],
    scenePanels: [
      { label: "Main Device", value: "Desk speakers and headphones" },
      { label: "Mood Shift", value: "From city rush to low light" },
      { label: "Replay Rule", value: "One song becomes a scene" },
    ],
    navLabel: "Select channel",
    groupLabel: "Listening stacks",
    cardLabel: "track memo",
  },
}

const baseBlogSections = {
  games: {
    slug: "games",
    roomLabel: "桌上电脑",
    title: "游戏存档室",
    subtitle: "从深夜清图标，到清晨还在补最后一把。",
    description: "这里收着我最常回访的游戏：有故事驱动的单机、能和朋友消磨整晚的联机，也有适合碎片时间的小屏快乐。",
    accent: "#67f0ba",
    stats: ["PC / 主机 / 手机", "长期存档 35+", "重复通关 10 款"],
    groups: [
      {
        id: "pc",
        label: "PC 夜游区",
        description: "会在键盘灯和屏幕冷光里反复打开的游戏。",
        entries: [
          { title: "Baldur's Gate 3", meta: "CRPG / Larian", note: "营地对话和支线选择比主线还更容易让人上头。" },
          { title: "Cyberpunk 2077", meta: "开放世界 / CDPR", note: "会为了夜之城的灯光和电台故意绕远路。" },
          { title: "Disco Elysium", meta: "叙事 RPG / ZAUM", note: "每次重开都像在选择另一种失控方式。" },
          { title: "Hades", meta: "Roguelike / Supergiant", note: "输掉也不会生气，因为每一轮都能推进新的对白。" },
        ],
      },
      {
        id: "console",
        label: "主机陈列柜",
        description: "更适合窝在沙发里慢慢玩的那些作品。",
        entries: [
          { title: "The Legend of Zelda: Tears of the Kingdom", meta: "Switch", note: "会为了一个奇怪机关方案花掉整整一晚。" },
          { title: "God of War Ragnarok", meta: "PS5", note: "打击反馈很硬，但真正记住的是情感关系推进。" },
          { title: "Persona 5 Royal", meta: "PS / Switch", note: "音乐一响起就自动进入行动模式。" },
          { title: "Monster Hunter Rise", meta: "Switch / PC", note: "熟悉武器之后，狩猎节奏像一段舞蹈。" },
        ],
      },
      {
        id: "handheld",
        label: "掌机和手机口袋栏",
        description: "适合出门、排队或者睡前躺着打几把。",
        entries: [
          { title: "Honkai: Star Rail", meta: "Mobile / PC", note: "角色演出和地图气氛总会让我想多逛一圈。" },
          { title: "Arknights", meta: "Mobile", note: "找到布阵思路的一瞬间特别像点亮一张网。" },
          { title: "Marvel Snap", meta: "Mobile", note: "一局很短，但变化很多，特别适合碎片时间。" },
          { title: "Pokemon Emerald", meta: "掌机回忆", note: "小时候最像真正冒险的一段地图记忆。" },
        ],
      },
    ],
  },
  rides: {
    slug: "rides",
    roomLabel: "角落自行车",
    title: "骑行轨迹册",
    subtitle: "每一段坡道和侧风，都把城市变得更立体。",
    description: "我很喜欢用骑行认识地方。速度不快，刚好能闻到街边早餐、河边潮气、树荫下的泥土味，也能在长距离里整理脑子里的噪音。",
    accent: "#f7c56f",
    stats: ["城市通勤 / 近郊 / 长距离", "踩过的路线 30+", "最远单日 118km"],
    groups: [
      {
        id: "city",
        label: "城市熟路",
        description: "那些已经骑到形成肌肉记忆的路线。",
        entries: [
          { title: "上海徐汇滨江", meta: "清晨通勤", note: "太阳出来以后，整条路会被江面和玻璃幕墙一起点亮。" },
          { title: "苏州金鸡湖环线", meta: "傍晚巡航", note: "灯亮起来以后，水面和风都会变得很安静。" },
          { title: "杭州钱塘江南岸", meta: "顺风快乐段", note: "风向对的时候像被轻轻推着走。" },
          { title: "成都锦城湖到交子大道", meta: "夜骑", note: "天一黑就很像未来都市地图。" },
        ],
      },
      {
        id: "suburb",
        label: "近郊出逃",
        description: "离开城区半小时后，世界会突然松一点。",
        entries: [
          { title: "青浦淀山湖", meta: "湖线拉练", note: "开阔、风大、节奏稳定，适合边骑边聊很长的话题。" },
          { title: "崇明东滩段", meta: "环岛", note: "遇到好天气时，会觉得路能一直往前延伸。" },
          { title: "无锡太湖十八湾", meta: "连续起伏路", note: "每个小坡都让你重新记住自己的呼吸节奏。" },
          { title: "厦门环岛路", meta: "海风骑", note: "会因为海浪和沙滩不自觉慢下来。" },
        ],
      },
      {
        id: "long",
        label: "长距离纪念",
        description: "骑完以后会想认真记一笔的那些日子。",
        entries: [
          { title: "杭州西湖 - 富阳往返", meta: "96km", note: "前半程像出游，后半程全靠节奏和补给维持完整动作。" },
          { title: "上海市区 - 滴水湖", meta: "118km", note: "越往东越空旷，终点时会有一种被风掏空的平静。" },
          { title: "苏州古城 - 太湖营地", meta: "82km", note: "一路从人声密集骑到只剩虫鸣和水声。" },
          { title: "昆明滇池西岸", meta: "高原节奏", note: "海拔会把你熟悉的配速全部打乱。" },
        ],
      },
    ],
  },
  travel: {
    slug: "travel",
    roomLabel: "窗边旅行板",
    title: "旅行地图墙",
    subtitle: "城市是我收集节奏、声音和天气的方式。",
    description: "我喜欢记录去过的地方，不是打卡意义上的到此一游，而是记住某个站台、某条街、某个清晨的光线。这里会比别处更满，因为我总忍不住继续往外走。",
    accent: "#9bd0ff",
    stats: ["国内 / 海外", "地图针 40+", "最常重访 海边与老城"],
    groups: [
      {
        id: "domestic-city",
        label: "国内城市",
        description: "会因为街道节奏和生活感想反复重访。",
        entries: [
          { title: "上海", meta: "常驻与再发现", note: "越熟悉越难写清，但每次沿着梧桐区和滨江走都还能看见新细节。" },
          { title: "杭州", meta: "湖与潮湿空气", note: "雨后的街巷特别适合散步，也适合什么都不做。" },
          { title: "苏州", meta: "园林与老城", note: "白墙、水巷、石板路会自动把人带慢。" },
          { title: "重庆", meta: "立体城市", note: "电梯、坡道、轻轨和江景叠在一起，像在现实里穿地图。" },
          { title: "青岛", meta: "上坡下海", note: "老城区的色彩和海风都很直接。" },
        ],
      },
      {
        id: "domestic-nature",
        label: "国内风景",
        description: "风景记忆通常更依赖当天的天气。",
        entries: [
          { title: "黄山", meta: "云海与台阶", note: "真正记住的不是机位，而是山路上不断变化的湿度和能见度。" },
          { title: "千岛湖", meta: "岛屿密度", note: "站在高处看水面时，会觉得地图像被打碎成大片拼图。" },
          { title: "洱海", meta: "风和蓝色", note: "光线会让蓝色显得特别轻。" },
          { title: "阿那亚", meta: "海边建筑", note: "建筑和海风叠在一起，很适合看日落。" },
        ],
      },
      {
        id: "overseas-city",
        label: "海外城市",
        description: "更容易记住车站、便利店和深夜街角。",
        entries: [
          { title: "Tokyo", meta: "霓虹与秩序", note: "从电车节奏到便利店补给都很精确，但深夜小巷又意外松弛。" },
          { title: "Kyoto", meta: "寺院与慢步", note: "清晨出门很重要，人少的时候整座城像在低声讲话。" },
          { title: "Seoul", meta: "上坡与咖啡馆", note: "年轻气和夜生活的密度都很高。" },
          { title: "Hong Kong", meta: "密度与海港", note: "高楼和坡道之间挤满了生活细节。" },
        ],
      },
      {
        id: "overseas-landscape",
        label: "海外风景",
        description: "有些地方会让时间变得很慢。",
        entries: [
          { title: "Lake Kawaguchi", meta: "富士山前景", note: "天气好时画面过于标准，反而会让人安静下来认真看很久。" },
          { title: "Nara", meta: "鹿与草地", note: "走远一点，风声和树影会把空间重新拉开。" },
          { title: "Jeju", meta: "海岸公路", note: "火山石、海浪和风一起出现时，路线会很适合慢慢开。" },
          { title: "Hokkaido Otaru", meta: "冬天版本", note: "雪和港口灯光叠在一起，特别像电影场景。" },
        ],
      },
    ],
  },
  books: {
    slug: "books",
    roomLabel: "满格书架",
    title: "书页仓库",
    subtitle: "有些书帮我理解世界，有些书只是把夜晚变安静。",
    description: "我读书比较杂，会在小说里找情绪，也会在历史、产品、心理学和技术书里找结构。很多书不是读一次就结束，而是会在不同阶段被重新拿出来。",
    accent: "#d2ad6d",
    stats: ["文学 / 历史 / 非虚构 / 技术", "常翻书签 50+", "重读指数很高"],
    groups: [
      {
        id: "fiction",
        label: "小说与故事",
        description: "我最常反复推荐给朋友的一层书架。",
        entries: [
          { title: "百年孤独", meta: "加西亚·马尔克斯", note: "第一次读像被大风卷着走，回味时才发现它的密度有多夸张。" },
          { title: "挪威的森林", meta: "村上春树", note: "青春感和失重感都写得很轻，却会在很久以后突然回响。" },
          { title: "悉达多", meta: "赫尔曼·黑塞", note: "字面上很安静，但适合在脑子有点乱的时候重读。" },
          { title: "三体", meta: "刘慈欣", note: "宏大设定很震撼，但更难忘的是人如何面对未知。" },
        ],
      },
      {
        id: "history",
        label: "历史与人物",
        description: "理解时代怎么形成，也理解人如何被时代推着走。",
        entries: [
          { title: "人类群星闪耀时", meta: "茨威格", note: "很会把历史时刻压缩成强烈的人性剖面。" },
          { title: "枪炮、病菌与钢铁", meta: "贾雷德·戴蒙德", note: "会迫使你从更大尺度去看很多问题。" },
          { title: "万历十五年", meta: "黄仁宇", note: "很薄，却能把制度和个体之间的无力感写得很清楚。" },
          { title: "置身事内", meta: "兰小欢", note: "读完会更理解很多城市化和财政结构背后的动因。" },
        ],
      },
      {
        id: "nonfiction",
        label: "非虚构与思考",
        description: "帮助我拆解工作、关系和日常选择。",
        entries: [
          { title: "思考，快与慢", meta: "丹尼尔·卡尼曼", note: "会不断提醒自己，大脑里那个自信判断往往没那么可靠。" },
          { title: "纳瓦尔宝典", meta: "Eric Jorgenson", note: "把很多观念压缩得很利落，适合反复翻。" },
          { title: "金字塔原理", meta: "Barbara Minto", note: "写作和表达卡壳时，通常都能从这里找到结构。" },
          { title: "深度工作", meta: "Cal Newport", note: "在被碎片消息切碎的时候总会想起它。" },
        ],
      },
      {
        id: "tech",
        label: "产品与技术",
        description: "偏实践，也偏框架感。",
        entries: [
          { title: "浪潮之巅", meta: "吴军", note: "让我意识到技术公司真正难的是穿越周期。" },
          { title: "启示录", meta: "Marty Cagan", note: "产品不是收需求表，而是持续判断什么值得做。" },
          { title: "代码整洁之道", meta: "Robert C. Martin", note: "代码可维护性其实是对未来合作者的礼貌。" },
          { title: "设计中的设计", meta: "原研哉", note: "虽然不是技术书，但对界面和留白很有启发。" },
        ],
      },
    ],
  },
  music: {
    slug: "music",
    roomLabel: "唱片机",
    title: "听觉收藏柜",
    subtitle: "有些歌是背景，有些歌会把整个场景重新点亮。",
    description: "我听歌很看场景。通勤有通勤的节奏，夜里写东西有夜里的低光，骑车、坐车、发呆、旅行也各自对应不同的播放列表。",
    accent: "#ff8fb1",
    stats: ["流行 / 摇滚 / 电子 / 原声", "循环歌单 25+", "夜间播放占比最高"],
    groups: [
      {
        id: "late-night",
        label: "深夜低光",
        description: "适合把世界调暗一点再听。",
        entries: [
          { title: "Nujabes", meta: "Jazz Hip-Hop", note: "总能把夜晚整理得更平静，像给思绪铺了一层柔和底噪。" },
          { title: "Cigarettes After Sex", meta: "Dream Pop", note: "听感像雾，特别适合城市灯光已经变稀的时段。" },
          { title: "李志", meta: "民谣 / 摇滚", note: "现场版本比录音室更扎人，适合长夜之后慢慢回神。" },
          { title: "坂本龙一", meta: "氛围 / 钢琴", note: "安静但不空洞，像给房间留出更深一点的呼吸。" },
        ],
      },
      {
        id: "commute",
        label: "通勤与移动",
        description: "适合在路上把步伐和思绪拉整齐。",
        entries: [
          { title: "Daft Punk", meta: "French House", note: "节拍非常适合走路和骑车，会自动把速度提起来。" },
          { title: "The Weeknd", meta: "Synth Pop / R&B", note: "夜晚城市感很强，地铁窗外的倒影会被它放大。" },
          { title: "M83", meta: "Electronic", note: "适合快速移动时听，像给现实叠了一层电影滤镜。" },
          { title: "椎名林檎", meta: "J-Pop", note: "节奏和气质都很鲜明，通勤路上听会有种锋利感。" },
        ],
      },
      {
        id: "soundtrack",
        label: "游戏与电影原声",
        description: "能直接把我带回某段地图或某个镜头。",
        entries: [
          { title: "Persona 5 OST", meta: "Game Soundtrack", note: "时髦、流畅、上头，一响起就自动切进行动模式。" },
          { title: "NieR: Automata OST", meta: "Game Soundtrack", note: "空旷、悲伤又很漂亮，适合独处时慢慢听完整张。" },
          { title: "Interstellar OST", meta: "Film Score", note: "空间感和推进感特别强，很适合专注时循环。" },
          { title: "久石让精选", meta: "Animation Score", note: "是那种会让整个房间一起变亮一点的音乐。" },
        ],
      },
      {
        id: "mandarin",
        label: "华语常驻",
        description: "会不定期回来的熟悉声音。",
        entries: [
          { title: "陈奕迅", meta: "华语流行", note: "很多歌到了不同年龄段会听出完全不同的意思。" },
          { title: "万能青年旅店", meta: "独立摇滚", note: "文字密度和编曲层次都很高，适合认真听。" },
          { title: "草东没有派对", meta: "独立摇滚", note: "锋利、失重、很有青年阶段那种不稳定情绪。" },
          { title: "王菲", meta: "华语流行", note: "声音本身就像一种空间，适合安静的时候把音量开大一点。" },
        ],
      },
    ],
  },
} satisfies Record<SectionSlug, Omit<BlogSection, "display">>

export const blogSections: Record<SectionSlug, BlogSection> = sectionOrder.reduce(
  (sections, slug) => {
    sections[slug] = {
      ...baseBlogSections[slug],
      display: sectionDisplays[slug],
    }
    return sections
  },
  {} as Record<SectionSlug, BlogSection>
)

export const sectionList = sectionOrder.map((slug) => blogSections[slug])

export function getSectionBySlug(slug: string) {
  return blogSections[slug as SectionSlug] ?? null
}
