---
name: enforce-gemini-model-versions
enabled: true
event: file
action: block
conditions:
  - field: new_text
    operator: regex_match
    pattern: gemini-(?!3-flash-preview|3\.1-pro-preview|embedding-001|flash[^-]|pro[^-])[a-z0-9.\-]+
---

⚠️ **偵測到非標準 Gemini 模型版本！**

本專案統一使用以下 Google 模型：

| 用途 | 模型 ID |
|------|---------|
| **Flash（快速/低成本）** | `gemini-3-flash-preview` |
| **Pro（深度推理/長輸出）** | `gemini-3.1-pro-preview` |
| **Embedding** | `gemini-embedding-001` |

**禁止使用的舊版模型**：`gemini-2.0-flash`、`gemini-2.5-flash`、`gemini-2.0-flash-exp` 等

請將模型改為上述標準版本之一。
