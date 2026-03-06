import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  verifyBotToken,
  saveBotConfig,
  getBotConfig,
  deleteBotConfig,
  getWebhookStatus,
} from "@/lib/telegram/bot-config";

/**
 * GET /api/telegram/bot
 * 讀取 Bot 設定（Token 遮罩化）+ Webhook 狀態
 *
 * Per-user 擁有權檢查：
 * - 若 Bot config 的 configured_by != 當前使用者 → 自動清除舊設定 + 舊綁定
 * - 新使用者看到乾淨的初始狀態
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "未登入" }, { status: 401 });
    }

    const config = await getBotConfig();

    // Per-user 擁有權檢查：config 屬於其他使用者 → 自動清除
    if (config && config.configured_by && config.configured_by !== user.id) {
      await deleteBotConfig();

      // 清除舊使用者的 telegram_users 綁定（綁在舊 Bot 上的記錄已無效）
      const admin = createAdminClient();
      await admin
        .from("telegram_users")
        .delete()
        .eq("user_id", config.configured_by);

      return Response.json({ config: null, webhook: null });
    }

    const webhookStatus = config ? await getWebhookStatus() : null;

    return Response.json({
      config,
      webhook: webhookStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查詢失敗";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/telegram/bot
 * 驗證並儲存 Bot Token
 * Body: { token: string }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "未登入" }, { status: 401 });
    }

    const body = (await req.json()) as { token?: string };
    const token = body.token?.trim();

    if (!token) {
      return Response.json({ error: "請提供 Bot Token" }, { status: 400 });
    }

    // 驗證 Token
    const verification = await verifyBotToken(token);
    if (!verification.ok || !verification.bot) {
      return Response.json(
        { error: verification.error ?? "Token 無效" },
        { status: 400 },
      );
    }

    // 儲存到 DB
    const saveResult = await saveBotConfig(token, verification.bot, user.id);
    if (!saveResult.success) {
      return Response.json(
        { error: saveResult.error ?? "儲存失敗" },
        { status: 500 },
      );
    }

    return Response.json({
      success: true,
      bot: {
        id: verification.bot.id,
        username: verification.bot.username,
        first_name: verification.bot.first_name,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "設定失敗";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/telegram/bot
 * 刪除 Bot 設定
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "未登入" }, { status: 401 });
    }

    const result = await deleteBotConfig();
    if (!result.success) {
      return Response.json(
        { error: result.error ?? "刪除失敗" },
        { status: 500 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "刪除失敗";
    return Response.json({ error: message }, { status: 500 });
  }
}
