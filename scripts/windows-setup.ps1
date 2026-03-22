# ============================================================
# NexusMind - Windows 一鍵安裝腳本
# 需求：Docker Desktop for Windows (WSL2 backend)
# 執行方式：右鍵 → "用 PowerShell 執行" 或在 PowerShell 中執行
# ============================================================

param(
    [switch]$SkipBuild,
    [switch]$Down,
    [switch]$Logs
)

$ErrorActionPreference = "Stop"
$ProjectName = "nexusmind"
$ScriptDir = Split-Path -Parent $PSScriptRoot

# ── 顏色輸出 ──────────────────────────────────────────────
function Write-Step  { Write-Host "`n▶  $args" -ForegroundColor Cyan }
function Write-OK    { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Warn  { Write-Host "⚠️  $args" -ForegroundColor Yellow }
function Write-Fail  { Write-Host "❌ $args" -ForegroundColor Red }

# ── 停止服務 ─────────────────────────────────────────────
if ($Down) {
    Write-Step "停止所有 NexusMind 容器..."
    docker compose -f "$ScriptDir\docker-compose.yml" -f "$ScriptDir\docker-compose.windows.yml" down
    Write-OK "已停止"
    exit 0
}

# ── 查看 Logs ────────────────────────────────────────────
if ($Logs) {
    docker compose -f "$ScriptDir\docker-compose.yml" -f "$ScriptDir\docker-compose.windows.yml" logs -f
    exit 0
}

Write-Host @"

  _   _                      __  __ _           _
 | \ | | _____  ___   _ ___ |  \/  (_)_ __   __| |
 |  \| |/ _ \ \/ / | | / __|| |\/| | | '_ \ / _` |
 | |\  |  __/>  <| |_| \__ \| |  | | | | | | (_| |
 |_| \_|\___/_/\_\\__,_|___/|_|  |_|_|_| |_|\__,_|

 Windows 安裝程式 v1.0
"@ -ForegroundColor Magenta

# ── Step 1: 檢查 Docker ──────────────────────────────────
Write-Step "檢查 Docker Desktop..."
try {
    $dockerVersion = docker version --format "{{.Server.Version}}" 2>$null
    Write-OK "Docker $dockerVersion 已就緒"
} catch {
    Write-Fail "找不到 Docker！請先安裝 Docker Desktop for Windows"
    Write-Host "下載：https://www.docker.com/products/docker-desktop/" -ForegroundColor Blue
    exit 1
}

# ── Step 2: 檢查 Docker Desktop 設定 ────────────────────
Write-Step "檢查 Docker Desktop 設定..."
$dockerInfo = docker info 2>$null | Out-String
if ($dockerInfo -match "WSL") {
    Write-OK "使用 WSL2 backend（推薦）"
} else {
    Write-Warn "可能使用 Hyper-V backend，建議改用 WSL2"
}

# 檢查總記憶體
$memInfo = docker info --format "{{.MemTotal}}" 2>$null
$memGB = [math]::Round([int64]$memInfo / 1GB, 1)
if ($memGB -lt 4) {
    Write-Warn "Docker 可用記憶體只有 ${memGB}GB，建議調高到 6GB"
    Write-Host "  Docker Desktop → Settings → Resources → Memory → 6GB" -ForegroundColor Yellow
} else {
    Write-OK "Docker 記憶體：${memGB}GB"
}

# ── Step 3: 切換到專案目錄 ──────────────────────────────
Write-Step "切換到專案目錄..."
Set-Location $ScriptDir
Write-OK "目錄：$ScriptDir"

# ── Step 4: 檢查 .env.production ────────────────────────
Write-Step "檢查環境變數設定..."
if (-not (Test-Path ".env.production")) {
    Write-Fail "找不到 .env.production！"
    if (Test-Path ".env.example") {
        Write-Host "`n請執行以下步驟：" -ForegroundColor Yellow
        Write-Host "  1. 複製：copy .env.example .env.production" -ForegroundColor White
        Write-Host "  2. 編輯：notepad .env.production" -ForegroundColor White
        Write-Host "  3. 填入你的 API Keys" -ForegroundColor White
    }
    exit 1
}
Write-OK ".env.production 存在"

# 讀取關鍵變數
$envContent = Get-Content ".env.production" | Where-Object { $_ -match "^[A-Z_]+=" }
$envVars = @{}
foreach ($line in $envContent) {
    $parts = $line -split "=", 2
    if ($parts.Count -eq 2) {
        $envVars[$parts[0]] = $parts[1]
    }
}

$supabaseUrl = $envVars["NEXT_PUBLIC_SUPABASE_URL"]
$supabaseKey = $envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"]

if ([string]::IsNullOrEmpty($supabaseUrl) -or $supabaseUrl -match "YOUR_PROJECT") {
    Write-Fail "NEXT_PUBLIC_SUPABASE_URL 未設定，請編輯 .env.production"
    exit 1
}
if ([string]::IsNullOrEmpty($supabaseKey) -or $supabaseKey -match "your_") {
    Write-Fail "NEXT_PUBLIC_SUPABASE_ANON_KEY 未設定，請編輯 .env.production"
    exit 1
}
Write-OK "Supabase URL：$supabaseUrl"

# ── Step 5: 讀取其他 build args ─────────────────────────
$telegramUsername = $envVars["NEXT_PUBLIC_TELEGRAM_BOT_USERNAME"]
if ([string]::IsNullOrEmpty($telegramUsername)) { $telegramUsername = "" }

# ── Step 6: Build images ─────────────────────────────────
if (-not $SkipBuild) {
    Write-Step "建構 Docker images（首次約需 5-10 分鐘）..."

    # Build 主應用（需要 NEXT_PUBLIC_* build args）
    Write-Host "  → 建構 nexusmind-app..." -ForegroundColor Gray
    docker build `
        --build-arg "NEXT_PUBLIC_SUPABASE_URL=$supabaseUrl" `
        --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=$supabaseKey" `
        --build-arg "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$telegramUsername" `
        -t nexusmind-app:latest `
        .

    if ($LASTEXITCODE -ne 0) {
        Write-Fail "nexusmind-app build 失敗"
        exit 1
    }
    Write-OK "nexusmind-app 建構完成"

    # Build 其他服務（透過 docker compose build）
    Write-Host "  → 建構微服務（marker / lightrag / skill-executor）..." -ForegroundColor Gray
    docker compose `
        -f "docker-compose.yml" `
        -f "docker-compose.windows.yml" `
        build marker lightrag skill-executor

    if ($LASTEXITCODE -ne 0) {
        Write-Fail "微服務 build 失敗"
        exit 1
    }
    Write-OK "所有 images 建構完成"
} else {
    Write-Warn "跳過 build（-SkipBuild 模式）"
}

# ── Step 7: 啟動服務 ─────────────────────────────────────
Write-Step "啟動 NexusMind 服務..."
docker compose `
    -f "docker-compose.yml" `
    -f "docker-compose.windows.yml" `
    up -d

if ($LASTEXITCODE -ne 0) {
    Write-Fail "服務啟動失敗，查看 logs："
    Write-Host "  docker compose -f docker-compose.yml -f docker-compose.windows.yml logs" -ForegroundColor Yellow
    exit 1
}

# ── Step 8: 等待健康檢查 ─────────────────────────────────
Write-Step "等待服務就緒（最多 60 秒）..."
$maxWait = 60
$waited = 0
$allHealthy = $false

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 5
    $waited += 5

    $markerOK    = (docker inspect nexusmind-marker    --format "{{.State.Health.Status}}" 2>$null) -eq "healthy"
    $lightragOK  = (docker inspect nexusmind-lightrag  --format "{{.State.Health.Status}}" 2>$null) -eq "healthy"
    $skillOK     = (docker inspect nexusmind-skill-executor --format "{{.State.Health.Status}}" 2>$null) -eq "healthy"

    Write-Host "  ${waited}s - marker:$(if($markerOK){'✅'}else{'⏳'})  lightrag:$(if($lightragOK){'✅'}else{'⏳'})  skill-executor:$(if($skillOK){'✅'}else{'⏳'})" -ForegroundColor Gray

    if ($markerOK -and $lightragOK -and $skillOK) {
        $allHealthy = $true
        break
    }
}

if (-not $allHealthy) {
    Write-Warn "部分服務可能尚未就緒，請檢查 logs"
} else {
    Write-OK "所有服務健康！"
}

# ── Step 9: 完成報告 ─────────────────────────────────────
Write-Host "`n" + "="*55 -ForegroundColor Green
Write-Host "  🎉 NexusMind 已啟動！" -ForegroundColor Green
Write-Host "="*55 -ForegroundColor Green
Write-Host ""
Write-Host "  🌐 主應用：  http://localhost:3000" -ForegroundColor White
Write-Host "  🔧 Marker：  http://localhost:8001/health" -ForegroundColor White
Write-Host "  🧠 LightRAG：http://localhost:8002/health" -ForegroundColor White
Write-Host "  ⚙️  Skill：   http://localhost:8003/health" -ForegroundColor White
Write-Host ""
Write-Host "  常用指令：" -ForegroundColor Gray
Write-Host "    查看 logs：   .\scripts\windows-setup.ps1 -Logs" -ForegroundColor Gray
Write-Host "    停止服務：   .\scripts\windows-setup.ps1 -Down" -ForegroundColor Gray
Write-Host "    重新建構：   .\scripts\windows-setup.ps1" -ForegroundColor Gray
Write-Host ""

# 自動開啟瀏覽器
$openBrowser = Read-Host "要現在開啟瀏覽器嗎？(Y/n)"
if ($openBrowser -ne "n" -and $openBrowser -ne "N") {
    Start-Process "http://localhost:3000"
}
