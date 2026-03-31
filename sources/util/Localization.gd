extends RefCounted
class_name Localization

const DefaultLocale : String = "zh_CN"

static func Text(text : Variant) -> String:
	if text == null:
		return ""
	var source : String = str(text)
	if source.is_empty():
		return ""
	return TranslationServer.translate(source)

static func Format(text : String, args : Array = []) -> String:
	var translated : String = Text(text)
	return translated % args if not args.is_empty() else translated

static func DisableAutoTranslate(node : Node) -> void:
	if node:
		node.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
