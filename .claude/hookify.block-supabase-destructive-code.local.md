---
name: block-supabase-destructive-code
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.(ts|tsx|js|jsx|sql)$
  - field: new_text
    operator: regex_match
    pattern: (\.delete\(\)|DELETE\s+FROM|DROP\s+TABLE|TRUNCATE|supabase\.auth\.admin\.(updateUserById|deleteUser|update)|auth\.users\s+SET\s+.*password)
---

**Supabase 破壞性程式碼已被阻擋**

偵測到在程式碼中寫入可能破壞 Supabase 資料或修改使用者密碼的操作。

**被阻擋的模式：**
- Supabase client 刪除操作
- SQL 破壞性語句
- auth.admin 管理員操作
- 修改 auth.users 密碼欄位

**正確的做法：**
- 使用 soft delete 模式（設定 deleted_at 時間戳）
- 密碼變更由使用者自行操作
- 資料刪除必須在 Supabase Dashboard 手動執行