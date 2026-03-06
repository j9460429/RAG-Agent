import {
  extractMemories,
  deduplicateMemories,
} from "../memory-extractor";
import type { ExtractedMemory } from "../types";

describe("memory-extractor", () => {
  describe("extractMemories", () => {
    it('should extract Chinese preference: "我喜歡深色模式"', () => {
      const result = extractMemories({
        userMessage: "我喜歡深色模式",
        assistantResponse: "好的，已為您切換到深色模式。",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0]).toEqual(
        expect.objectContaining({
          content: expect.stringContaining("深色模式"),
          category: "preference",
          importance_score: 0.7,
        }),
      );
    });

    it('should extract English preference: "I prefer dark mode"', () => {
      const result = extractMemories({
        userMessage: "I prefer dark mode for coding",
        assistantResponse: "Sure, dark mode it is.",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0]).toEqual(
        expect.objectContaining({
          content: expect.stringContaining("dark mode"),
          category: "preference",
          importance_score: 0.7,
        }),
      );
    });

    it('should extract Chinese fact: "我是軟體工程師"', () => {
      const result = extractMemories({
        userMessage: "我是軟體工程師",
        assistantResponse: "了解，您是軟體工程師。",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0]).toEqual(
        expect.objectContaining({
          content: expect.stringContaining("軟體工程師"),
          category: "fact",
          importance_score: 0.6,
        }),
      );
    });

    it('should extract Chinese behavior: "我通常會用中文回覆"', () => {
      const result = extractMemories({
        userMessage: "我通常會用中文回覆",
        assistantResponse: "好的，我會使用中文。",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0]).toEqual(
        expect.objectContaining({
          content: expect.stringContaining("中文回覆"),
          category: "behavior",
          importance_score: 0.5,
        }),
      );
    });

    it("should return shouldStore = false when no memories extracted", () => {
      const result = extractMemories({
        userMessage: "今天天氣怎麼樣？",
        assistantResponse: "今天天氣晴朗。",
      });
      expect(result.shouldStore).toBe(false);
      expect(result.memories).toHaveLength(0);
    });

    it("should extract multiple memories from a single message", () => {
      const result = extractMemories({
        userMessage: "我是前端工程師，我喜歡用 TypeScript，我經常使用 VS Code",
        assistantResponse: "了解您的背景。",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories.length).toBeGreaterThanOrEqual(2);
      const categories = result.memories.map((m) => m.category);
      expect(categories).toContain("fact");
      expect(categories).toContain("preference");
    });

    it("should assign correct importance_score by category", () => {
      const prefResult = extractMemories({
        userMessage: "我偏好暗色主題",
        assistantResponse: "好的。",
      });
      const factResult = extractMemories({
        userMessage: "我在台北工作",
        assistantResponse: "了解。",
      });
      const behaviorResult = extractMemories({
        userMessage: "每次都要先看文件",
        assistantResponse: "了解。",
      });
      expect(prefResult.memories[0]?.importance_score).toBe(0.7);
      expect(factResult.memories[0]?.importance_score).toBe(0.6);
      expect(behaviorResult.memories[0]?.importance_score).toBe(0.5);
    });

    it("should not include conversationId in extracted memories", () => {
      const result = extractMemories({
        userMessage: "我喜歡簡潔的程式碼",
        assistantResponse: "好的。",
        conversationId: "conv-123",
      });
      expect(result.shouldStore).toBe(true);
      const mem = result.memories[0];
      expect(mem).toHaveProperty("content");
      expect(mem).toHaveProperty("category");
      expect(mem).toHaveProperty("importance_score");
      expect(Object.keys(mem)).toHaveLength(3);
    });

    it('should extract English fact: "I am a designer"', () => {
      const result = extractMemories({
        userMessage: "I am a designer working in Taipei",
        assistantResponse: "Nice!",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories[0]?.category).toBe("fact");
    });

    it('should extract English behavior: "I usually code in the morning"', () => {
      const result = extractMemories({
        userMessage: "I usually code in the morning",
        assistantResponse: "Sounds productive.",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories[0]?.category).toBe("behavior");
    });

    it('should extract "我習慣" as preference', () => {
      const result = extractMemories({
        userMessage: "我習慣用 Vim 編輯器",
        assistantResponse: "了解。",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories[0]?.category).toBe("preference");
    });

    it('should extract "I like" as preference', () => {
      const result = extractMemories({
        userMessage: "I like using TypeScript for type safety",
        assistantResponse: "Good choice.",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories[0]?.category).toBe("preference");
    });

    it('should extract "I always" as preference', () => {
      const result = extractMemories({
        userMessage: "I always use ESLint in my projects",
        assistantResponse: "That is a good practice.",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories[0]?.category).toBe("preference");
    });

    it('should extract "I work" as fact', () => {
      const result = extractMemories({
        userMessage: "I work at a startup in Taipei",
        assistantResponse: "Cool!",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories[0]?.category).toBe("fact");
    });

    it('should extract "My" sentence as fact', () => {
      const result = extractMemories({
        userMessage: "My team uses Next.js for all projects",
        assistantResponse: "Next.js is great.",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories[0]?.category).toBe("fact");
    });

    it('should extract "我的" as fact', () => {
      const result = extractMemories({
        userMessage: "我的公司在台北",
        assistantResponse: "了解。",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories[0]?.category).toBe("fact");
    });

    it('should extract "我經常" as behavior', () => {
      const result = extractMemories({
        userMessage: "我經常在晚上寫程式",
        assistantResponse: "了解。",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories[0]?.category).toBe("behavior");
    });

    it('should extract "I often" as behavior', () => {
      const result = extractMemories({
        userMessage: "I often review pull requests on Monday",
        assistantResponse: "Good habit.",
      });
      expect(result.shouldStore).toBe(true);
      expect(result.memories[0]?.category).toBe("behavior");
    });
  });

  describe("deduplicateMemories", () => {
    it("should remove memories with content similar to existing ones", () => {
      const existing = ["使用者偏好深色模式", "使用者是軟體工程師"];
      const newMemories: ExtractedMemory[] = [
        { content: "深色模式", category: "preference", importance_score: 0.7 },
        { content: "使用 React", category: "preference", importance_score: 0.7 },
      ];
      const result = deduplicateMemories(existing, newMemories);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("使用 React");
    });

    it("should return all memories when no duplicates exist", () => {
      const existing = ["使用者偏好深色模式"];
      const newMemories: ExtractedMemory[] = [
        { content: "使用 TypeScript", category: "preference", importance_score: 0.7 },
        { content: "前端工程師", category: "fact", importance_score: 0.6 },
      ];
      const result = deduplicateMemories(existing, newMemories);
      expect(result).toHaveLength(2);
    });

    it("should return empty array when all memories are duplicates", () => {
      const existing = ["使用者偏好深色模式", "使用者喜歡 TypeScript"];
      const newMemories: ExtractedMemory[] = [
        { content: "偏好深色模式", category: "preference", importance_score: 0.7 },
      ];
      const result = deduplicateMemories(existing, newMemories);
      expect(result).toHaveLength(0);
    });

    it("should return all memories when existing list is empty", () => {
      const existing: string[] = [];
      const newMemories: ExtractedMemory[] = [
        { content: "使用 React", category: "preference", importance_score: 0.7 },
      ];
      const result = deduplicateMemories(existing, newMemories);
      expect(result).toHaveLength(1);
    });

    it("should return empty array when newMemories is empty", () => {
      const existing = ["使用者偏好深色模式"];
      const newMemories: ExtractedMemory[] = [];
      const result = deduplicateMemories(existing, newMemories);
      expect(result).toHaveLength(0);
    });
  });
});
