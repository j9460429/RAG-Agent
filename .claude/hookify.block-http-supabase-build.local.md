---
name: block-http-supabase-build
enabled: true
event: bash
action: block
conditions:
  - field: command
    operator: regex_match
    pattern: docker\s+(build|buildx\s+build)
  - field: command
    operator: regex_match
    pattern: NEXT_PUBLIC_SUPABASE_URL=http://
---

**BLOCKED: Docker build 使用了 HTTP Supabase URL！**

你正在用 `http://` 建置 Docker image，這會導致 Mixed Content 錯誤。

**正確 URL（CLAUDE.md 第 32 行）：**
```
--build-arg NEXT_PUBLIC_SUPABASE_URL=https://supabase.showmico888.net
```

**禁止使用的 URL：**
- `http://100.90.158.61:8000`（Tailscale HTTP）
- `http://192.168.0.7:54321`（LAN HTTP）
- 任何 `http://` 開頭的 Supabase URL

**原因：** 網站透過 Cloudflare 以 HTTPS 提供服務，瀏覽器會阻擋從 HTTPS 頁面發出的 HTTP 請求（Mixed Content）。
