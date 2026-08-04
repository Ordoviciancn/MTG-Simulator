$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $projectRoot "tools"
$cloudflared = Join-Path $toolsDir "cloudflared.exe"
$localUrl = "http://127.0.0.1:8787"
$tunnelLog = Join-Path $toolsDir "cloudflared-latest.log"

function Write-Step($text) {
  Write-Host ""
  Write-Host "==> $text" -ForegroundColor Cyan
}

function Resolve-CommandPath($name) {
  $candidates = @($name)
  if ($name -notlike "*.cmd") { $candidates = @("$name.cmd", "$name.exe", $name) }
  foreach ($candidate in $candidates) {
    $command = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
  }
  return $null
}

function Resolve-NodeScriptCommand($name) {
  $command = Get-Command "$name.cmd" -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  return Resolve-CommandPath $name
}

function Add-IfExists($path) {
  if ($path -and (Test-Path $path) -and ($env:Path -notlike "*$path*")) {
    $env:Path = "$path;$env:Path"
  }
}

$bundledNode = "D:\AI-Models\runtimes\node-v22.23.0-win-x64"
$codexNode = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
$codexBin = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin"
$npmGlobal = "$env:APPDATA\npm"

Add-IfExists $bundledNode
Add-IfExists $codexNode
Add-IfExists $codexBin
Add-IfExists $npmGlobal

Set-Location $projectRoot

$node = Resolve-CommandPath "node"
$pnpm = Resolve-NodeScriptCommand "pnpm"
$npm = Resolve-NodeScriptCommand "npm"

if (!$node) {
  throw "Node.js was not found. Install Node.js 22 LTS or check D:\AI-Models\runtimes\node-v22.23.0-win-x64."
}

if (!$pnpm) {
  if (!$npm) { throw "pnpm and npm were not found. Cannot install pnpm automatically." }
  Write-Step "pnpm was not found; installing pnpm with npm"
  & $npm install -g pnpm
  $pnpm = Resolve-NodeScriptCommand "pnpm"
  if (!$pnpm) { throw "pnpm is still unavailable after install. Reopen this script or check PATH." }
}

if (!(Test-Path $toolsDir)) {
  New-Item -ItemType Directory -Path $toolsDir | Out-Null
}

if (!(Test-Path $cloudflared)) {
  Write-Step "Downloading Cloudflare Tunnel"
  Invoke-WebRequest `
    -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" `
    -OutFile $cloudflared
}

if (!(Test-Path (Join-Path $projectRoot "node_modules"))) {
  Write-Step "First run: installing dependencies"
  & $pnpm install
}

Write-Step "Building MTG Tabletop"
& $pnpm build

Write-Step "Starting local server $localUrl"
$serverProcess = Start-Process `
  -FilePath $pnpm `
  -ArgumentList "start" `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -PassThru

try {
  Start-Sleep -Seconds 2
  Start-Process $localUrl | Out-Null

  if (Test-Path $tunnelLog) { Remove-Item -LiteralPath $tunnelLog -Force }

  Write-Step "Starting public tunnel"
  Write-Host "Generating public URL. It will be copied to clipboard when ready." -ForegroundColor Yellow
  Write-Host "Keep this window open while playing. Closing it will stop the public URL." -ForegroundColor Yellow

  $tunnelProcess = Start-Process `
    -FilePath $cloudflared `
    -ArgumentList "tunnel --url $localUrl --logfile `"$tunnelLog`"" `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -PassThru

  $publicUrl = $null
  for ($index = 0; $index -lt 90; $index += 1) {
    Start-Sleep -Seconds 1
    if (!(Test-Path $tunnelLog)) { continue }
    $logText = Get-Content -LiteralPath $tunnelLog -Raw -ErrorAction SilentlyContinue
    if (!$logText) { continue }
    $match = [regex]::Match($logText, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
    if ($match.Success) {
      $publicUrl = $match.Value
      break
    }
  }

  if ($publicUrl) {
    Set-Clipboard -Value $publicUrl
    Write-Host ""
    Write-Host "Public URL generated and copied:" -ForegroundColor Green
    Write-Host $publicUrl -ForegroundColor White
    Write-Host ""
    Write-Host "Send this URL to your friend to join the room." -ForegroundColor Green
  } else {
    Write-Host ""
    Write-Host "Could not auto-detect the public URL. Check log file:" -ForegroundColor Yellow
    Write-Host $tunnelLog -ForegroundColor White
  }

  Write-Host ""
  Write-Host "Local URL: $localUrl" -ForegroundColor DarkGray
  Write-Host "Press Enter to stop local server and public tunnel." -ForegroundColor Yellow
  [void][Console]::ReadLine()
}
finally {
  Write-Step "Stopping services"
  if ($tunnelProcess -and !$tunnelProcess.HasExited) {
    Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($serverProcess -and !$serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
