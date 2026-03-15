import { generateText, type ModelMessage } from "ai";
import { TelegramUpdateSchema } from "@/lib/telegram/types";
import type { TelegramMessage } from "@/lib/telegram/types";
import {
  verifyWebhookSecret,
  getOrCreateTelegramUser,
} from "@/lib/telegram/auth";
import { sendMessage, sendChatAction, downloadFileAsBuffer } from "@/lib/telegram/bot";
import { verifyAndLink } from "@/lib/telegram/link";
import { getProvider } from "@/lib/ai/providers";
import { createAdminClient } from "@/lib/supabase/server";
import { executeAdaptiveRAG } from "@/lib/rag/adaptive-rag";
import {
  truncateContext,
  MAX_CONTEXT_CHARS_TELEGRAM,
} from "@/lib/rag/context-truncation";
import { DEFAULT_PERSONA } from "@/lib/crayon/prompts";
import { formatCitationsForTelegram } from "@/lib/chat/format-citations";
import { detectFileType, parseFile } from "@/lib/parsers/file-parser";
import type { SupportedFileType } from "@/lib/parsers/file-parser";

export const maxDuration = 120;

// 固定回傳 200 的 helper（避免 Telegram retry storms）
function ok() {
  return Response.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    // 1. 驗證 Webhook Secret
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (!(await verifyWebhookSecret(secretHeader))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 解析 Telegram Update
    const body = await req.json();
    const parsed = TelegramUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return ok();
    }

    const update = parsed.data;
    const message = update.message;

    // 3. 忽略非私聊 & 完全空的訊息（無文字、無檔案）
    if (!message || message.chat.type !== "private") {
      return ok();
    }

    const hasFile = !!(message.document || message.photo?.length || message.audio || message.video || message.voice);
    const userText = (message.text ?? message.caption ?? "").trim();

    // 4. 忽略既無文字也無檔案的訊息
    if (!userText && !hasFile) {
      return ok();
    }

    const chatId = message.chat.id;

    // 5. 處理 /start 指令（含 deep link 綁定）
    if (userText === "/start") {
      await sendMessage(
        chatId,
        "歡迎使用 NexusMind！\n\n直接傳送文字訊息，我會用 AI + 知識庫來回覆你。\n\n**可用指令：**\n/newchat - 開始新對話\n/link <綁定碼> - 綁定 NexusMind 帳號\n/unlink - 解除帳號綁定",
      );
      return ok();
    }

    // 5a. Deep Link 綁定 (/start link_CODE)
    if (userText.startsWith("/start link_")) {
      const code = userText.replace("/start link_", "").trim();
      await sendChatAction(chatId);
      if (!code) {
        await sendMessage(chatId, "綁定碼不能為空。");
        return ok();
      }
      const linkResult = await verifyAndLink(code, chatId);
      if (linkResult.success) {
        await sendMessage(
          chatId,
          "帳號綁定成功！現在你可以透過 Telegram 存取你的 NexusMind 知識庫了。",
        );
      } else {
        await sendMessage(chatId, `綁定失敗：${linkResult.error}`);
      }
      return ok();
    }

    // 5b. 手動綁定 (/link CODE)
    if (userText.startsWith("/link")) {
      const code = userText.replace("/link", "").trim();
      await sendChatAction(chatId);
      if (!code) {
        await sendMessage(
          chatId,
          "請提供綁定碼。\n\n用法：/link NM-XXXXXX\n\n在 NexusMind 設定頁的「整合服務」產生綁定碼。",
        );
        return ok();
      }
      const linkResult = await verifyAndLink(code, chatId);
      if (linkResult.success) {
        await sendMessage(
          chatId,
          "帳號綁定成功！現在你可以透過 Telegram 存取你的 NexusMind 知識庫了。",
        );
      } else {
        await sendMessage(chatId, `綁定失敗：${linkResult.error}`);
      }
      return ok();
    }

    // 5c. 解除綁定 (/unlink)
    if (userText === "/unlink") {
      await sendChatAction(chatId);
      const supabaseAdmin = createAdminClient();
      const { data: binding } = await supabaseAdmin
        .from("telegram_users")
        .select("id")
        .eq("telegram_chat_id", chatId)
        .maybeSingle();
      if (!binding) {
        await sendMessage(chatId, "目前沒有綁定任何 NexusMind 帳號。");
      } else {
        await supabaseAdmin
          .from("telegram_users")
          .delete()
          .eq("telegram_chat_id", chatId);
        await sendMessage(
          chatId,
          "已解除帳號綁定。下次傳送訊息時會自動建立臨時帳號。使用 /link 可重新綁定。",
        );
      }
      return ok();
    }

    // 6. 顯示「正在輸入」
    await sendChatAction(chatId);

    // 7. 取得/建立用戶映射
    const { userId, conversationId } = await getOrCreateTelegramUser(
      chatId,
      message.from?.first_name,
      message.from?.username,
    );

    const supabase = createAdminClient();

    // 7a. 處理檔案訊息：下載 + 解析
    let fileContent = "";
    let fileInfo = "";
    if (hasFile) {
      const extracted = await extractFileContent(message);
      fileContent = extracted.content;
      fileInfo = extracted.info;
      if (extracted.error) {
        await sendMessage(chatId, extracted.error);
        if (!userText) return ok(); // 沒有附帶文字，就不往下走
      }
    }

    // 8. 處理 /newchat 指令
    if (userText === "/newchat") {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          user_id: userId,
          title: "Telegram 新對話",
          model: "gemini-flash",
        })
        .select("id")
        .single();

      if (newConv) {
        await supabase
          .from("telegram_users")
          .update({
            default_conversation_id: newConv.id,
            updated_at: new Date().toISOString(),
          })
          .eq("telegram_chat_id", chatId);

        await sendMessage(chatId, "已建立新對話！請開始提問。");
      }

      return ok();
    }

    // 9. 存入用戶訊息（含檔案內容）
    const fullUserContent = buildUserContent(userText, fileContent, fileInfo);
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: fullUserContent,
    });

    // 10. 載入對話歷史（最近 10 則）
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(10);

    const messages: ModelMessage[] = (history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // 11. 執行 Adaptive RAG
    let knowledgeContext = "";
    let ragCitations: string[] = [];
    try {
      const ragResult = await executeAdaptiveRAG({
        userQuery: userText || "分析以下檔案內容",
        conversationHistory: messages,
        userId,
        supabase,
      });

      console.info("[Telegram RAG]", {
        method: ragResult?.retrievalMethod,
        docs: ragResult?.relevantDocIds?.length ?? 0,
        citations: ragResult?.citationTitles,
        ctxLen: ragResult?.knowledgeContext?.length ?? 0,
        score: ragResult?.metadata?.relevanceScore,
      });

      if (ragResult?.knowledgeContext) {
        knowledgeContext = truncateContext(
          ragResult.knowledgeContext,
          MAX_CONTEXT_CHARS_TELEGRAM,
        );
        ragCitations = ragResult.citationTitles ?? [];
      }
    } catch (ragError) {
      console.error(
        "[Telegram RAG] FAILED:",
        ragError instanceof Error ? ragError.message : ragError,
      );
    }

    // 12. 組建 System Prompt
    const now = new Date();
    const dateStr = now.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Taipei",
    });

    const systemPrompt = [
      `[SYSTEM DATE] 今天是 ${dateStr}。`,
      "",
      DEFAULT_PERSONA.systemPrompt,
      "",
      "Telegram 平台注意事項:",
      "- 回覆盡量控制在 2000 字元以內，適合手機閱讀",
      "- Telegram 支援 **粗體**、`程式碼`、```程式碼區塊```",
      "- 不支援 Markdown 標題（#）和表格，改用條列和粗體",
      knowledgeContext ? `\n知識庫參考資料:\n${knowledgeContext}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // 13. 呼叫 Gemini generateText（非串流）
    // maxOutputTokens 需足夠大：gemini-3-flash-preview 的 thinking tokens
    // 和 text tokens 共享此預算（thinking 可能用 2000+ tokens）
    console.info("[Telegram LLM] systemPrompt length:", systemPrompt.length);
    let aiResponse = "";
    try {
      const result = await generateText({
        model: getProvider("gemini-flash"),
        system: systemPrompt,
        messages,
        maxOutputTokens: 16384,
      });
      aiResponse = result.text;
      console.info("[Telegram LLM]", {
        responseLen: aiResponse?.length ?? 0,
        finishReason: result.finishReason,
        usage: result.usage,
        warnings: result.warnings,
        hasText: !!aiResponse,
      });
    } catch (llmError) {
      console.error(
        "[Telegram LLM] FAILED:",
        llmError instanceof Error ? llmError.message : llmError,
      );
    }

    // 14. 存入 AI 回覆
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: aiResponse,
    });

    // 15. 發送回覆到 Telegram（附帶 RAG 引用來源）
    let reply = aiResponse || "抱歉，我無法生成回覆。請再試一次。";
    reply += formatCitationsForTelegram(ragCitations);
    await sendMessage(chatId, reply);

    return ok();
  } catch (error) {
    // 記錄錯誤但固定回傳 200，防止 Telegram 瘋狂重試
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[Telegram Webhook] Error:", errMsg);
    return ok();
  }
}

// ── File handling helpers ─────────────────────────

const TELEGRAM_FILE_SIZE_LIMIT = 20 * 1024 * 1024; // Telegram Bot API 限制 20MB
const PARSEABLE_MIME_PREFIXES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-excel",
  "text/",
];

/**
 * 從 Telegram 訊息提取檔案的 file_id 和描述資訊。
 */
function getFileIdFromMessage(
  message: TelegramMessage,
): { fileId: string; fileName: string; mimeType: string; fileSize: number } | null {
  if (message.document) {
    return {
      fileId: message.document.file_id,
      fileName: message.document.file_name ?? "document",
      mimeType: message.document.mime_type ?? "application/octet-stream",
      fileSize: message.document.file_size ?? 0,
    };
  }
  if (message.photo?.length) {
    // 取最大解析度的 photo
    const largest = message.photo[message.photo.length - 1];
    return {
      fileId: largest.file_id,
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      fileSize: largest.file_size ?? 0,
    };
  }
  if (message.audio) {
    return {
      fileId: message.audio.file_id,
      fileName: message.audio.file_name ?? "audio",
      mimeType: message.audio.mime_type ?? "audio/mpeg",
      fileSize: message.audio.file_size ?? 0,
    };
  }
  if (message.video) {
    return {
      fileId: message.video.file_id,
      fileName: message.video.file_name ?? "video",
      mimeType: message.video.mime_type ?? "video/mp4",
      fileSize: message.video.file_size ?? 0,
    };
  }
  if (message.voice) {
    return {
      fileId: message.voice.file_id,
      fileName: "voice.ogg",
      mimeType: message.voice.mime_type ?? "audio/ogg",
      fileSize: message.voice.file_size ?? 0,
    };
  }
  return null;
}

/**
 * 下載並解析 Telegram 檔案內容。
 * 僅解析支援的文件類型（PDF, DOCX, PPTX, XLSX, TXT, MD）。
 * 圖片/音訊/影片只回傳檔案資訊，不嘗試解析。
 */
async function extractFileContent(
  message: TelegramMessage,
): Promise<{ content: string; info: string; error?: string }> {
  const fileData = getFileIdFromMessage(message);
  if (!fileData) {
    return { content: "", info: "", error: "無法辨識檔案類型。" };
  }

  const { fileId, fileName, mimeType, fileSize } = fileData;
  const fileInfo = `[檔案: ${fileName} (${mimeType}, ${formatSize(fileSize)})]`;

  // 檢查檔案大小（Telegram Bot API 限制 20MB）
  if (fileSize > TELEGRAM_FILE_SIZE_LIMIT) {
    return {
      content: "",
      info: fileInfo,
      error: `檔案 ${fileName} 太大（${formatSize(fileSize)}），Telegram Bot API 僅支援下載 20MB 以下的檔案。`,
    };
  }

  // 圖片、音訊、影片：目前不解析內容，只回傳檔案資訊
  const isParseableType = PARSEABLE_MIME_PREFIXES.some((p) => mimeType.startsWith(p));
  if (!isParseableType) {
    return {
      content: "",
      info: fileInfo,
      error: `已收到檔案 ${fileName}，但目前僅支援解析文件類型（PDF、DOCX、PPTX、XLSX、TXT、MD）。`,
    };
  }

  // 下載檔案
  const downloaded = await downloadFileAsBuffer(fileId);
  if (!downloaded) {
    return {
      content: "",
      info: fileInfo,
      error: `無法下載檔案 ${fileName}，請稍後再試。`,
    };
  }

  // 偵測檔案類型並解析
  const detectedType: SupportedFileType | null = detectFileType(mimeType, fileName);
  if (!detectedType) {
    return {
      content: "",
      info: fileInfo,
      error: `不支援的檔案格式：${mimeType}`,
    };
  }

  try {
    const parsed = await parseFile(downloaded.buffer, detectedType);
    const text = parsed.text.trim();
    if (!text) {
      return {
        content: "",
        info: fileInfo,
        error: `已收到 ${fileName}，但無法從中提取文字內容（可能是掃描件或圖片型文件）。`,
      };
    }
    // 截斷過長的檔案內容（避免超出 LLM context）
    const maxChars = 30000;
    const truncated = text.length > maxChars
      ? text.slice(0, maxChars) + `\n\n[... 檔案內容過長，已截斷至 ${maxChars} 字元]`
      : text;

    console.info("[Telegram File]", {
      fileName,
      mimeType,
      detectedType,
      originalLen: text.length,
      truncatedLen: truncated.length,
    });

    return { content: truncated, info: fileInfo };
  } catch (parseError) {
    console.error("[Telegram File] Parse error:", parseError);
    return {
      content: "",
      info: fileInfo,
      error: `解析檔案 ${fileName} 時發生錯誤，請確認檔案格式正確。`,
    };
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "未知大小";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * 組合用戶文字和檔案內容為完整訊息。
 */
function buildUserContent(
  userText: string,
  fileContent: string,
  fileInfo: string,
): string {
  const parts: string[] = [];
  if (fileInfo) parts.push(fileInfo);
  if (fileContent) parts.push(`---\n${fileContent}\n---`);
  if (userText) parts.push(userText);
  return parts.join("\n\n") || userText;
}
