/**
 * Memory Extractor - 從對話中提取使用者記憶
 *
 * 使用規則式提取（正則表達式 + 字串匹配），不呼叫任何 LLM API。
 * 支援中文與英文的偏好、事實、行為模式提取。
 */

import type { ExtractedMemory, MemoryCategory } from "./types";

interface ExtractionInput {
  userMessage: string;
  assistantResponse: string;
  conversationId?: string;
}

interface ExtractionResult {
  memories: ExtractedMemory[];
  shouldStore: boolean;
}

interface ExtractionRule {
  pattern: RegExp;
  category: MemoryCategory;
  importance_score: number;
}

const PREFERENCE_RULES: ExtractionRule[] = [
  { pattern: /我喜歡(.+)/u, category: "preference", importance_score: 0.7 },
  { pattern: /我偏好(.+)/u, category: "preference", importance_score: 0.7 },
  { pattern: /我習慣(.+)/u, category: "preference", importance_score: 0.7 },
  { pattern: /我不喜歡(.+)/u, category: "preference", importance_score: 0.7 },
  { pattern: /我討厭(.+)/u, category: "preference", importance_score: 0.7 },
  {
    pattern: /I prefer\s+(.+)/i,
    category: "preference",
    importance_score: 0.7,
  },
  { pattern: /I like\s+(.+)/i, category: "preference", importance_score: 0.7 },
  {
    pattern: /I always\s+(.+)/i,
    category: "preference",
    importance_score: 0.7,
  },
  {
    pattern: /I don'?t like\s+(.+)/i,
    category: "preference",
    importance_score: 0.7,
  },
];

const IDENTITY_RULES: ExtractionRule[] = [
  // 身份/名字相關（高重要性）
  { pattern: /我叫(.+)/u, category: "fact", importance_score: 0.9 },
  { pattern: /我名字是(.+)/u, category: "fact", importance_score: 0.9 },
  { pattern: /叫我(.+)/u, category: "fact", importance_score: 0.9 },
  { pattern: /你可以叫我(.+)/u, category: "fact", importance_score: 0.9 },
  { pattern: /我的名字是(.+)/u, category: "fact", importance_score: 0.9 },
  { pattern: /My name is\s+(.+)/i, category: "fact", importance_score: 0.9 },
  { pattern: /I'm\s+(.+)/i, category: "fact", importance_score: 0.8 },
  { pattern: /Call me\s+(.+)/i, category: "fact", importance_score: 0.9 },
];

const FACT_RULES: ExtractionRule[] = [
  { pattern: /我是(.+)/u, category: "fact", importance_score: 0.8 },
  { pattern: /我在(.+)/u, category: "fact", importance_score: 0.6 },
  { pattern: /我住在(.+)/u, category: "fact", importance_score: 0.7 },
  { pattern: /我來自(.+)/u, category: "fact", importance_score: 0.7 },
  { pattern: /我的(.+)/u, category: "fact", importance_score: 0.6 },
  { pattern: /I am\s+(.+)/i, category: "fact", importance_score: 0.8 },
  { pattern: /I work\s+(.+)/i, category: "fact", importance_score: 0.6 },
  { pattern: /I live in\s+(.+)/i, category: "fact", importance_score: 0.7 },
  { pattern: /My\s+(.+)/i, category: "fact", importance_score: 0.6 },
];

const BEHAVIOR_RULES: ExtractionRule[] = [
  { pattern: /每次都(.+)/u, category: "behavior", importance_score: 0.5 },
  { pattern: /通常我會(.+)/u, category: "behavior", importance_score: 0.5 },
  { pattern: /我通常會(.+)/u, category: "behavior", importance_score: 0.5 },
  { pattern: /我經常(.+)/u, category: "behavior", importance_score: 0.5 },
  { pattern: /I usually\s+(.+)/i, category: "behavior", importance_score: 0.5 },
  { pattern: /I often\s+(.+)/i, category: "behavior", importance_score: 0.5 },
];

// 身份規則優先匹配（確保「我叫XXX」不會被「我的XXX」搶先匹配）
const ALL_RULES: ExtractionRule[] = [
  ...IDENTITY_RULES,
  ...PREFERENCE_RULES,
  ...FACT_RULES,
  ...BEHAVIOR_RULES,
];

/**
 * 判斷子句是否為問句（不應提取為記憶）
 * 檢查：原文中是否接著 ？?，或子句末尾含中文問句助詞
 */
const QUESTION_SUFFIX_RE = /[誰什麼哪怎嗎呢吧嘛呀幾多少何]$/u;
const QUESTION_PHRASE_RE = /是什麼|是誰|是哪|怎麼|如何|有沒有|能不能|可不可以|是否/u;

function isQuestion(clause: string, originalText: string): boolean {
  // 原文中該子句後面緊接問號
  const idx = originalText.indexOf(clause);
  if (idx >= 0) {
    const afterClause = originalText.slice(idx + clause.length, idx + clause.length + 5);
    if (/[？?]/.test(afterClause)) return true;
  }
  // 子句本身含常見問句詞
  if (QUESTION_SUFFIX_RE.test(clause)) return true;
  if (QUESTION_PHRASE_RE.test(clause)) return true;
  return false;
}

function cleanContent(raw: string): string {
  return raw.replace(/[，。！？,.!?]$/, "").trim();
}

function splitIntoClauses(text: string): string[] {
  return text
    .split(/[，,；;。.！!]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 過短或無意義的提取內容 */
const MIN_CONTENT_LENGTH = 3;

export function extractMemories(input: ExtractionInput): ExtractionResult {
  const clauses = splitIntoClauses(input.userMessage);
  const memories: ExtractedMemory[] = [];
  const seenContents = new Set<string>();

  for (const clause of clauses) {
    // 跳過問句 — 問句不是事實陳述
    if (isQuestion(clause, input.userMessage)) continue;

    for (const rule of ALL_RULES) {
      const match = clause.match(rule.pattern);
      if (match) {
        const content = cleanContent(match[0]);
        if (
          content.length >= MIN_CONTENT_LENGTH &&
          !seenContents.has(content)
        ) {
          seenContents.add(content);
          memories.push({
            content,
            category: rule.category,
            importance_score: rule.importance_score,
          });
        }
        break;
      }
    }
  }

  return {
    memories,
    shouldStore: memories.length >= 1,
  };
}

function computeStringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const getBigrams = (str: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.slice(i, i + 2));
    }
    return bigrams;
  };

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersection = 0;
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) {
      intersection++;
    }
  }

  const union = (bigramsA.size + bigramsB.size) / 2;
  if (union === 0) return 0.0;

  return intersection / union;
}

const DEDUP_SIMILARITY_THRESHOLD = 0.6;

export function deduplicateMemories(
  existing: string[],
  newMemories: ExtractedMemory[],
): ExtractedMemory[] {
  if (newMemories.length === 0) return [];
  if (existing.length === 0) return [...newMemories];

  return newMemories.filter((memory) => {
    const isDuplicate = existing.some((existingContent) => {
      // 子字串包含檢查：新記憶被已存在字串包含，或反過來
      if (
        existingContent.includes(memory.content) ||
        memory.content.includes(existingContent)
      ) {
        return true;
      }
      // bigram 相似度檢查
      return (
        computeStringSimilarity(memory.content, existingContent) >=
        DEDUP_SIMILARITY_THRESHOLD
      );
    });
    return !isDuplicate;
  });
}
