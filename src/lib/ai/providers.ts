import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import type { AIModel } from "@/types";

/**
 * 取得 AI Provider (使用 API Key)
 *
 * @param model - AI 模型類型
 * @returns Vercel AI SDK 格式的 Language Model
 * @throws Error 如果 API Key 未設定
 */
export function getProvider(model: AIModel) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY 環境變數未設定");
  }

  const googleProvider = createGoogleGenerativeAI({
    apiKey,
  });

  const modelMap: Record<AIModel, string> = {
    "gemini-flash": "gemini-3-flash-preview",
    "gemini-pro": "gemini-3.1-pro-preview",
    "gemini-flash-lite": "gemini-3.1-flash-lite-preview",
  };

  return googleProvider(modelMap[model]);
}

export function getEmbeddingModel() {
  return google.textEmbeddingModel("gemini-embedding-001");
}

// Google embedding 維度設定（需在 embed() 呼叫時透過 providerOptions 傳遞）
// gemini-embedding-001 預設 3072 維，指定 768 維以匹配資料庫 vector(768)
export const EMBEDDING_PROVIDER_OPTIONS = {
  google: { outputDimensionality: 768 },
} as const;
