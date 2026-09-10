<#
.SYNOPSIS
  Build the app, package the Windows installer, and (re)install it locally
  without any wizard clicks.

.DESCRIPTION
  Default run:  electron-vite build  ->  electron-builder  ->  silent per-user
  install  ->  relaunch the app.

  Every run is fully silent — no UAC, no wizard.

  If an older system-wide install exists (the copy under
  "C:\Program Files\Job Dashboard") the script only warns about it; pass
  -RemoveSystemWide once to uninstall it (that needs a single UAC prompt).

.PARAMETER SkipBuild
  Reinstall the installer that's already in .\release without rebuilding.

.PARAMETER Test
  Run "npm run typecheck" and the vitest suite first; abort if either fails.

.PARAMETER RemoveSystemWide
  Uninstall an older "all users" install first (one UAC prompt).

.PARAMETER NoLaunch
  Don't start the app after installing.

.EXAMPLE
  npm run reinstall
.EXAMPLE
  npm run reinstall -- -SkipBuild
.EXAMPLE
  npm run reinstall -- -Test
#>
param(
  [switch]$SkipBuild,
  [switch]$Test,
  [switch]$RemoveSystemWide,
  [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$product = 'Job Dashboard'
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$setup   = Join-Path $root "release\$product-Setup-$version.exe"

function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Die($m)  { Write-Host "`n$m" -ForegroundColor Red; exit 1 }

# --- optional gate -----------------------------------------------------------
if ($Test) {
  Step 'Typecheck'
  npm run typecheck
  if ($LASTEXITCODE) { Die 'typecheck failed — not installing.' }
  Step 'Tests'
  npx vitest run
  if ($LASTEXITCODE) { Die 'tests failed — not installing.' }
}

# --- build -----------------------------------------------------------------
if (-not $SkipBuild) {
  Step 'electron-vite build'
  npx electron-vite build
  if ($LASTEXITCODE) { Die 'electron-vite build failed.' }

  Step 'electron-builder (NSIS installer)'
  $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
  npx electron-builder --win --config electron-builder.yml
  if ($LASTEXITCODE) { Die 'electron-builder failed.' }
}

if (-not (Test-Path $setup)) { Die "installer not found: $setup`nRun without -SkipBuild first." }

# --- close the running app -------------------------------------------------
$running = Get-Process -Name $product -ErrorAction SilentlyContinue
Step 'Closing running app'
if ($running) {
  $running | Stop-Process -Force
  Start-Sleep -Milliseconds 600
} else {
  Write-Host 'not running'
}

# --- older system-wide install ------------------------------------------
$machine = Get-ItemProperty `
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' `
    -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -like 'Job Dashboard*' -and $_.QuietUninstallString }

if ($machine -and $RemoveSystemWide) {
  Step 'Removing previous system-wide install (one UAC prompt)'
  $exe  = ($machine.QuietUninstallString -replace '^"([^"]+)".*$', '$1')
  $rest = ($machine.QuietUninstallString -replace '^"[^"]+"\s*', '')
  try {
    Start-Process -FilePath $exe -ArgumentList $rest -Verb RunAs -Wait
    Start-Sleep -Seconds 2
  } catch {
    Write-Warning "skipped system-wide uninstall: $($_.Exception.Message)"
  }
} elseif ($machine) {
  Write-Warning ("an 'all users' install exists ({0}). Run once with -RemoveSystemWide to clear it." -f $machine.DisplayName)
}

# --- silent per-user install --------------------------------------------
Step "Installing $product $version (silent)"
Start-Process -FilePath $setup -ArgumentList '/S' -Wait
Start-Sleep -Milliseconds 800

# --- resolve where it landed -------------------------------------------
$entry = Get-ItemProperty `
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' `
    -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -like 'Job Dashboard*' } | Select-Object -First 1

$appExe = $null
if ($entry.DisplayIcon) { $appExe = ($entry.DisplayIcon -split ',')[0] }
if (-not $appExe -or -not (Test-Path $appExe)) {
  $appExe = Join-Path $env:LOCALAPPDATA "Programs\$product\$product.exe"
}

Write-Host "`nInstalled $product $version" -ForegroundColor Green
if (Test-Path $appExe) { Write-Host "  $appExe" }

# --- relaunch ----------------------------------------------------------
if (-not $NoLaunch) {
  if (Test-Path $appExe) {
    Step 'Launching'
    Start-Process $appExe
  } else {
    Write-Warning "installed, but couldn't locate the exe to launch."
  }
}
