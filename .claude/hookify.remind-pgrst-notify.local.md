---
name: remind-pgrst-notify
enabled: true
event: bash
pattern: (CREATE\s+TABLE|ALTER\s+TABLE|GRANT\s+.*TO\s+)
action: warn
---

⚠️ **DB 結構變更偵測**

你剛執行了資料庫結構變更。請確認已執行：
```sql
NOTIFY pgrst, 'reload schema';
```
不做這步，PostgREST REST API 會**靜默失敗**（不報錯但查不到新欄位/表）。
