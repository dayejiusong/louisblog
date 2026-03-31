extends RefCounted
class_name CellCommons

enum Type
{
	ITEM = 0,
	EMOTE,
	SKILL,
	COUNT
}



static func CompareCell(cell : BaseCell, id : int, customfield : String) -> bool:
	return cell and \
	cell.id == id and \
	(
		cell is not ItemCell or \
		cell.customfield == customfield \
	)

static func IsSameItem(cell : BaseCell, item : Item) -> bool:
	return item and CompareCell(cell, item.cellID, item.cellCustomfield)

static func IsSameCell(cellA : BaseCell, cellB : BaseCell) -> bool:
	return cellB and CompareCell(cellA, cellB.id, cellB.customfield if cellB is ItemCell else "")

enum Modifier {
	None = 0,
	Health,
	Mana,
	Stamina,
	MaxMana,
	RegenMana,
	CritRate,
	MAttack,
	MDefense,
	MaxStamina,
	RegenStamina,
	CooldownDelay,
	MaxHealth,
	RegenHealth,
	Defense,
	CastDelay,
	DodgeRate,
	AttackRange,
	WalkSpeed,
	WeightCapacity,
	Attack,
	Count
}

static func GetModifierDisplayName(effect : Modifier) -> String:
	match effect:
		Modifier.Health:		return Localization.Text("Health")
		Modifier.Mana:			return Localization.Text("Mana")
		Modifier.Stamina:		return Localization.Text("Stamina")
		Modifier.MaxHealth:		return Localization.Text("Max Health")
		Modifier.MaxMana:		return Localization.Text("Max Mana")
		Modifier.MaxStamina:	return Localization.Text("Max Stamina")
		Modifier.Attack:		return Localization.Text("Attack")
		Modifier.Defense:		return Localization.Text("Defense")
		Modifier.MAttack:		return Localization.Text("M. Attack")
		Modifier.MDefense:		return Localization.Text("M. Defense")
		Modifier.AttackRange:	return Localization.Text("Atk Range")
		Modifier.CritRate:		return Localization.Text("Crit Rate")
		Modifier.DodgeRate:		return Localization.Text("Dodge Rate")
		Modifier.CastDelay:		return Localization.Text("Cast Delay")
		Modifier.CooldownDelay:	return Localization.Text("Cooldown")
		Modifier.RegenHealth:	return Localization.Text("HP Regen")
		Modifier.RegenMana:		return Localization.Text("MP Regen")
		Modifier.RegenStamina:	return Localization.Text("SP Regen")
		Modifier.WalkSpeed:		return Localization.Text("Walk Speed")
		Modifier.WeightCapacity: return Localization.Text("Carry Weight")
		_:						return Localization.Text("Unknown")

static func FormatModifierValue(effect : Modifier, value : Variant) -> String:
	match effect:
		Modifier.CritRate, Modifier.DodgeRate:
			var intVal : int = int(float(value) * 100.0)
			return ("+" if intVal >= 0 else "") + str(intVal) + "%"
		Modifier.CastDelay, Modifier.CooldownDelay:
			var floatVal : float = float(value)
			return ("+" if floatVal >= 0.0 else "") + ("%.2f" % floatVal) + "s"
		_:
			var intVal : int = int(value)
			return ("+" if intVal >= 0 else "") + str(intVal)
