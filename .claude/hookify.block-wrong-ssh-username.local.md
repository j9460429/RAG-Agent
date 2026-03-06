---
name: block-wrong-ssh-username
enabled: true
event: bash
pattern: (ssh|sshpass).*show@192\.168\.0\.7
action: block
---

⛔ **SSH 用戶名錯誤！**

你用了 `show@192.168.0.7`，正確的用戶名是 **`skykyo520`**！

正確指令：
```bash
sshpass -p 'zZ22633502' ssh skykyo520@192.168.0.7
```

> 這個錯誤已犯多次，請務必使用 `skykyo520`。詳見 MEMORY.md。
