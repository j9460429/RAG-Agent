---
name: block-skip-e2e-verification
enabled: true
event: stop
pattern: .*
action: block
---

🚫 **停止！宣告完成前必須完成 E2E 驗證**

`verification-before-completion` skill 規定：**沒有新鮮驗證證據不得宣告完成。**

請確認以下任一項已完成：
- [ ] 使用 `mcp__chrome-devtools__*` 實際開啟網頁測試功能
- [ ] 執行 `npx playwright test` 並取得通過截圖
- [ ] 在瀏覽器手動操作並確認功能正常

**本次 session 教訓：** 曾宣告 YouTube 匯入功能完成，但用戶追問「你有按技能要求實際開啟網頁測試嗎」才發現未執行實際瀏覽器驗證。

如需登入測試帳號，請先用 claude-mem search('測試帳號') 查詢。
