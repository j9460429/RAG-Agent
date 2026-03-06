---
name: block-supabase-data-deletion
enabled: true
event: bash
action: block
pattern: (supabase\s+db\s+reset|DELETE\s+FROM\s+|DROP\s+TABLE|DROP\s+SCHEMA|TRUNCATE\s+|\.delete\(\)|\.remove\(\).*supabase|supabase.*\.delete|rpc.*delete|\.from\(.*\)\.delete)
---

**Supabase 資料刪除操作已被阻擋**

偵測到可能刪除 Supabase 資料的操作。

**禁止的操作：**
- `supabase db reset`（會清除所有資料）
- SQL `DELETE FROM` / `DROP TABLE` / `TRUNCATE`
- Supabase client `.delete()` 操作

**安全替代方案：**
- Migration 用 `npx supabase migration up --local`（只跑新的，保留資料）
- 需要刪除特定記錄時，先在 Supabase Dashboard 確認
- 使用 soft delete（設 deleted_at 欄位）而非實際刪除
- 任何資料刪除操作必須由使用者在 Dashboard 手動執行
