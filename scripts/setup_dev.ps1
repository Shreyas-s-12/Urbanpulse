# UrbanPulse Local Development Bootstrap Script (Windows PowerShell)

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " URBANPULSE - Local Development Bootstrap" -ForegroundColor Cyan
Write-Host " Target Cities: Mysuru & Bengaluru" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 1. Environment file check
if (-not (Test-Path ".env")) {
    Write-Host "[1/3] Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "  -> Created .env file." -ForegroundColor Green
} else {
    Write-Host "[1/3] .env file already exists. Skipping." -ForegroundColor Green
}

# 2. Python Virtual Environment Setup (Backend & AI)
Write-Host "[2/3] Checking Backend Python environment..." -ForegroundColor Yellow
if (-not (Test-Path "backend/.venv")) {
    Write-Host "  -> Creating backend/.venv virtual environment..." -ForegroundColor Gray
    python -m venv backend/.venv
    Write-Host "  -> Virtual environment created." -ForegroundColor Green
} else {
    Write-Host "  -> backend/.venv already exists." -ForegroundColor Green
}

# 3. Docker status check
Write-Host "[3/3] Checking Docker Compose status..." -ForegroundColor Yellow
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "  -> Docker detected. Ready to run 'docker-compose up -d db redis'." -ForegroundColor Green
} else {
    Write-Host "  -> Docker CLI not found. Please install Docker Desktop to run PostGIS locally." -ForegroundColor Yellow
}

Write-Host "`nSetup complete! Review docs/ for architecture guides." -ForegroundColor Cyan
