extends Control

#
@onready var nameControl : Control			= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer/Name
@onready var nameTextControl : LineEdit		= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer/Name/Container/Text
@onready var passwordControl : Control		= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer/Password
@onready var passwordLabel : Label			= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer/Password/Label
@onready var passwordTextControl : LineEdit	= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer/Password/Container/Text
@onready var confirmPasswordControl : Control	= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer/ConfirmPassword
@onready var confirmPasswordTextControl : LineEdit	= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer/ConfirmPassword/Container/Text
@onready var emailControl : Control			= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer/Email
@onready var emailTextControl : LineEdit	= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer/Email/Container/Text
@onready var resetCodeControl : Control			= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer/Code
@onready var resetCodeTextControl : LineEdit		= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer/Code/Container/Text
@onready var indicatorRow : HBoxContainer	= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer/IndicatorRow
@onready var rememberMeCheckBox : CheckBox	= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer/IndicatorRow/RememberMe
@onready var onlineIndicator : CheckBox		= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer/IndicatorRow/OnlineIndicator
@onready var panel : PanelContainer			= $HBoxContainer/Panel
@onready var loginContainer : VBoxContainer	= $HBoxContainer/Panel/Margin/VBoxContainer/LoginContainer
@onready var webSinglePlayerIntro : VBoxContainer	= $HBoxContainer/Panel/Margin/VBoxContainer/WebSinglePlayerIntro
@onready var separator : HSeparator			= $HBoxContainer/Panel/Margin/VBoxContainer/HSeparator2
@onready var news : Scrollable				= $HBoxContainer/Panel/Margin/VBoxContainer/News
@onready var agreement : Scrollable			= $HBoxContainer/Panel/Margin/VBoxContainer/Agreement

enum RecoveryState { NONE, REQUEST_EMAIL, ENTER_CODE }

var nameText : String						= ""
var savedToken : String						= ""
var savedAccountName : String				= ""
var fillingFields : bool					= false
var isAccountCreatorEnabled : bool			= false
var recoveryState : RecoveryState			= RecoveryState.NONE
var webSinglePlayerStarting : bool			= false

func ApplyWebSinglePlayerSplash() -> bool:
	if not LauncherCommons.IsWebSinglePlayer():
		if loginContainer:
			loginContainer.set_visible(true)
		if webSinglePlayerIntro:
			webSinglePlayerIntro.set_visible(false)
		return false

	recoveryState = RecoveryState.NONE
	isAccountCreatorEnabled = false
	loginContainer.set_visible(false)
	webSinglePlayerIntro.set_visible(true)
	separator.set_visible(false)
	news.set_visible(false)
	agreement.set_visible(false)
	SetPanelExpand(false)
	return true

#
func FillWarningLabel(err : NetworkCommons.AuthError):
	if err != NetworkCommons.AuthError.ERR_OK:
		webSinglePlayerStarting = false
	if isAccountCreatorEnabled:
		FSM.EnterState(FSM.States.LOGIN_SCREEN)
		if err == NetworkCommons.AuthError.ERR_OK:
			EnableAccountCreator(false)
		else:
			EnableAccountCreator(true)
	elif recoveryState != RecoveryState.NONE:
		FSM.EnterState(FSM.States.LOGIN_SCREEN)
	else:
		if err != NetworkCommons.AuthError.ERR_OK:
			FSM.EnterState(FSM.States.LOGIN_SCREEN)

	var isWarn : bool = true
	var warn : String = ""
	match err:
		NetworkCommons.AuthError.ERR_OK:
			warn = ""
		NetworkCommons.AuthError.ERR_TOKEN:
			warn = Localization.Text("Invalid token, enter your password")
			passwordTextControl.clear()
			ClearSavedToken()
		NetworkCommons.AuthError.ERR_DUPLICATE_CONNECTION:
			warn = Localization.Text("Another connection happened with the same login.")
		NetworkCommons.AuthError.ERR_AUTH:
			warn = Localization.Text("Invalid account name or password.")
			passwordTextControl.grab_focus()
		NetworkCommons.AuthError.ERR_PASSWORD_VALID:
			warn = Localization.Text("Password should only include alpha-numeric characters and symbols.")
			passwordTextControl.grab_focus()
		NetworkCommons.AuthError.ERR_PASSWORD_SIZE:
			warn = Localization.Format("Password length should be inbetween %d and %d character long.", [NetworkCommons.PasswordMinSize, NetworkCommons.PasswordMaxSize])
			passwordTextControl.grab_focus()
		NetworkCommons.AuthError.ERR_NAME_AVAILABLE:
			warn = Localization.Text("Account name not available.")
			nameTextControl.grab_focus()
		NetworkCommons.AuthError.ERR_NAME_VALID:
			warn = Localization.Text("Name should should only include alpha-numeric characters and symbols.")
			nameTextControl.grab_focus()
		NetworkCommons.AuthError.ERR_NAME_SIZE:
			warn = Localization.Format("Name length should be inbetween %d and %d character long.", [NetworkCommons.PlayerNameMinSize, NetworkCommons.PlayerNameMaxSize])
			nameTextControl.grab_focus()
		NetworkCommons.AuthError.ERR_PASSWORD_MISMATCH:
			warn = Localization.Text("Passwords do not match.")
			confirmPasswordTextControl.grab_focus()
		NetworkCommons.AuthError.ERR_EMAIL_VALID:
			warn = Localization.Text("Email is incorrect, please us a normal email format.")
			emailTextControl.grab_focus()
		NetworkCommons.AuthError.ERR_RESET_UNAVAILABLE:
			warn = Localization.Text("Password reset is not available on this server.")
			SetRecoveryState(RecoveryState.NONE)
		NetworkCommons.AuthError.ERR_RESET_EMAIL_SENT:
			warn = Localization.Text("If this email is registered, a reset code has been sent. Check your inbox.")
			isWarn = false
			SetRecoveryState(RecoveryState.ENTER_CODE)
		NetworkCommons.AuthError.ERR_RESET_INVALID_CODE:
			warn = Localization.Text("Invalid or expired reset code.")
			resetCodeTextControl.grab_focus()
		NetworkCommons.AuthError.ERR_RESET_PASSWORD_UPDATED:
			warn = Localization.Text("Password updated successfully. You can now log in.")
			isWarn = false
			SetRecoveryState(RecoveryState.NONE)
		_:
			warn = Localization.Format("Could not connect to the server (Error %d).\nPlease contact us via our [url=%s][color=#%s]Discord server[/color][/url].\nMeanwhile be sure to test the offline mode!", [err, LauncherCommons.SocialLink, UICommons.DarkTextColor])

	var textColor : Color = UICommons.WarnTextColor if isWarn else UICommons.TextColor

	if not warn.is_empty():
		warn = "[color=#%s]%s[/color]" % [textColor.to_html(false), warn]
	Launcher.GUI.notificationLabel.AddNotification(warn)

func SetRecoveryState(state : RecoveryState):
	if ApplyWebSinglePlayerSplash():
		EnableButtons(true)
		return

	recoveryState = state
	isAccountCreatorEnabled = false

	match recoveryState:
		RecoveryState.NONE:
			nameControl.set_visible(true)
			passwordControl.set_visible(true)
			passwordLabel.text = "Password"
			passwordTextControl.secret = true
			confirmPasswordControl.set_visible(false)
			emailControl.set_visible(false)
			resetCodeControl.set_visible(false)
			indicatorRow.set_visible(true)
			separator.set_visible(true)
			news.set_visible(true)
			agreement.set_visible(false)
			SetPanelExpand(true)
			passwordTextControl.clear()
			confirmPasswordTextControl.clear()
			resetCodeTextControl.clear()
		RecoveryState.REQUEST_EMAIL:
			nameControl.set_visible(true)
			passwordControl.set_visible(false)
			confirmPasswordControl.set_visible(false)
			emailControl.set_visible(false)
			resetCodeControl.set_visible(false)
			indicatorRow.set_visible(false)
			separator.set_visible(false)
			news.set_visible(false)
			agreement.set_visible(false)
			SetPanelExpand(false)
			nameTextControl.grab_focus()
		RecoveryState.ENTER_CODE:
			nameControl.set_visible(false)
			passwordControl.set_visible(true)
			passwordLabel.text = "New Password"
			passwordTextControl.secret = true
			passwordTextControl.clear()
			confirmPasswordControl.set_visible(true)
			confirmPasswordTextControl.clear()
			emailControl.set_visible(false)
			resetCodeControl.set_visible(true)
			indicatorRow.set_visible(false)
			separator.set_visible(false)
			news.set_visible(false)
			agreement.set_visible(false)
			SetPanelExpand(false)
			resetCodeTextControl.grab_focus()
	EnableButtons(true)

func EnableAccountCreator(enable : bool):
	if ApplyWebSinglePlayerSplash():
		EnableButtons(true)
		return

	recoveryState = RecoveryState.NONE
	isAccountCreatorEnabled = enable

	confirmPasswordControl.set_visible(isAccountCreatorEnabled)
	emailControl.set_visible(isAccountCreatorEnabled)
	agreement.set_visible(isAccountCreatorEnabled)
	resetCodeControl.set_visible(false)

	nameControl.set_visible(true)
	passwordControl.set_visible(true)
	passwordLabel.text = "Password"
	passwordTextControl.secret = true
	indicatorRow.set_visible(not isAccountCreatorEnabled)
	separator.set_visible(true)
	news.set_visible(not isAccountCreatorEnabled)
	SetPanelExpand(true)
	if not isAccountCreatorEnabled:
		confirmPasswordTextControl.clear()
	EnableButtons(true)
	RefreshFocusNodes(enable)

func SetPanelExpand(expand : bool):
	if expand:
		panel.size_flags_vertical = Control.SIZE_FILL
	else:
		panel.size_flags_vertical = Control.SIZE_SHRINK_CENTER

#
func RefreshFocusNodes(accountCreatorEnabled : bool):
	if accountCreatorEnabled:
		nameTextControl.set_focus_previous(emailTextControl.get_path())
		passwordTextControl.set_focus_next(confirmPasswordTextControl.get_path())
		confirmPasswordTextControl.set_focus_next(emailTextControl.get_path())
		confirmPasswordTextControl.set_focus_previous(passwordTextControl.get_path())
	else:
		nameTextControl.set_focus_previous(passwordTextControl.get_path())
		passwordTextControl.set_focus_next(nameTextControl.get_path())

func RefreshOnlineMode():
	OnlineMode(Network.Client != null, Network.ENetServer != null or Network.WebSocketServer != null)

func OnlineMode(_clientStarted : bool, serverStarted : bool):
	if onlineIndicator:
		if not LauncherCommons.isWeb:
			Launcher.GUI.buttonBoxes.Rename(UICommons.ButtonBox.TERTIARY, "Switch Online" if serverStarted else "Switch Offline")
		onlineIndicator.text = "Playing Offline" if serverStarted else "Playing Online"
		if onlineIndicator.button_pressed != not serverStarted:
			onlineIndicator.button_pressed = not serverStarted

func EnableButtons(state : bool):
	if Launcher.GUI and Launcher.GUI.buttonBoxes:
		Launcher.GUI.buttonBoxes.ClearAll()
		if state:
			if recoveryState == RecoveryState.REQUEST_EMAIL:
				Launcher.GUI.buttonBoxes.Bind(UICommons.ButtonBox.PRIMARY, "Send Code", RequestReset)
				Launcher.GUI.buttonBoxes.Bind(UICommons.ButtonBox.CANCEL, "Cancel", SetRecoveryState.bind(RecoveryState.NONE))
			elif recoveryState == RecoveryState.ENTER_CODE:
				Launcher.GUI.buttonBoxes.Bind(UICommons.ButtonBox.PRIMARY, "Reset Password", ConfirmReset)
				Launcher.GUI.buttonBoxes.Bind(UICommons.ButtonBox.CANCEL, "Cancel", SetRecoveryState.bind(RecoveryState.NONE))
			elif isAccountCreatorEnabled:
				Launcher.GUI.buttonBoxes.Bind(UICommons.ButtonBox.PRIMARY, "Create", CreateAccount)
				Launcher.GUI.buttonBoxes.Bind(UICommons.ButtonBox.CANCEL, "Cancel", EnableAccountCreator.bind(false))
			else:
				if LauncherCommons.IsWebSinglePlayer():
					Launcher.GUI.buttonBoxes.Bind(UICommons.ButtonBox.PRIMARY, "Start Game", FSM.EnterState.bind(FSM.States.LOGIN_PROGRESS))
					Launcher.GUI.buttonBoxes.Bind(UICommons.ButtonBox.CANCEL, "Quit", Close)
				else:
					Launcher.GUI.buttonBoxes.Bind(UICommons.ButtonBox.PRIMARY, "Connect", Connect)
					if LauncherCommons.isWeb:
						Launcher.GUI.buttonBoxes.Bind(UICommons.ButtonBox.TERTIARY, "Refresh Connection", SwitchOnlineMode.bind(false))
					else:
						Launcher.GUI.buttonBoxes.Bind(UICommons.ButtonBox.TERTIARY, "Switch Online", SwitchOnlineMode.bind(onlineIndicator.button_pressed))
					Launcher.GUI.buttonBoxes.Bind(UICommons.ButtonBox.SECONDARY, "Create Account", EnableAccountCreator.bind(true))
					Launcher.GUI.buttonBoxes.Bind(UICommons.ButtonBox.CANCEL, "Forgot Password", SetRecoveryState.bind(RecoveryState.REQUEST_EMAIL))
					RefreshOnlineMode()
		else:
			onlineIndicator.text = "Connecting..."

func RefreshOnce():
	if ApplyWebSinglePlayerSplash():
		EnableButtons(true)
		return

	EnableAccountCreator(isAccountCreatorEnabled)
	_on_visibility_changed()

# Token persistence
func SaveToken(accountName : String, token : String):
	if not rememberMeCheckBox.button_pressed:
		return
	Conf.SetValue("auth", "account_name", Conf.Type.AUTH_TOKEN, accountName)
	Conf.SetValue("auth", "token", Conf.Type.AUTH_TOKEN, token)
	Conf.SaveType("auth_token", Conf.Type.AUTH_TOKEN)

func LoadSavedToken() -> bool:
	savedAccountName = Conf.GetString("auth", "account_name", Conf.Type.AUTH_TOKEN)
	savedToken = Conf.GetString("auth", "token", Conf.Type.AUTH_TOKEN)
	if savedAccountName.is_empty() or savedToken.is_empty():
		return false
	nameText = savedAccountName
	return true

func ClearSavedToken():
	passwordTextControl.clear()
	savedToken = ""
	savedAccountName = ""
	Conf.confFiles[Conf.Type.AUTH_TOKEN].clear()
	Conf.cache.clear()
	DirAccess.remove_absolute(Path.Local + "auth_token" + Path.ConfExt)

func FillFieldsFromToken():
	if savedToken.is_empty():
		return

	fillingFields = true
	nameTextControl.set_text(nameText)
	passwordTextControl.set_text("tokentokentoken")
	fillingFields = false

func StartWebSinglePlayer():
	if not LauncherCommons.IsWebSinglePlayer() or webSinglePlayerStarting:
		return
	if not Peers.HasPeer(NetworkCommons.PeerAuthorityID):
		call_deferred("StartWebSinglePlayer")
		return

	webSinglePlayerStarting = true
	nameText = LauncherCommons.WebSinglePlayerAccountName
	Launcher.LocalPlayerName = LauncherCommons.WebSinglePlayerCharacterName
	if Launcher.GUI and Launcher.GUI.settingsWindow:
		Launcher.GUI.settingsWindow.set_sessionaccountname(nameText)

	if not Network.BootstrapSinglePlayer():
		webSinglePlayerStarting = false
		FillWarningLabel(NetworkCommons.AuthError.ERR_SERVER_UNREACHABLE)

#
func Connect():
	nameText = nameTextControl.get_text()
	if not savedToken.is_empty():
		if Network.LoginWithToken(savedAccountName, savedToken):
			nameText = savedAccountName
			FSM.EnterState(FSM.States.LOGIN_PROGRESS)
			if Launcher.GUI.settingsWindow:
				Launcher.GUI.settingsWindow.set_sessionaccountname(nameText)
		savedToken = ""
		return
	var passwordText : String = passwordTextControl.get_text()
	var authError : NetworkCommons.AuthError = NetworkCommons.CheckAuthInformation(nameText, passwordText)
	FillWarningLabel(authError)
	if authError == NetworkCommons.AuthError.ERR_OK:
		if Network.LoginWithPassword(nameText, passwordText, rememberMeCheckBox.button_pressed):
			FSM.EnterState(FSM.States.LOGIN_PROGRESS)
			if Launcher.GUI.settingsWindow:
				Launcher.GUI.settingsWindow.set_sessionaccountname(nameText)

func CreateAccount():
	nameText = nameTextControl.get_text()
	var passwordText : String = passwordTextControl.get_text()
	var confirmText : String = confirmPasswordTextControl.get_text()
	var emailText : String = emailTextControl.get_text()

	var authError : NetworkCommons.AuthError = NetworkCommons.CheckAuthInformation(nameText, passwordText)
	if authError == NetworkCommons.AuthError.ERR_OK:
		if passwordText != confirmText:
			authError = NetworkCommons.AuthError.ERR_PASSWORD_MISMATCH
	if authError == NetworkCommons.AuthError.ERR_OK:
		authError = NetworkCommons.CheckEmailInformation(emailText)

	if authError == NetworkCommons.AuthError.ERR_OK:
		if Network.CreateAccount(nameText, passwordText, emailText, rememberMeCheckBox.button_pressed):
			FSM.EnterState(FSM.States.LOGIN_PROGRESS)
	else:
		FillWarningLabel(authError)

func RequestReset():
	nameText = nameTextControl.get_text()
	if nameText.is_empty():
		nameTextControl.grab_focus()
		return
	Network.RequestPasswordReset(nameText)

func ConfirmReset():
	var codeText : String = resetCodeTextControl.get_text()
	var newPassword : String = passwordTextControl.get_text()
	var confirmText : String = confirmPasswordTextControl.get_text()

	if not NetworkCommons.CheckResetCode(codeText):
		FillWarningLabel(NetworkCommons.AuthError.ERR_RESET_INVALID_CODE)
		return

	var passwordErr : NetworkCommons.AuthError = NetworkCommons.CheckPasswordInformation(newPassword)
	if passwordErr != NetworkCommons.AuthError.ERR_OK:
		FillWarningLabel(passwordErr)
		return

	if newPassword != confirmText:
		FillWarningLabel(NetworkCommons.AuthError.ERR_PASSWORD_MISMATCH)
		return

	Network.ConfirmPasswordReset(nameText, codeText, newPassword)

func Close():
	if recoveryState != RecoveryState.NONE:
		SetRecoveryState(RecoveryState.NONE)
	elif isAccountCreatorEnabled:
		EnableAccountCreator(false)
	else:
		Launcher.GUI.ToggleControl(Launcher.GUI.quitWindow)

#
func _on_text_focus_entered():
	if Launcher.Action:
		Launcher.Action.Enable(false)

func _on_text_focus_exited():
	if Launcher.Action:
		Launcher.Action.Enable(true)

func _on_text_submitted(_newText):
	Launcher.GUI.buttonBoxes.Call(UICommons.ButtonBox.PRIMARY)

#
func _on_visibility_changed():
	if visible:
		if ApplyWebSinglePlayerSplash():
			EnableButtons(true)
			return

		LoadSavedToken()
		FillFieldsFromToken()
		if nameTextControl and nameTextControl.is_visible() and nameTextControl.get_text().length() == 0:
			nameTextControl.grab_focus()
		elif passwordTextControl and passwordTextControl.is_visible() and passwordTextControl.get_text().length() == 0:
			passwordTextControl.grab_focus()
		EnableButtons(true)

func SwitchOnlineMode(toggled : bool):
	EnableButtons(true)
	if Launcher.Mode(true, toggled):
		EnableButtons(false)

func _on_password_text_changed(_newText : String):
	if not fillingFields:
		savedToken = ""

func _on_remember_me_toggled(toggled_on : bool):
	if not toggled_on:
		ClearSavedToken()

func _ready():
	Localization.DisableAutoTranslate(nameTextControl)
	Localization.DisableAutoTranslate(passwordTextControl)
	Localization.DisableAutoTranslate(confirmPasswordTextControl)
	Localization.DisableAutoTranslate(emailTextControl)
	Localization.DisableAutoTranslate(resetCodeTextControl)
	Launcher.launchModeUpdated.connect(OnlineMode)
	ApplyWebSinglePlayerSplash()
	if LoadSavedToken():
		rememberMeCheckBox.button_pressed = true
