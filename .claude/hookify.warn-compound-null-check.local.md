---
name: warn-compound-null-check
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.(ts|tsx)$
  - field: new_text
    operator: regex_match
    pattern: \?\.\w+\s*&&\s*\w+\?\.\w+
action: warn
---

⚠️ **偵測到複合 optional chaining 檢查（`a?.x && a?.y`）**

這種模式可能遺漏「只有部分欄位有值」的情況：

**問題範例**：
```typescript
// 綁定只寫了 user_id，default_conversation_id 為 null
if (existing?.user_id && existing?.default_conversation_id) {
  // ← 永遠跳過！即使 user_id 有值
}
```

**建議**：
- 確認每個條件是否真的都是必要的
- 考慮分開處理：先檢查主鍵欄位，缺少的欄位可以自動補建
- 用 `||` 提供 fallback 而非用 `&&` 全部要求
