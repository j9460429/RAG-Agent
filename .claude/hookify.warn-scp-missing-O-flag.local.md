---
name: warn-scp-missing-O-flag
enabled: true
event: bash
conditions:
  - field: command
    operator: regex_match
    pattern: scp\s+(?!.*-O).*192\.168\.0\.7
---

⚠️ **SCP 到 NAS 缺少 `-O` flag！**

NAS 不支援 SFTP subsystem，SCP 必須加上 `-O` flag：
```bash
scp -O <file> skykyo520@192.168.0.7:/path/
```

> 詳見 CLAUDE.md：「SCP 需要 `-O` flag（NAS 不支援 SFTP subsystem）」
