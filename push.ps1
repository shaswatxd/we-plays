$ErrorActionPreference = "Continue"

$ROOT    = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP     = Join-Path (Join-Path $ROOT "resources") "app"
$DIST    = Join-Path $ROOT "dist_installer"
$WEBSITE = Join-Path $ROOT "website"

$pkg     = Get-Content (Join-Path $APP "package.json") | ConvertFrom-Json
$VERSION = $pkg.version
$REPO    = "shaswatxd/we-plays"
$TAG     = "v$VERSION"

# ── helpers ──────────────────────────────────────────────────────────────────

function Write-Step($n, $total, $msg) {
    Write-Host ""
    Write-Host "[$n/$total] $msg" -ForegroundColor Yellow
}

function Write-Ok($msg)   { Write-Host "  [OK]  $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  [..] $msg"  -ForegroundColor DarkGray }
function Write-Err($msg)  { Write-Host "  [!!]  $msg" -ForegroundColor Red }

function Get-Elapsed($sw) {
    return "$([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
}

# ── banner ────────────────────────────────────────────────────────────────────

$totalTimer = [System.Diagnostics.Stopwatch]::StartNew()
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WE PLAYS - Push Script v$VERSION"       -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ── cleanup ───────────────────────────────────────────────────────────────────

$tauriFolder = Join-Path $APP "src-tauri"
if (Test-Path $tauriFolder) {
    Write-Info "Removing leftover Tauri folder..."
    Remove-Item -Recurse -Force $tauriFolder
}

# ── clear GitHub token so gh CLI uses keyring ────────────────────────────────

$env:GITHUB_TOKEN = ""
[System.Environment]::SetEnvironmentVariable("GITHUB_TOKEN", $null, "Process")
try { gh auth switch --user shaswatxd 2>$null | Out-Null } catch {}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 - npm install
# ─────────────────────────────────────────────────────────────────────────────

Write-Step 1 5 "Installing npm dependencies..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()

Push-Location $APP
try { npm install --prefer-offline 2>&1 | Out-Null } finally { Pop-Location }

Write-Ok "Dependencies ready  ($(Get-Elapsed $sw))"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 - build
# ─────────────────────────────────────────────────────────────────────────────

Write-Step 2 5 "Building Electron app & installer  (compression: maximum)..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()

Push-Location $APP
try { npm run dist } finally { Pop-Location }

$SETUP = Get-ChildItem $DIST -Filter "WePlays-$VERSION-Setup.exe" | Select-Object -First 1
if (-not $SETUP) {
    Write-Err "Installer not found in $DIST -- build may have failed."
    exit 1
}

$sizeMB = [math]::Round($SETUP.Length / 1MB, 1)
Write-Ok "Build complete  ->  $($SETUP.Name)  ($sizeMB MB)  ($(Get-Elapsed $sw))"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 - git push + GitHub release upload (parallel)
# ─────────────────────────────────────────────────────────────────────────────

Write-Step 3 5 "Pushing to GitHub & uploading release  (parallel)..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()

# git push runs as a background job
$gitJob = Start-Job -ScriptBlock {
    param($root, $ver)
    Set-Location $root
    git add -A
    git commit -m "v$ver update" 2>&1 | Out-Null
    git push origin master:main 2>&1 | Out-Null
    $LASTEXITCODE
} -ArgumentList $ROOT, $VERSION

# GitHub release upload runs in foreground
$uploadOk = $false
try {
    $oldEA = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    gh release view $TAG --repo $REPO 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        gh release create $TAG --repo $REPO --title "We Plays $VERSION" --notes "v$VERSION release" $SETUP.FullName
    } else {
        gh release upload $TAG --repo $REPO --clobber $SETUP.FullName
    }

    if ($LASTEXITCODE -eq 0) { $uploadOk = $true }
    $ErrorActionPreference = $oldEA
} catch {
    $ErrorActionPreference = $oldEA
}

# wait for git job to finish
Receive-Job $gitJob -Wait -AutoRemoveJob 2>$null | Out-Null

if ($uploadOk) {
    Write-Ok "Release uploaded  ->  $($SETUP.Name) ($sizeMB MB)"
} else {
    Write-Err "GitHub release upload failed. Run 'gh auth login' if unauthenticated."
}
Write-Ok "Git push done  ($(Get-Elapsed $sw))"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 - website push
# ─────────────────────────────────────────────────────────────────────────────

Write-Step 4 5 "Pushing website..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()

# Auto-update hardcoded version + download link in index.html
$indexPath = Join-Path $WEBSITE "index.html"
if (Test-Path $indexPath) {
    $html = Get-Content $indexPath -Raw -Encoding UTF8

    # Update version badge (any vX.X.X)
    $html = $html -replace '(Version )\d+\.\d+\.\d+( — Powered by Electron)', "`${1}$VERSION`${2}"

    # Update download href (vX.X.X/WePlays-X.X.X-Setup.exe)
    $html = $html -replace 'releases/download/v[\d.]+/WePlays-[\d.]+-Setup\.exe', "releases/download/$TAG/WePlays-$VERSION-Setup.exe"

    [System.IO.File]::WriteAllText($indexPath, $html, (New-Object System.Text.UTF8Encoding $false))
    Write-Info "Website version updated -> v$VERSION"
}

Push-Location $WEBSITE
try {
    $changes = git status --porcelain
    if ($changes) {
        git add .
        git commit -m "v$VERSION website update" 2>$null | Out-Null
    }
    # Push to both master and master:main (Vercel may track either)
    git -c "credential.helper=!gh auth git-credential" push origin master 2>$null | Out-Null
    git -c "credential.helper=!gh auth git-credential" push origin master:main 2>$null | Out-Null
    Write-Ok "Website pushed  ($(Get-Elapsed $sw))"
} catch {
    Write-Info "Website push skipped"
} finally { Pop-Location }


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 - version bump
# ─────────────────────────────────────────────────────────────────────────────

Write-Step 5 5 "Bumping version for next release..."

$parts    = $VERSION -split '\.'
$parts[2] = [int]$parts[2] + 1
$NEW_VER  = $parts -join '.'

$pkg.version = $NEW_VER
$pkgJson = $pkg | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText(
    (Join-Path $APP "package.json"),
    $pkgJson,
    (New-Object System.Text.UTF8Encoding $false)
)

Push-Location $ROOT
try {
    git add -A
    git commit -m "v$NEW_VER bump" 2>$null | Out-Null
} catch {}
Pop-Location

Write-Ok "Version bumped  $VERSION -> $NEW_VER"

# ─────────────────────────────────────────────────────────────────────────────
# done
# ─────────────────────────────────────────────────────────────────────────────

$total = [math]::Round($totalTimer.Elapsed.TotalSeconds)
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Done in ${total}s" -ForegroundColor Green
Write-Host "  Release : https://github.com/$REPO/releases/tag/$TAG" -ForegroundColor White
Write-Host "  Website : https://website-nine-tau-67.vercel.app"      -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
