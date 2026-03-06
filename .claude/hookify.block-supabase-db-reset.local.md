---
name: block-supabase-db-reset
enabled: true
event: bash
pattern: supabase\s+db\s+reset
action: block
---

⟔ 禁止使用 supabase db reset ！會清除所有購料！

這會刪除所有用戶、文件、對話記錄等。

安全替代方案：
```bash
supabase migration up --local
```

> 只跑新的 migration，保畘現有購料。詳覊 security.md。