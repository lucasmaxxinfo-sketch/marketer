#Requires -Version 5.1
#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $repoRoot "backend/local/.env"
$certificatePath = Join-Path $repoRoot "marketing-genius-local-root.crt"
$ruleName = "Marketing Genius LAN HTTPS"

if (-not (Test-Path $envPath)) { throw "Private configuration is missing. Run 'node backend/local/install.mjs' first." }

$route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Where-Object { $_.NextHop -ne "0.0.0.0" } | Sort-Object RouteMetric, InterfaceMetric | Select-Object -First 1
if (-not $route) { throw "No active IPv4 default route was found. Connect this PC to your home network and retry." }
$address = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -ne "127.0.0.1" -and -not $_.SkipAsSource } | Select-Object -First 1 -ExpandProperty IPAddress
if (-not $address) { throw "Could not identify the PC's active local IPv4 address." }
if (-not ($address -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)')) { throw "The selected address is not a private home-network IPv4 address: $address" }

Push-Location $repoRoot
try {
  $envText = [IO.File]::ReadAllText($envPath)
  if ($envText -match '(?m)^LAN_ADDRESS=.*$') { $envText = [regex]::Replace($envText, '(?m)^LAN_ADDRESS=.*$', "LAN_ADDRESS=$address") }
  else { $envText = $envText.TrimEnd() + "`r`nLAN_ADDRESS=$address`r`n" }
  [IO.File]::WriteAllText($envPath, $envText, [Text.UTF8Encoding]::new($false))
  Write-Host "PC LAN address configured: $address"
  if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -RemoteAddress LocalSubnet | Out-Null }
  Write-Host "Windows firewall allows HTTPS from the local subnet only."
  & docker compose --profile lan up -d
  if ($LASTEXITCODE -ne 0) { throw "Docker Compose could not start the private LAN services." }
  $exported = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & docker cp marketing-genius-caddy-lan:/data/caddy/pki/authorities/local/root.crt $certificatePath 2>$null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $certificatePath)) { $exported = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $exported) { throw "The public root certificate was not ready. Check 'docker compose logs caddy-lan' and rerun this script." }
  Write-Host "`nPRIVATE LAN HTTPS IS READY"
  Write-Host "PC address: https://$address"
  Write-Host "Public CA certificate: $certificatePath"
  Write-Host "Transfer that .crt file to Android and install it as a CA certificate."
  Write-Host "Set the Android workspace API address to https://$address."
  Write-Host "No router port forwarding was configured. Keep the CA private key inside Docker's data volume."
} finally { Pop-Location }
