# NexusMind - Windows 安裝指南

## 前置需求

| 工具 | 版本 | 下載 |
|------|------|------|
| Docker Desktop for Windows | 最新版 | https://www.docker.com/products/docker-desktop/ |
| Git for Windows | 最新版 | https://git-scm.com/download/win |
| WSL2 | 已啟用 | `wsl --install`（PowerShell 以系統管理員執行） |

### Docker Desktop 設定（重要！）

1. 開啟 Docker Desktop → Settings
2. **General** → 勾選 "Use the WSL 2 based engine"
3. **Resources → Memory** → 調高到至少 **6GB**（專案需要 ~4.5GB）
4. **Advanced** → 勾選 "Allow the default Docker socket to be used (requires password)"
5. 點 "Apply & Restart"

---

## 安裝步驟

### 1. Clone 專案

```powershell
# 在 PowerShell 中執行
git clone https://github.com/j9460429/RAG-Agent.git
cd RAG-Agent
```

### 2. 設定環境變數

```powershell
# 複製範本
copy .env.example .env.production

# 用記事本開啟並填入實際值
notepad .env.production
```

**必填的變數：**

```env
NEXT_PUBLIC_SUPABASE_URL=https://lplvtpfkawreflznxobf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_anon_key
SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key
SUPABASE_SERVER_URL=https://lplvtpfkawreflznxobf.supabase.co
GOOGLE_GENERATIVE_AI_API_KEY=你的_gemini_key
BOT_TOKEN_ENCRYPTION_KEY=你的_64字元_hex_金鑰
K_MASTER_KEY=你的_64字元_hex_金鑰（與上面相同）
TELEGRAM_BOT_TOKEN=你的_telegram_bot_token
```

> ⚠️ 注意：`.env.production` 裡的 API Keys 直接從 Mac 複製過來用，**不需要重新申請**。

### 3. 一鍵啟動

```powershell
# 允許執行 PowerShell 腳本（首次需要）
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 執行安裝腳本（首次約需 5-10 分鐘）
.\scripts\windows-setup.ps1
```

### 4. 開啟應用

瀏覽器前往：**http://localhost:3000**

---

## 常用指令

```powershell
# 啟動（已 build 過的情況，跳過 build 加快速度）
.\scripts\windows-setup.ps1 -SkipBuild

# 查看 logs
.\scripts\windows-setup.ps1 -Logs

# 停止服務
.\scripts\windows-setup.ps1 -Down

# 手動方式（完整）
docker compose -f docker-compose.yml -f docker-compose.windows.yml up -d
docker compose -f docker-compose.yml -f docker-compose.windows.yml down
docker compose -f docker-compose.yml -f docker-compose.windows.yml logs -f
```

---

## Telegram Bot Webhook 設定（可選）

Telegram Bot 需要公開 URL 才能收訊息，在 Windows 上用 ngrok：

### 安裝 ngrok

```powershell
# 用 winget 安裝（Windows 11 內建）
winget install ngrok

# 或下載：https://ngrok.com/download
```

### 啟動 ngrok

```powershell
# 開一個新的 PowerShell 視窗
ngrok http 3000
```

### 設定 Webhook

```powershell
# 把 ngrok 給你的 URL 填進去（每次重啟 ngrok 都要重設）
$ngrokUrl = "https://xxxx-xxx.ngrok-free.app"
$botToken = "你的_TELEGRAM_BOT_TOKEN"

Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/setWebhook" `
  -Method Post `
  -Body @{ url = "$ngrokUrl/api/telegram/webhook" }
```

---

## 常見問題

### ❌ skill-executor 無法啟動（Docker socket 錯誤）

**症狀：** `permission denied while trying to connect to the Docker daemon socket`

**解法：**
1. Docker Desktop → Settings → Advanced
2. 勾選 **"Allow the default Docker socket to be used"**
3. Apply & Restart Docker Desktop

### ❌ 記憶體不足，容器被 kill

**症狀：** `Exited (137)` 或容器一直重啟

**解法：**
- Docker Desktop → Settings → Resources → Memory → 調高到 6-8GB

### ❌ Build 失敗：NEXT_PUBLIC_SUPABASE_URL is empty

**解法：** 確認 `.env.production` 中的 `NEXT_PUBLIC_SUPABASE_URL` 已正確填寫

### ❌ Cannot connect to the Docker daemon

**解法：** 確認 Docker Desktop 已啟動且 WSL2 backend 已啟用

### ❌ LightRAG 啟動緩慢

LightRAG 首次啟動需要下載 Python 套件，耐心等待 healthcheck（`start_period: 30s`）。

---

## 架構說明

```
Windows PC (Docker Desktop + WSL2)
├── nexusmind-app        :3000  (Next.js)
├── nexusmind-marker     :8001  (Python - 文件解析)
├── nexusmind-lightrag   :8002  (Python - GraphRAG 知識庫)
└── nexusmind-skill-executor :8003  (Node.js - 技能執行)

Supabase Cloud (remote)
└── lplvtpfkawreflznxobf.supabase.co  (DB, Auth, Storage)
```

所有 Docker 容器透過內部 Docker 網路互連，Supabase 使用雲端版本（不需本地安裝）。
