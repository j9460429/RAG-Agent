---
name: block-supabase-password-change
enabled: true
event: bash
action: block
pattern: (supabase.*auth.*update|UPDATE\s+auth\.users\s+SET\s+.*(password|encrypted_password)|auth\.admin\.updateUserById|\.auth\.admin\.update|updateUser.*password|reset.*password.*supabase)
---

**Supabase 使用者密碼變更已被阻擋**

偵測到試圖修改 Supabase 使用者密碼的操作。

**禁止的操作：**
- 透過 Supabase CLI 修改 auth users
- 直接 SQL UPDATE auth.users 密碼欄位
- 透過 Admin API 更新使用者密碼

**正確做法：**
- 使用者應自行透過「忘記密碼」流程重設
- 必要時由管理員在 Supabase Dashboard 手動操作
- 不得由 Claude Code 自動執行密碼變更
