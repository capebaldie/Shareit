param(
  [Parameter(Position = 0)]
  [string]$Target = "app"
)

if ($Target -ne "app") {
  Write-Error "Unknown target '$Target'. Use: .\start app"
  exit 1
}

$launcher = Join-Path $PSScriptRoot "start-app.cmd"
if (-not (Test-Path $launcher)) {
  Write-Error "Launcher script not found at $launcher"
  exit 1
}

& $launcher
