---
name: block-docker-compose-restart
enabled: true
event: bash
pattern: docker\s+compose\s+restart
action: block
---

⛔ **`docker compose restart` 不會重新載入 env vars！**

必須使用完整的 stop → rm → up 流程：
```bash
docker compose stop <service> && docker compose rm -f <service> && docker compose up -d <service>
```

> 詳見 CLAUDE.md NAS 部署流程。
