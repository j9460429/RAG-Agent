import { YoutubeTranscript } from "youtube-transcript-plus";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getVideoMetadata, buildVideoUrl } from "./youtube-utils";
import { computeHash } from "./content-fetcher";

export interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
  lang?: string;
}

export interface YouTubeContent {
  title: string;
  channel: string;
  thumbnailUrl: string;
  transcript: string;
  hash: string;
  source: "subtitle" | "gemini-audio";
  videoUrl: string;
}

const MAX_TRANSCRIPT_LENGTH = 50000;

/**
 * Main entry: fetch YouTube video content (three-layer fallback)
 */
export async function fetchVideoContent(
  videoId: string,
): Promise<YouTubeContent> {
  const metadata = await getVideoMetadata(videoId);
  const title = metadata?.title ?? `YouTube Video ${videoId}`;
  const channel = metadata?.author_name ?? "未知頻道";
  const thumbnailUrl = metadata?.thumbnail_url ?? "";
  const videoUrl = buildVideoUrl(videoId);

  let l1Reason = "";
  let l2Reason = "";

  // L1: subtitle extraction
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (segments && segments.length > 0) {
      const transcript = formatTranscriptToMarkdown(segments, title, channel);
      const hash = await computeHash(transcript);
      return {
        title,
        channel,
        thumbnailUrl,
        transcript: transcript.slice(0, MAX_TRANSCRIPT_LENGTH),
        hash,
        source: "subtitle",
        videoUrl,
      };
    }
    l1Reason = "no subtitle segments returned";
  } catch (l1Error) {
    l1Reason = l1Error instanceof Error ? l1Error.message : String(l1Error);
    console.error("[YouTube L1 subtitle]", l1Reason);
  }

  // L2: Gemini API audio transcription
  try {
    const transcript = await transcribeWithGemini(videoId, title, channel);
    const hash = await computeHash(transcript);
    return {
      title,
      channel,
      thumbnailUrl,
      transcript: transcript.slice(0, MAX_TRANSCRIPT_LENGTH),
      hash,
      source: "gemini-audio",
      videoUrl,
    };
  } catch (l2Error) {
    l2Reason = l2Error instanceof Error ? l2Error.message : String(l2Error);
    console.error("[YouTube L2 gemini]", l2Reason);
  }

  // L3: both layers failed — include reasons for debugging
  throw new Error(
    `無法取得影片內容：${title}（L1: ${l1Reason}; L2: ${l2Reason}）`,
  );
}

const GEMINI_MODELS = [
  { name: "gemini-3.1-pro-preview", timeout: 60_000 }, // Primary: 65k output, fast fail to flash
  { name: "gemini-3-flash-preview", timeout: 120_000 }, // Fallback: more available, longer timeout
] as const;

function isRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /\b(503|429|500|overloaded|unavailable|rate.?limit|high demand|abort|timeout)/i.test(
    msg,
  );
}

/**
 * L2: Gemini API direct YouTube URL audio transcription
 * Tries pro model first, falls back to flash on transient errors (503/429)
 */
async function transcribeWithGemini(
  videoId: string,
  title: string,
  channel: string,
): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY 未設定");

  const genAI = new GoogleGenerativeAI(apiKey);
  const videoUrl = buildVideoUrl(videoId);

  const prompt = [
    {
      fileData: {
        mimeType: "video/mp4" as const,
        fileUri: videoUrl,
      },
    },
    {
      text: `請將這個 YouTube 影片的語音內容完整轉錄為文字。
要求：
1. 使用影片的原始語言轉錄
2. 盡量保留完整的語音內容
3. 適當分段（每段 2-3 句）
4. 每段開頭標注大約的時間戳（格式：[MM:SS]）
5. 不要翻譯，保持原語言

輸出格式：
# ${title}
**頻道:** ${channel}

[00:00] 第一段內容...
[00:30] 第二段內容...`,
    },
  ];

  let lastError: unknown;

  for (const modelCfg of GEMINI_MODELS) {
    const model = genAI.getGenerativeModel(
      {
        model: modelCfg.name,
        generationConfig: {
          maxOutputTokens: 65536,
        },
      },
      {
        timeout: modelCfg.timeout,
      },
    );

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (!text || text.length < 50) {
        throw new Error("Gemini 轉錄結果過短");
      }
      return text;
    } catch (error) {
      lastError = error;
      if (isRetryableError(error) && modelCfg !== GEMINI_MODELS.at(-1)) {
        console.error(
          `[YouTube L2] ${modelCfg.name} failed (retryable), trying next model`,
          error instanceof Error ? error.message : error,
        );
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

/**
 * Format transcript segments to Markdown
 */
export function formatTranscriptToMarkdown(
  segments: TranscriptSegment[],
  title: string,
  channel: string,
): string {
  const lines: string[] = [`# ${title}`, `**頻道:** ${channel}`, ""];

  for (const seg of segments) {
    const ts = formatTimestamp(seg.offset);
    lines.push(`[${ts}] ${seg.text}`);
  }

  return lines.join("\n");
}

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export interface TimeGroup {
  label: string;
  segments: TranscriptSegment[];
}

/**
 * Group transcript segments into time intervals
 */
export function groupSegmentsByTime(
  segments: TranscriptSegment[],
  intervalMs: number = 300000, // 5 minutes default
): TimeGroup[] {
  if (segments.length === 0) return [];

  const maxOffset = Math.max(...segments.map((s) => s.offset));
  const groupCount = Math.floor(maxOffset / intervalMs) + 1;

  const groups: TimeGroup[] = [];

  for (let i = 0; i < groupCount; i++) {
    const startMs = i * intervalMs;
    const endMs = (i + 1) * intervalMs;
    const matching = segments.filter(
      (s) => s.offset >= startMs && s.offset < endMs,
    );

    if (matching.length > 0) {
      const startLabel = formatTimestamp(startMs);
      const endLabel = formatTimestamp(endMs);
      groups.push({
        label: `${startLabel} - ${endLabel}`,
        segments: matching,
      });
    }
  }

  return groups;
}

/**
 * Build structured content with summary and segmented transcript
 */
export function buildStructuredContent(
  segments: TranscriptSegment[],
  title: string,
  channel: string,
  source: "subtitle" | "gemini-audio",
  summary: string,
): string {
  const sourceLabel = source === "gemini-audio" ? "語音轉錄" : "字幕";

  const lines: string[] = [
    `# ${title}`,
    `**頻道:** ${channel}`,
    `**來源:** ${sourceLabel}`,
    "",
    "## 摘要",
    "",
    summary,
    "",
    "## 逐字稿",
    "",
  ];

  const groups = groupSegmentsByTime(segments);

  if (groups.length <= 1) {
    // Short video — no group headers
    for (const seg of segments) {
      const ts = formatTimestamp(seg.offset);
      lines.push(`[${ts}] ${seg.text}`);
    }
  } else {
    // Long video — add time range headers
    for (const group of groups) {
      lines.push(`### ${group.label}`);
      lines.push("");
      for (const seg of group.segments) {
        const ts = formatTimestamp(seg.offset);
        lines.push(`[${ts}] ${seg.text}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * AI-powered content structuring for YouTube transcripts
 */
export async function processYouTubeContentWithAI(
  transcript: string,
  title: string,
): Promise<string> {
  const { generateText } = await import("ai");
  const { getProvider } = await import("@/lib/ai/providers");

  const truncated = transcript.slice(0, 30000);

  const { text } = await generateText({
    model: getProvider("gemini-pro"),
    prompt: `你是專業知識報告撰寫專家。以下是 YouTube 影片「${title}」的逐字稿。
請將其轉化為一份**詳盡的知識報告**，而非簡短摘要。

## 報告要求

### 結構
- **標題**：以影片主題為基礎的報告標題
- **概述**：2-3 段完整說明影片核心主題與背景脈絡
- **詳細內容**：按主題分章節，每個章節需包含：
  - 完整的論述與解說（不是條列摘要）
  - 具體的例子、案例、數據
  - 講者的觀點分析與推論過程
  - 相關的因果關係與邏輯鏈
- **關鍵要點**：提煉出可直接應用的知識點
- **術語表**（如有專業術語）：列出專有名詞及其解釋

### 品質標準
- 保留所有有價值的細節、數據、引用、方法論
- 用完整段落展開論述，避免過度條列化
- 保留講者的核心推論過程，不只是結論
- 如有實作步驟或方法，完整記錄每個步驟
- 輸出繁體中文 Markdown 格式
- 目標長度：原始內容的 60-80%（詳盡保留，而非壓縮）

逐字稿：
${truncated}`,
    temperature: 0.3,
    maxOutputTokens: 8192,
  });

  return text;
}
