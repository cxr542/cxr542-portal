# AI-Synapse-Wiki dev 서버 (포털용 포트 5174)
param(
  [string]$WikiRoot = $env:WIKI_ROOT
)

$ErrorActionPreference = "Stop"
$Port = 5174

if (-not $WikiRoot) {
  $candidates = @(
    (Join-Path $PSScriptRoot "..\.cache\AI-Synapse-Wiki"),
    (Join-Path $PSScriptRoot "..\..\AI-Synapse-Wiki"),
    (Join-Path $env:USERPROFILE "AI-Synapse-Wiki"),
    "G:\내 드라이브\VibeCoding\AI-Synapse-Wiki"
  )
  foreach ($c in $candidates) {
    if (Test-Path (Join-Path $c "package.json")) { $WikiRoot = (Resolve-Path $c).Path; break }
  }
}

if (-not $WikiRoot -or -not (Test-Path (Join-Path $WikiRoot "package.json"))) {
  Write-Host "AI-Synapse-Wiki 경로를 찾지 못했습니다."
  Write-Host "  `$env:WIKI_ROOT = 'C:\path\to\AI-Synapse-Wiki'"
  Write-Host "  또는 저장소 클론 후 다시 실행"
  exit 1
}

Write-Host "Wiki: $WikiRoot"
Write-Host "Port: $Port"
Set-Location $WikiRoot

if (-not (Test-Path "node_modules")) {
  npm install
}

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example (VITE_ADMIN_ENABLED=true)"
}

Write-Host "Starting Vite dev (base /ai-synapse-wiki/, port $Port)..."
$env:VITE_BASE = "/ai-synapse-wiki/"
npm run dev -- --port $Port --host localhost
