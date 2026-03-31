extends Node
class_name RaceData

@export var _name : String				= "Unknown"
@export var _faces : PackedStringArray			= []
@export var _bodies : PackedStringArray			= []
@export var _skins : Dictionary[int, FileData]	= {}

func _init():
	_faces.resize(ActorCommons.Gender.COUNT)
	_bodies.resize(ActorCommons.Gender.COUNT)

static func Create(key : String, result : Dictionary) -> RaceData:
	var data : RaceData = RaceData.new()
	data._name = key
	if "Bodies" in result and result.Bodies is Dictionary:
		for gender in ActorCommons.Gender.COUNT:
			match gender:
				ActorCommons.Gender.MALE:
					data._bodies[gender] = result.Bodies.get(ActorCommons.genderMale, "")
				ActorCommons.Gender.FEMALE:
					data._bodies[gender] = result.Bodies.get(ActorCommons.genderFemale, "")
				_:
					data._bodies[gender] = result.Bodies.get(ActorCommons.genderNonBinary, "")
	if "Faces" in result and result.Faces is Dictionary:
		for gender in ActorCommons.Gender.COUNT:
			match gender:
				ActorCommons.Gender.MALE:
					data._faces[gender] = result.Faces.get(ActorCommons.genderMale, "")
				ActorCommons.Gender.FEMALE:
					data._faces[gender] = result.Faces.get(ActorCommons.genderFemale, "")
				_:
					data._faces[gender] = result.Faces.get(ActorCommons.genderNonBinary, "")
	if "Skins" in result and result.Skins is Dictionary:
		for skin in result.Skins.keys():
			var skinId : int = DB.GetCellHash(skin) if DB.HasCellHash(skin) else DB.SetCellHash(skin)
			var paletteId : int = DB.GetCellHash(result.Skins[skin])
			data._skins[skinId] = DB.GetPalette(DB.Palette.SKIN, paletteId)

	return data
