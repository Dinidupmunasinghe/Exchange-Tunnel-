# Starts MySQL (if needed), backend API, and frontend for EngageBoost.
# Double-click this file or run:  powershell -ExecutionPolicy Bypass -File "START-PLATFORM.ps1"

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$ui = Join-Path $root "Facebook Engagement Exchange UI"
$mysqlBin = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"
$dataDir = Join-Path $backend "mysql-data"

function Test-Port($port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

Write-Host "`n=== EngageBoost local platform ===" -ForegroundColor Cyan

if (-not (Test-Port 3306)) {
  if (Test-Path $mysqlBin) {
    Write-Host "Starting MySQL on port 3306..."
    Start-Process -FilePath $mysqlBin -ArgumentList "--datadir=`"$dataDir`"", "--port=3306", "--console" -WindowStyle Minimized
    Start-Sleep -Seconds 4
  } else {
    Write-Host "MySQL not running and mysqld not found. Install MySQL or start your server manually." -ForegroundColor Red
  }
} else {
  Write-Host "MySQL already on port 3306" -ForegroundColor Green
}

$listen5000 = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($id in $listen5000) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }

$listen5173 = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($id in $listen5173) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 1

Write-Host "Starting backend (port 5000)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$backend`"; npm run dev"

Write-Host "Starting frontend (port 5173)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$ui`"; npm run dev -- --port 5173 --strictPort --host localhost"

Start-Sleep -Seconds 5
Start-Process "https://localhost:5173/"

Write-Host "`nOpen this in your browser:  https://localhost:5173/" -ForegroundColor Green
Write-Host "(First visit: accept the local dev certificate if the browser warns.)" -ForegroundColor Yellow
Write-Host "API health check:           http://localhost:5000/api/health`n" -ForegroundColor Green
