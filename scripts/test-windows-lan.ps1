$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $repoRoot "backend/local/.env"
$certificatePath = Join-Path $repoRoot "marketing-genius-local-root.crt"

if (-not (Test-Path $envPath)) { throw "Private configuration is missing. Run node backend/local/install.mjs first." }
if (-not (Test-Path $certificatePath)) { throw "The LAN CA certificate is missing. Run scripts/setup-windows-lan.ps1 as Administrator first." }

$envText = [IO.File]::ReadAllText($envPath)
$addressMatch = [regex]::Match($envText, '(?m)^LAN_ADDRESS=(.+)$')
if (-not $addressMatch.Success) { throw "LAN_ADDRESS is not configured. Run the LAN setup helper first." }
$address = $addressMatch.Groups[1].Value.Trim()
if (-not ($address -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)')) { throw "LAN_ADDRESS is not a private IPv4 address: $address" }

function Test-ContainerRunning([string]$name) {
  $status = & docker inspect --format '{{.State.Status}}' $name 2>$null
  if ($LASTEXITCODE -ne 0 -or "$status".Trim() -ne "running") {
    throw "Container '$name' is not running. Start services with docker compose --profile lan up -d."
  }
  Write-Host "PASS: $name is running."
}

Push-Location $repoRoot
try {
  & docker info *> $null
  if ($LASTEXITCODE -ne 0) { throw "Docker is not running. Start Docker Desktop and retry." }

  Test-ContainerRunning "marketing-genius-api"
  Test-ContainerRunning "marketing-genius-ollama"
  Test-ContainerRunning "marketing-genius-searxng"
  Test-ContainerRunning "marketing-genius-caddy-lan"

  $localHealth = Invoke-RestMethod -Uri "http://127.0.0.1:8787/health" -TimeoutSec 10
  if ($localHealth.ok -ne $true) { throw "The local API health endpoint did not report ok=true." }
  Write-Host "PASS: Local API health check."

  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if (-not $curl) { throw "curl.exe is required for certificate-verified LAN HTTPS testing." }
  $lanJson = & curl.exe --fail --silent --show-error --max-time 15 --cacert $certificatePath "https://$address/health"
  if ($LASTEXITCODE -ne 0) { throw "LAN HTTPS failed certificate validation or could not reach https://$address/health." }
  $lanHealth = $lanJson | ConvertFrom-Json
  if ($lanHealth.ok -ne $true) { throw "LAN HTTPS reached the API, but its health response was not ok=true." }
  Write-Host "PASS: LAN HTTPS health check with the exported private CA certificate."

  $modelMatch = [regex]::Match($envText, '(?m)^LOCAL_AI_MODEL=(.+)$')
  $model = if ($modelMatch.Success) { $modelMatch.Groups[1].Value.Trim() } else { "qwen3:4b" }
  $models = & docker compose exec -T ollama ollama list
  if ($LASTEXITCODE -ne 0 -or -not ($models | Select-String -SimpleMatch $model)) {
    throw "The configured Ollama model '$model' is not present. Run docker compose exec ollama ollama pull $model."
  }
  Write-Host "PASS: Configured local AI model '$model' is present."
  Write-Host ""
  Write-Host "LOCAL KIRA RUNTIME CHECKS PASSED"
  Write-Host "Windows API and LAN HTTPS are healthy. This check does not test a separate Android device."
} finally {
  Pop-Location
}
