---
name: warn-webhook-secret-token
enabled: true
event: bash
pattern: setWebhook|set_webhook|registerWebhook
action: warn
---

⚠️ **Telegram Webhook 註冊 — 請確認帶 secret_token！**

當環境變數 `TELEGRAM_WEBHOOK_SECRET` 已設定時，`setWebhook` API 呼叫 **必須** 包含 `secret_token` 參數。

**否則**：Telegram 不會在 webhook request 中帶 `X-Telegram-Bot-Api-Secret-Token` header → `verifyWebhookSecret` 驗證失敗 → 所有 webhook 都回 401。

**正確呼叫**：
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=<WEBHOOK_URL>" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```
