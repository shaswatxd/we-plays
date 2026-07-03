$ErrorActionPreference = "Stop"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP = Join-Path (Join-Path $ROOT "resources") "app"
$DIST = Join-Path $ROOT "dist_installer"
$WEBSITE = Join-Path $ROOT "website"

$pkg = Get-Content (Join-Path $APP "package.json") | ConvertFrom-Json
$VERSION = $pkg.version
$REPO = "shaswatxd/we-plays"
$TAG = "v$VERSION"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WE PLAYS - Push Script v$VERSION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Clean up leftover Tauri files if present
$tauriFolder = Join-Path $APP "src-tauri"
if (Test-Path $tauriFolder) {
    Write-Host "Cleaning up leftover Tauri files..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force $tauriFolder
}

Write-Host "`n[1/4] Installing npm dependencies..." -ForegroundColor Yellow
Push-Location $APP
try { npm install } finally { Pop-Location }

Write-Host "`n[2/4] Building Electron app & installer..." -ForegroundColor Yellow
Push-Location $APP
try { npm run dist } finally { Pop-Location }

Write-Host "`n[3/4] Pushing to GitHub..." -ForegroundColor Yellow
Push-Location $ROOT
try {
    git add -A
    git commit -m "v$VERSION update" 2>$null
    git push origin master:main 2>$null
} catch { Write-Host "Push skipped" -ForegroundColor DarkGray }
Pop-Location

Write-Host "`n[4/4] Uploading installer to GitHub release..." -ForegroundColor Yellow
$SETUP = Get-ChildItem $DIST -Filter "WePlays-$VERSION-Setup.exe" | Select-Object -First 1
if ($SETUP) {
    try {
        $oldErrorAction = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        gh release view $TAG --repo $REPO 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            gh release create $TAG --repo $REPO --title "We Plays $VERSION" --notes "v$VERSION release" $SETUP.FullName
        } else {
            gh release upload $TAG --repo $REPO --clobber $SETUP.FullName
        }
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Uploaded: $($SETUP.Name) ($([math]::Round($SETUP.Length/1MB,1)) MB)" -ForegroundColor Green
        } else {
            Write-Host "  GitHub release upload failed (non-zero exit code). Please run 'gh auth login' to authenticate." -ForegroundColor Red
        }
        $ErrorActionPreference = $oldErrorAction
    } catch {
        Write-Host "  GitHub release upload failed. Please ensure GitHub CLI is authenticated." -ForegroundColor Red
    }
} else {
    Write-Host "  ERROR: Installer not found in $DIST" -ForegroundColor Red
}

Write-Host "`nPushing website..." -ForegroundColor Yellow
Push-Location $WEBSITE
try {
    git add .
    git commit -m "v$VERSION website update" 2>$null
    git push origin master:main 2>$null
} catch { Write-Host "No website changes" -ForegroundColor DarkGray }
Pop-Location

Write-Host "`nDone!" -ForegroundColor Green
Write-Host "  Release: https://github.com/$REPO/releases/tag/$TAG" -ForegroundColor White
Write-Host "  Website: https://website-nine-tau-67.vercel.app" -ForegroundColor White
