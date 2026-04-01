extends RefCounted
class_name LauncherCommons

# Project
const ProjectName : String				= "Source of Mana"
const SocialLink : String				= "https://discord.com/channels/581622549566193664/1013487216493854780"
const WebSinglePlayerAccountName : String	= "web_player"
const WebSinglePlayerPassword : String		= "offline123"
const WebSinglePlayerCharacterName : String	= "Adventurer"

# Map
const DefaultStartMapName : String		= "Tulimshar West Chamber"
static var DefaultStartMapID : int		= DefaultStartMapName.hash()
const DefaultStartPos : Vector2			= Vector2(1376, 1408)
const LegacyStartMapName : String		= "Tulimshar"
static var LegacyStartMapID : int		= LegacyStartMapName.hash()
const LegacyStartPos : Vector2			= Vector2(1824, 2208)

# MapPool
const EnableMapPool : bool				= false
const MapPoolMaxSize : int				= 10

const ServerMaxFPS : int				= 30

# Common accessors
const IsTesting : bool					= true
static var isMobile : bool				= OS.has_feature("android") or OS.has_feature("ios") or Util.IsMobile()
static var isWeb : bool					= OS.has_feature("web")

static func GetDefaultStartCharacterData() -> Dictionary:
	return {
		"pos_x": DefaultStartPos.x,
		"pos_y": DefaultStartPos.y,
		"pos_map": DefaultStartMapID,
		"respawn_x": DefaultStartPos.x,
		"respawn_y": DefaultStartPos.y,
		"respawn_map": DefaultStartMapID
	}

static func ApplyDefaultStartCharacterData(charData : Dictionary) -> void:
	charData.merge(GetDefaultStartCharacterData(), true)

static func _MatchesStartLocation(charData : Dictionary, mapIDKey : String, posXKey : String, posYKey : String, expectedMapID : int, expectedPos : Vector2) -> bool:
	return int(charData.get(mapIDKey, 0)) == expectedMapID and is_equal_approx(float(charData.get(posXKey, 0.0)), expectedPos.x) and is_equal_approx(float(charData.get(posYKey, 0.0)), expectedPos.y)

static func ShouldMigrateLegacySinglePlayerStart(charData : Dictionary) -> bool:
	return _MatchesStartLocation(charData, "pos_map", "pos_x", "pos_y", LegacyStartMapID, LegacyStartPos) and \
		_MatchesStartLocation(charData, "respawn_map", "respawn_x", "respawn_y", LegacyStartMapID, LegacyStartPos)

static func IsWebSinglePlayer() -> bool:
	return isWeb
