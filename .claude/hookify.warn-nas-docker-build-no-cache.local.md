---
name: warn-nas-docker-build-no-cache
enabled: true
event: bash
conditions:
  - field: command
    operator: regex_match
    pattern: docker\s+build
  - field: command
    operator: not_contains
    pattern: --no-cache
---

⚠️ **NAS Docker Build 缺少 `--no-cache`！**

NAS 的 Docker 有快取問題，即使原始碼已變更仍可能使用舊的 build 層。

**必須加 `--no-cache`：**
```bash
docker build --no-cache --build-arg ... -t nexusmind-app:latest .
```

> 不加此旗標可能導致部署的是舊程式碼，且難以察覺。
