@echo off
setlocal EnableDelayedExpansion

:: ─── Self-elevate to Administrator ───────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

title We Plays - Dependency Installer
color 0A

echo.
echo  ==========================================
echo   We Plays - Dependency Installer
echo   Installs yt-dlp and FFmpeg with PATH
echo  ==========================================
echo.

:: ─── Setup install directory ──────────────────────────────────────────────────
set "INSTALL_DIR=C:\Program Files\WePlays\bin"
echo  [1/4] Setting up install directory...
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
    echo        Created: %INSTALL_DIR%
) else (
    echo        Already exists: %INSTALL_DIR%
)

:: ─── Download yt-dlp ──────────────────────────────────────────────────────────
echo.
echo  [2/4] Downloading yt-dlp...
powershell -ExecutionPolicy Bypass -Command ^
  "try { ^
    $url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'; ^
    $dest = '%INSTALL_DIR%\yt-dlp.exe'; ^
    Write-Host '        Downloading from GitHub...'; ^
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing; ^
    Write-Host '        yt-dlp downloaded OK'; ^
  } catch { Write-Host ('        ERROR: ' + $_.Exception.Message) }"

if not exist "%INSTALL_DIR%\yt-dlp.exe" (
    echo  [!!] Failed to download yt-dlp. Check your internet connection.
    goto :error
)
echo        yt-dlp.exe installed.

:: ─── Download FFmpeg ──────────────────────────────────────────────────────────
echo.
echo  [3/4] Downloading FFmpeg...
set "FFMPEG_ZIP=%TEMP%\ffmpeg-we-plays.zip"
powershell -ExecutionPolicy Bypass -Command ^
  "try { ^
    $url = 'https://github.com/BtbN/ffmpeg-builds/releases/download/latest/ffmpeg-master-latest-win64-gpl-shared.zip'; ^
    Write-Host '        Downloading FFmpeg (may take a minute)...'; ^
    Invoke-WebRequest -Uri $url -OutFile '%FFMPEG_ZIP%' -UseBasicParsing; ^
    Write-Host '        Extracting...'; ^
    Add-Type -AssemblyName System.IO.Compression.FileSystem; ^
    $zip = [System.IO.Compression.ZipFile]::OpenRead('%FFMPEG_ZIP%'); ^
    $entry = $zip.Entries | Where-Object { $_.Name -eq 'ffmpeg.exe' } | Select-Object -First 1; ^
    if ($entry) { ^
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, '%INSTALL_DIR%\ffmpeg.exe', $true); ^
      Write-Host '        ffmpeg.exe extracted OK'; ^
    } else { ^
      Write-Host '        ERROR: ffmpeg.exe not found in zip'; ^
    } ^
    $zip.Dispose(); ^
  } catch { Write-Host ('        ERROR: ' + $_.Exception.Message) }"

if not exist "%INSTALL_DIR%\ffmpeg.exe" (
    echo  [!!] Failed to download FFmpeg. Check your internet connection.
    goto :error
)
echo        ffmpeg.exe installed.

:: ─── Add to System PATH ───────────────────────────────────────────────────────
echo.
echo  [4/4] Adding to System PATH...
powershell -ExecutionPolicy Bypass -Command ^
  "$path = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine'); ^
   $dir = '%INSTALL_DIR%'; ^
   if ($path -notlike ('*' + $dir + '*')) { ^
     [System.Environment]::SetEnvironmentVariable('PATH', $path + ';' + $dir, 'Machine'); ^
     Write-Host '        Added to System PATH.'; ^
   } else { ^
     Write-Host '        Already in System PATH.'; ^
   }"

:: ─── Cleanup ──────────────────────────────────────────────────────────────────
if exist "%FFMPEG_ZIP%" del /q "%FFMPEG_ZIP%"

:: ─── Done ─────────────────────────────────────────────────────────────────────
echo.
echo  ==========================================
echo   Installation Complete!
echo   Location: %INSTALL_DIR%
echo.
echo   yt-dlp  : %INSTALL_DIR%\yt-dlp.exe
echo   FFmpeg  : %INSTALL_DIR%\ffmpeg.exe
echo.
echo   Please RESTART We Plays for changes
echo   to take effect.
echo  ==========================================
echo.
pause
exit /b 0

:error
echo.
echo  ==========================================
echo   Installation failed. Please check your
echo   internet connection and try again.
echo   
echo   Or manually place yt-dlp.exe and
echo   ffmpeg.exe in:
echo   %INSTALL_DIR%
echo  ==========================================
echo.
pause
exit /b 1
