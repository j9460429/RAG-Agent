import {
  verifyBotToken,
  getActiveBotToken,
  getEncryptionKey,
  getBotConfig,
} from "../bot-config";

// Mock telegramRequest
jest.mock("../bot", () => ({
  telegramRequest: jest.fn(),
}));

// Mock supabase admin client
jest.mock("@/lib/supabase/server", () => ({
  createAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

// Mock crypto module
jest.mock("../crypto", () => ({
  encryptToken: jest.fn((token: string) => `encrypted_${token}`),
  decryptToken: jest.fn((encrypted: string) => encrypted.replace("encrypted_", "")),
  maskToken: jest.fn((token: string) => `${token.slice(0, 4)}***`),
}));

describe("bot-config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("getEncryptionKey", () => {
    it("should return the encryption key from env var", () => {
      process.env.BOT_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
      expect(getEncryptionKey()).toBe("a".repeat(64));
    });

    it("should throw if env var is not set", () => {
      delete process.env.BOT_TOKEN_ENCRYPTION_KEY;
      expect(() => getEncryptionKey()).toThrow("BOT_TOKEN_ENCRYPTION_KEY");
    });
  });

  describe("verifyBotToken", () => {
    it("should return bot info on valid token", async () => {
      const { telegramRequest } = require("../bot");
      (telegramRequest as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusCode: 200,
        result: {
          id: 123456,
          is_bot: true,
          first_name: "TestBot",
          username: "test_bot",
        },
      });

      const result = await verifyBotToken("fake-token");
      expect(result.ok).toBe(true);
      expect(result.bot?.id).toBe(123456);
      expect(result.bot?.username).toBe("test_bot");
    });

    it("should return error on invalid token", async () => {
      const { telegramRequest } = require("../bot");
      (telegramRequest as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusCode: 401,
      });

      const result = await verifyBotToken("bad-token");
      expect(result.ok).toBe(false);
      expect(result.bot).toBeUndefined();
    });
  });

  describe("getActiveBotToken", () => {
    it("should fallback to env var when no DB config and key is missing", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "env-token-123";
      delete process.env.BOT_TOKEN_ENCRYPTION_KEY;

      const token = await getActiveBotToken();
      expect(token).toBe("env-token-123");
    });

    it("should return null when no DB config and no env var", async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.BOT_TOKEN_ENCRYPTION_KEY;

      const token = await getActiveBotToken();
      expect(token).toBeNull();
    });
  });

  describe("getBotConfig", () => {
    it("should return null when no config exists", async () => {
      const config = await getBotConfig();
      expect(config).toBeNull();
    });
  });
});
