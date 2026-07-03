$ErrorActionPreference = "Stop"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP = Join-Path (Join-Path $ROOT "resources") "app"
$DIST = Join-Path $ROOT "dist_installer"
$WEBSITE = Join-Path $ROOT "website"

$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"

$pkg = Get-Content (Join-Path $APP "package.json") | ConvertFrom-Json
$VERSION = $pkg.version
$REPO = "shaswatxd/we-plays"
$TAG = "v$VERSION"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WE PLAYS - Push Script v$VERSION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n[1/4] Copying installer..." -ForegroundColor Yellow
$NSIS_PATH = Join-Path $APP "src-tauri\target\release\bundle\nsis"
$SETUP_SRC = Get-ChildItem $NSIS_PATH -Filter "*x64-setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $SETUP_SRC) {
    Write-Host "  ERROR: No installer found! Run 'npm run tauri:build' first." -ForegroundColor Red
    exit 1
}
$SETUP_DST = Join-Path $DIST "WePlays-$VERSION-Setup.exe"
Copy-Item $SETUP_SRC.FullName $SETUP_DST -Force
Write-Host "  Copied: $($SETUP_SRC.Name) -> WePlays-$VERSION-Setup.exe ($([math]::Round($SETUP_SRC.Length/1MB,1)) MB)" -ForegroundColor Green

Write-Host "`n[2/4] Pushing app to GitHub..." -ForegroundColor Yellow
Push-Location $ROOT
try {
    git add resources/app/package.json resources/app/src resources/app/index.html resources/app/vite.config.js resources/app/assets resources/app/src-tauri .gitignore push.ps1
    git commit -m "v$VERSION update" 2>$null
    git push origin master:main 2>$null
} catch { Write-Host "Push skipped" -ForegroundColor DarkGray }
Pop-Location

Write-Host "`n[3/4] Uploading installer to GitHub release..." -ForegroundColor Yellow
$SETUP = Join-Path $DIST "WePlays-$VERSION-Setup.exe"
gh release view $TAG --repo $REPO 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    gh release create $TAG --repo $REPO --title "We Plays $VERSION" --notes "v$VERSION - Tauri build" $SETUP
} else {
    gh release upload $TAG --repo $REPO --clobber $SETUP
}
Write-Host "  Release: https://github.com/$REPO/releases/tag/$TAG" -ForegroundColor Green

Write-Host "`n[4/4] Pushing website changes..." -ForegroundColor Yellow
Push-Location $WEBSITE
try {
    git add .
    git commit -m "v$VERSION website update" 2>$null
    git push origin master:main 2>$null
} catch { Write-Host "No website changes" -ForegroundColor DarkGray }
Pop-Location

Write-Host "`nDone!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Release:  https://github.com/$REPO/releases/tag/$TAG" -ForegroundColor White
Write-Host "  Website:  https://website-nine-tau-67.vercel.app" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
