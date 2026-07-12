; ── We Plays Custom Uninstall Script ────────────────────────────────────────
; Asks the user whether to delete all app data during uninstallation.

; Skip the "Only for me / For all users" selection page - install directly for current user
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customUnInstall
  ; Ask user if they want to remove all app data
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Remove all We Plays data?$\n$\nThis includes:$\n  • Music library & song metadata$\n  • Playlists & favourites$\n  • Listening history & stats$\n  • App settings$\n$\nClick 'Yes' to delete all data.$\nClick 'No' to keep your data for a future install." \
    IDNO SkipDataDelete

    ; Delete Electron userData folder (%APPDATA%\We Plays)
    RMDir /r "$APPDATA\We Plays"

    ; Delete electron-store config folder if separate
    RMDir /r "$APPDATA\we-plays"

  SkipDataDelete:
!macroend
