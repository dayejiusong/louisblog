extends ServiceBase
class_name WebSQL

const SavePath : String = Path.Local + "web_singleplayer.save"

var db = null
var store : Dictionary = {}

func _default_store() -> Dictionary:
	return {
		"next_account_id": 1,
		"next_char_id": 1,
		"accounts": {},
		"account_names": {},
		"characters": {},
		"character_names": {},
		"account_characters": {},
		"attributes": {},
		"traits": {},
		"stats": {},
		"items": {},
		"equipment": {},
		"skills": {},
		"quests": {},
		"bestiaries": {},
		"bans": {},
		"auth_tokens": {}
	}

func _ensure_store() -> void:
	if store.is_empty():
		store = _default_store()

	for key in _default_store().keys():
		if not store.has(key):
			store[key] = _default_store()[key]

func _persist() -> void:
	_ensure_store()
	var file : FileAccess = FileAccess.open(SavePath, FileAccess.WRITE)
	if file:
		file.store_string(var_to_str(store))
		file.close()

func _load_store() -> void:
	store = _default_store()
	if not FileAccess.file_exists(SavePath):
		_persist()
		return

	var content : String = FileAccess.get_file_as_string(SavePath)
	if content.is_empty():
		return

	var parsed : Variant = str_to_var(content)
	if parsed is Dictionary:
		store = parsed
		_ensure_store()

func _next_account_id() -> int:
	var next_id : int = int(store["next_account_id"])
	store["next_account_id"] = next_id + 1
	return next_id

func _next_char_id() -> int:
	var next_id : int = int(store["next_char_id"])
	store["next_char_id"] = next_id + 1
	return next_id

func _default_equipment() -> Dictionary:
	var data : Dictionary = {}
	for equipmentID in ActorCommons.SlotEquipmentCount:
		var equipmentKey : String = ActorCommons.GetSlotName(equipmentID).to_lower()
		data[equipmentKey] = DB.UnknownHash
		data[equipmentKey + "Custom"] = ""
	return data

func _default_character_row(accountID : int, nickname : String, charID : int) -> Dictionary:
	var now : int = SQLCommons.Timestamp()
	var row : Dictionary = {
		"char_id": charID,
		"account_id": accountID,
		"nickname": nickname,
		"created_timestamp": now,
		"last_timestamp": now,
		"total_time": 0,
		"explore_x": 0,
		"explore_y": 0,
		"explore_map": DB.UnknownHash
	}
	row.merge(LauncherCommons.GetDefaultStartCharacterData(), true)
	return row

func _get_account_row(accountID : int) -> Dictionary:
	return store["accounts"].get(accountID, {})

func _get_character_row(charID : int) -> Dictionary:
	return store["characters"].get(charID, {})

func _duplicate_array(data : Array) -> Array:
	var cloned : Array = []
	for entry in data:
		cloned.push_back(entry.duplicate(true) if entry is Dictionary else entry)
	return cloned

func AddAccount(username : String, password : String, email : String) -> bool:
	_ensure_store()
	if HasAccount(username):
		return false

	var accountID : int = _next_account_id()
	var salt : String = Hasher.GenerateSalt()
	var hashedPassword : String = Hasher.HashPassword(password, salt)
	store["accounts"][accountID] = {
		"account_id": accountID,
		"username": username,
		"password_salt": salt,
		"password": hashedPassword,
		"email": email,
		"permission": ActorCommons.Permission.NONE,
		"created_timestamp": SQLCommons.Timestamp(),
		"last_timestamp": SQLCommons.Timestamp()
	}
	store["account_names"][username] = accountID
	store["account_characters"][accountID] = []
	_persist()
	return true

func RemoveAccount(accountID : int) -> bool:
	var row : Dictionary = _get_account_row(accountID)
	if row.is_empty():
		return false

	var username : String = row.get("username", "")
	if not username.is_empty():
		store["account_names"].erase(username)
	store["accounts"].erase(accountID)
	store["account_characters"].erase(accountID)
	store["auth_tokens"].erase(accountID)
	store["bans"].erase(accountID)
	_persist()
	return true

func HasAccount(username : String) -> bool:
	_ensure_store()
	return store["account_names"].has(username)

func ValidateAuthPassword(username : String, triedPassword : String) -> Peers.AccountData:
	var accountID : int = GetAccountID(username)
	if accountID == NetworkCommons.PeerUnknownID:
		return null

	var row : Dictionary = _get_account_row(accountID)
	var salt : String = row.get("password_salt", "")
	var correctPassword : String = row.get("password", "")
	if salt.is_empty() or correctPassword.is_empty():
		return null

	if Hasher.HashPassword(triedPassword, salt) == correctPassword:
		return Peers.AccountData.new(accountID, row.get("permission", ActorCommons.Permission.NONE))
	return null

func UpdateAccount(accountID : int) -> bool:
	var row : Dictionary = _get_account_row(accountID)
	if row.is_empty():
		return false

	row["last_timestamp"] = SQLCommons.Timestamp()
	store["accounts"][accountID] = row
	_persist()
	return true

func AddCharacter(accountID : int, nickname : String, stats : Dictionary, traits : Dictionary, attributes : Dictionary) -> bool:
	_ensure_store()
	if _get_account_row(accountID).is_empty() or HasCharacter(nickname):
		return false

	var charID : int = _next_char_id()
	var characterData : Dictionary = _default_character_row(accountID, nickname, charID)
	var statData : Dictionary = stats.duplicate(true)
	var traitData : Dictionary = traits.duplicate(true)
	var attributeData : Dictionary = attributes.duplicate(true)

	statData["char_id"] = charID
	traitData["char_id"] = charID
	attributeData["char_id"] = charID

	store["characters"][charID] = characterData
	store["character_names"][nickname] = charID
	store["account_characters"][accountID].append(charID)
	store["stats"][charID] = statData
	store["traits"][charID] = traitData
	store["attributes"][charID] = attributeData
	store["items"][charID] = []
	store["equipment"][charID] = _default_equipment()
	store["skills"][charID] = {}
	store["quests"][charID] = {}
	store["bestiaries"][charID] = {}
	_persist()
	return true

func RemoveCharacter(charID : int) -> bool:
	var row : Dictionary = _get_character_row(charID)
	if row.is_empty():
		return false

	var accountID : int = row.get("account_id", NetworkCommons.PeerUnknownID)
	var nickname : String = row.get("nickname", "")
	if store["account_characters"].has(accountID):
		store["account_characters"][accountID].erase(charID)
	if not nickname.is_empty():
		store["character_names"].erase(nickname)

	store["characters"].erase(charID)
	store["attributes"].erase(charID)
	store["traits"].erase(charID)
	store["stats"].erase(charID)
	store["items"].erase(charID)
	store["equipment"].erase(charID)
	store["skills"].erase(charID)
	store["quests"].erase(charID)
	store["bestiaries"].erase(charID)
	_persist()
	return true

func GetCharacters(accountID : int) -> PackedInt64Array:
	var result : PackedInt64Array = []
	for charID in store["account_characters"].get(accountID, []):
		result.push_back(charID)
	return result

func GetCharacterInfo(charID : int) -> Dictionary:
	var row : Dictionary = _get_character_row(charID).duplicate(true)
	row.merge(GetStat(charID), true)
	row.merge(GetTrait(charID), true)
	row.merge(GetAttribute(charID), true)
	return row

func RefreshCharacter(player : PlayerAgent) -> bool:
	if player == null:
		return false

	var charID : int = Peers.GetCharacter(player.peerID)
	if charID == NetworkCommons.PeerUnknownID:
		return false

	var success : bool = true
	success = success and UpdateAttribute(charID, player.stat)
	success = success and UpdateTrait(charID, player.stat)
	success = success and UpdateStat(charID, player.stat)
	success = success and UpdateCharacter(player)
	if player.progress:
		player.progress.questMutex.lock()
		for entryID in player.progress.quests:
			success = SetQuest(charID, entryID, player.progress.quests[entryID]) and success
		player.progress.questMutex.unlock()

		player.progress.bestiaryMutex.lock()
		for entryID in player.progress.bestiary:
			success = SetBestiary(charID, entryID, player.progress.bestiary[entryID]) and success
		player.progress.bestiaryMutex.unlock()

		for entryID in player.progress.skills:
			success = SetSkill(charID, entryID, player.progress.skills[entryID]) and success
	return success

func HasCharacter(nickname : String) -> bool:
	return store["character_names"].has(nickname)

func CharacterLogin(charID : int) -> bool:
	var row : Dictionary = _get_character_row(charID)
	if row.is_empty():
		return false

	row["last_timestamp"] = SQLCommons.Timestamp()
	store["characters"][charID] = row
	_persist()
	return true

func GetCharacterID(accountID : int, nickname : String) -> int:
	var charID : int = store["character_names"].get(nickname, NetworkCommons.PeerUnknownID)
	if charID == NetworkCommons.PeerUnknownID:
		return NetworkCommons.PeerUnknownID

	var row : Dictionary = _get_character_row(charID)
	return charID if row.get("account_id", NetworkCommons.PeerUnknownID) == accountID else NetworkCommons.PeerUnknownID

func GetCharacter(charID : int) -> Dictionary:
	return _get_character_row(charID).duplicate(true)

func ResetCharacterStart(charID : int) -> bool:
	var row : Dictionary = _get_character_row(charID)
	if row.is_empty():
		return false

	LauncherCommons.ApplyDefaultStartCharacterData(row)
	store["characters"][charID] = row
	_persist()
	return true

func UpdateCharacter(player : PlayerAgent) -> bool:
	if player == null:
		return false

	var charID : int = Peers.GetCharacter(player.peerID)
	var row : Dictionary = _get_character_row(charID)
	if row.is_empty():
		return false

	var map : WorldMap = WorldAgent.GetMapFromAgent(player)
	var newTimestamp : int = SQLCommons.Timestamp()
	row["total_time"] = SQLCommons.GetOrAddValue(row, "total_time", 0) + newTimestamp - SQLCommons.GetOrAddValue(row, "last_timestamp", newTimestamp)
	row["last_timestamp"] = newTimestamp

	if map != null and not map.HasFlags(WorldMap.Flags.NO_REJOIN) and ActorCommons.IsAlive(player):
		row["pos_x"] = player.position.x
		row["pos_y"] = player.position.y
		row["pos_map"] = map.id
	else:
		row["pos_x"] = player.respawnDestination.pos.x
		row["pos_y"] = player.respawnDestination.pos.y
		row["pos_map"] = player.respawnDestination.mapID

	row["respawn_x"] = player.respawnDestination.pos.x
	row["respawn_y"] = player.respawnDestination.pos.y
	row["respawn_map"] = player.respawnDestination.mapID

	if player.exploreOrigin != null:
		row["explore_x"] = player.exploreOrigin.pos.x
		row["explore_y"] = player.exploreOrigin.pos.y
		row["explore_map"] = player.exploreOrigin.mapID

	store["characters"][charID] = row
	_persist()
	return true

func GetAttribute(charID : int) -> Dictionary:
	return store["attributes"].get(charID, {}).duplicate(true)

func UpdateAttribute(charID : int, stats : ActorStats) -> bool:
	if stats == null:
		return false

	store["attributes"][charID] = {
		"char_id": charID,
		"strength": stats.strength,
		"vitality": stats.vitality,
		"agility": stats.agility,
		"endurance": stats.endurance,
		"concentration": stats.concentration
	}
	_persist()
	return true

func GetTrait(charID : int) -> Dictionary:
	return store["traits"].get(charID, {}).duplicate(true)

func UpdateTrait(charID : int, stats : ActorStats) -> bool:
	if stats == null:
		return false

	store["traits"][charID] = {
		"char_id": charID,
		"hairstyle": stats.hairstyle,
		"haircolor": stats.haircolor,
		"race": stats.race,
		"skintone": stats.skintone,
		"gender": stats.gender,
		"shape": stats.shape,
		"spirit": stats.spirit
	}
	_persist()
	return true

func GetStat(charID : int) -> Dictionary:
	return store["stats"].get(charID, {}).duplicate(true)

func UpdateStat(charID : int, stats : ActorStats) -> bool:
	if stats == null:
		return false

	store["stats"][charID] = {
		"char_id": charID,
		"level": stats.level,
		"experience": stats.experience,
		"gp": stats.gp,
		"health": max(1, stats.health),
		"mana": stats.mana,
		"stamina": stats.stamina,
		"karma": stats.karma
	}
	_persist()
	return true

func _find_item_index(charID : int, itemID : int, customfield : String, storageType : int = 0) -> int:
	var rows : Array = store["items"].get(charID, [])
	for idx in rows.size():
		var row : Dictionary = rows[idx]
		if row.get("item_id", DB.UnknownHash) == itemID and row.get("customfield", "") == customfield and row.get("storage", 0) == storageType:
			return idx
	return -1

func AddItem(charID : int, itemID : int, customfield : String, itemCount : int = 1, storageType : int = 0) -> bool:
	var rows : Array = store["items"].get(charID, [])
	var index : int = _find_item_index(charID, itemID, customfield, storageType)
	if index >= 0:
		rows[index]["count"] = rows[index].get("count", 0) + itemCount
	else:
		rows.push_back({
			"item_id": itemID,
			"char_id": charID,
			"count": itemCount,
			"storage": storageType,
			"customfield": customfield
		})
	store["items"][charID] = rows
	_persist()
	return true

func RemoveItem(charID : int, itemID : int, customfield : String, itemCount : int = 1, storageType : int = 0) -> bool:
	var rows : Array = store["items"].get(charID, [])
	var index : int = _find_item_index(charID, itemID, customfield, storageType)
	if index < 0:
		return false

	rows[index]["count"] = rows[index].get("count", 0) - itemCount
	if rows[index]["count"] <= 0:
		rows.remove_at(index)
	store["items"][charID] = rows
	_persist()
	return true

func GetStorage(charID : int, storageType : int = 0) -> Array[Dictionary]:
	var rows : Array[Dictionary] = []
	for row in store["items"].get(charID, []):
		if row.get("storage", 0) == storageType:
			rows.push_back(row.duplicate(true))
	return rows

func GetEquipment(charID : int) -> Dictionary:
	return store["equipment"].get(charID, _default_equipment()).duplicate(true)

func UpdateEquipment(charID : int, data : Dictionary) -> bool:
	store["equipment"][charID] = data.duplicate(true)
	_persist()
	return true

func SetSkill(charID : int, skillID : int, value : int) -> bool:
	var data : Dictionary = store["skills"].get(charID, {})
	data[skillID] = value
	store["skills"][charID] = data
	_persist()
	return true

func GetSkills(charID : int) -> Array[Dictionary]:
	var rows : Array[Dictionary] = []
	for skillID in store["skills"].get(charID, {}):
		rows.push_back({
			"char_id": charID,
			"skill_id": skillID,
			"level": store["skills"][charID][skillID]
		})
	return rows

func SetBestiary(charID : int, mobID : int, value : int) -> bool:
	var data : Dictionary = store["bestiaries"].get(charID, {})
	data[mobID] = value
	store["bestiaries"][charID] = data
	_persist()
	return true

func GetBestiaries(charID : int) -> Array[Dictionary]:
	var rows : Array[Dictionary] = []
	for mobID in store["bestiaries"].get(charID, {}):
		rows.push_back({
			"char_id": charID,
			"mob_id": mobID,
			"killed_count": store["bestiaries"][charID][mobID]
		})
	return rows

func SetQuest(charID : int, questID : int, value : int) -> bool:
	var data : Dictionary = store["quests"].get(charID, {})
	data[questID] = value
	store["quests"][charID] = data
	_persist()
	return true

func GetQuests(charID : int) -> Array[Dictionary]:
	var rows : Array[Dictionary] = []
	for questID in store["quests"].get(charID, {}):
		rows.push_back({
			"char_id": charID,
			"quest_id": questID,
			"state": store["quests"][charID][questID]
		})
	return rows

func AddAuthToken(accountID : int, tokenHash : String, ipAddress : String) -> bool:
	var tokens : Dictionary = store["auth_tokens"].get(accountID, {})
	for existingToken in tokens.keys():
		if tokens[existingToken].get("ip_address", "") == ipAddress:
			tokens.erase(existingToken)
	tokens[tokenHash] = {
		"ip_address": ipAddress,
		"created_timestamp": SQLCommons.Timestamp(),
		"expires_timestamp": SQLCommons.Timestamp() + NetworkCommons.TokenExpirySec
	}
	store["auth_tokens"][accountID] = tokens
	_persist()
	return true

func ValidateAuthToken(accountID : int, tokenHash : String, ipAddress : String) -> Peers.AccountData:
	var tokens : Dictionary = store["auth_tokens"].get(accountID, {})
	var tokenData : Dictionary = tokens.get(tokenHash, {})
	if tokenData.is_empty():
		return null
	if tokenData.get("ip_address", "") != ipAddress or tokenData.get("expires_timestamp", 0) <= SQLCommons.Timestamp():
		tokens.erase(tokenHash)
		store["auth_tokens"][accountID] = tokens
		_persist()
		return null

	var account : Dictionary = _get_account_row(accountID)
	return Peers.AccountData.new(accountID, account.get("permission", ActorCommons.Permission.NONE))

func RefreshAuthToken(accountID : int, ipAddress : String) -> bool:
	var tokens : Dictionary = store["auth_tokens"].get(accountID, {})
	for tokenHash in tokens.keys():
		if tokens[tokenHash].get("ip_address", "") == ipAddress:
			tokens[tokenHash]["expires_timestamp"] = SQLCommons.Timestamp() + NetworkCommons.TokenExpirySec
	store["auth_tokens"][accountID] = tokens
	_persist()
	return true

func RemoveAllAuthTokens(accountID : int) -> bool:
	store["auth_tokens"].erase(accountID)
	_persist()
	return true

func GetAccountEmail(accountID : int) -> String:
	return _get_account_row(accountID).get("email", "")

func CheckAccountPassword(accountID : int, triedPassword : String) -> bool:
	var row : Dictionary = _get_account_row(accountID)
	if row.is_empty():
		return false
	return Hasher.HashPassword(triedPassword, row.get("password_salt", "")) == row.get("password", "")

func UpdateAccountPassword(accountID : int, newPassword : String) -> bool:
	var row : Dictionary = _get_account_row(accountID)
	if row.is_empty():
		return false

	var salt : String = Hasher.GenerateSalt()
	row["password_salt"] = salt
	row["password"] = Hasher.HashPassword(newPassword, salt)
	store["accounts"][accountID] = row
	_persist()
	return true

func BanAccount(accountID : int, unbanTimestamp : int, reason : String = "") -> bool:
	store["bans"][accountID] = {
		"account_id": accountID,
		"banned_timestamp": SQLCommons.Timestamp(),
		"unban_timestamp": unbanTimestamp,
		"reason": reason
	}
	Peers.bannedAccounts[accountID] = unbanTimestamp
	_persist()
	return true

func UnbanAccount(accountID : int) -> bool:
	store["bans"].erase(accountID)
	Peers.bannedAccounts.erase(accountID)
	_persist()
	return true

func LoadBans() -> Dictionary[int, int]:
	var result : Dictionary[int, int] = {}
	var now : int = SQLCommons.Timestamp()
	for accountID in store["bans"]:
		var unbanTimestamp : int = store["bans"][accountID].get("unban_timestamp", 0)
		if unbanTimestamp > now:
			result[accountID] = unbanTimestamp
	return result

func GetAccountID(username : String) -> int:
	return store["account_names"].get(username, NetworkCommons.PeerUnknownID)

func SetPermission(accountID : int, permission : int) -> bool:
	var row : Dictionary = _get_account_row(accountID)
	if row.is_empty():
		return false

	row["permission"] = permission
	store["accounts"][accountID] = row
	_persist()
	return true

func GetBanList(filter : String = "") -> Array[Dictionary]:
	var result : Array[Dictionary] = []
	var now : int = SQLCommons.Timestamp()
	for accountID in store["bans"]:
		var banData : Dictionary = store["bans"][accountID]
		if banData.get("unban_timestamp", 0) <= now:
			continue

		var account : Dictionary = _get_account_row(accountID)
		var username : String = account.get("username", "")
		if not filter.is_empty() and not username.containsn(filter):
			continue

		result.push_back({
			"account_id": accountID,
			"username": username,
			"unban_timestamp": banData.get("unban_timestamp", 0),
			"reason": banData.get("reason", "")
		})
	return result

func _post_launch():
	_load_store()
	Peers.bannedAccounts = LoadBans()
	isInitialized = true

func Destroy():
	_persist()

func Wipe():
	store = _default_store()
	_persist()
