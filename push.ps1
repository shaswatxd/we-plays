$ErrorActionPreference = "Stop"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP = Join-Path (Join-Path $ROOT "resources") "app"
$DIST = Join-Path $ROOT "dist_installer"
$WEBSITE = Join-Path $ROOT "website"

$pkg = Get-Content (Join-Path $APP "package.json") | ConvertFrom-Json
$VERSION = $pkg.version
$REPO = "shaswatxd/we-plays"
$WEB_REPO = "shaswatxd/we-plays-website"
$TAG = "v$VERSION"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WE PLAYS - Push Script v$VERSION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Build
Write-Host "`n[1/6] Building app & installer..." -ForegroundColor Yellow
Push-Location $APP
try { npm run dist } finally { Pop-Location }

# Step 2: Portable zip
Write-Host "`n[2/6] Creating portable zip..." -ForegroundColor Yellow
$PORTABLE = Join-Path $DIST "WePlays-$VERSION-Portable.zip"
if (Test-Path $PORTABLE) { Remove-Item $PORTABLE -Force }
$unpackDir = Join-Path $DIST "win-unpacked"
Compress-Archive -Path (Join-Path $unpackDir "*") -DestinationPath $PORTABLE -Force

# Step 3: Commit & push app to GitHub
Write-Host "`n[3/6] Pushing app to GitHub..." -ForegroundColor Yellow
Push-Location $ROOT
try {
    git add resources/app/package.json resources/app/src resources/app/index.html resources/app/vite.config.js resources/app/assets .gitignore push.ps1
    git commit -m "v$VERSION - build update" 2>$null
    git push origin HEAD:main 2>$null
    if ($LASTEXITCODE -ne 0) { git push -u origin main 2>$null }
} catch { Write-Host "Push skipped" -ForegroundColor DarkGray }
Pop-Location

# Step 4: Upload to GitHub release
Write-Host "`n[4/6] Uploading to GitHub release..." -ForegroundColor Yellow
$SETUP = Join-Path $DIST "WePlays-$VERSION-Setup.exe"
gh release view $TAG --repo $REPO 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    gh release create $TAG --repo $REPO --title "We Plays $VERSION" --notes "Release $VERSION" "$SETUP#WePlays-$VERSION-Setup.exe" "$PORTABLE#WePlays-$VERSION-Portable.zip"
} else {
    gh release upload $TAG --repo $REPO --clobber "$SETUP#WePlays-$VERSION-Setup.exe" "$PORTABLE#WePlays-$VERSION-Portable.zip"
}

# Step 5: Push website
Write-Host "`n[5/6] Pushing website changes..." -ForegroundColor Yellow
Push-Location $WEBSITE
try {
    git add .
    git commit -m "v$VERSION - website update" 2>$null
    git push
} catch { Write-Host "No website changes" -ForegroundColor DarkGray }
Pop-Location

# Step 6: Done
Write-Host "`n[6/6] Done!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  App:      https://github.com/$REPO/releases/tag/$TAG" -ForegroundColor White
Write-Host "  Website:  https://website-nine-tau-67.vercel.app" -ForegroundColor White
Write-Host "  Setup:    WePlays-$VERSION-Setup.exe" -ForegroundColor White
Write-Host "  Portable: WePlays-$VERSION-Portable.zip" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
