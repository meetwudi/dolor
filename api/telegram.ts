import { createTelegramWebhookHandler } from "../telegram/webhook";
import {
  toRequest,
  sendResponse,
  type NodeRequest,
  type NodeResponse,
} from "../lib/vercel-request";

const botToken = Bun.env.TELEGRAM_BOT_TOKEN ?? "";
const secretToken = Bun.env.TELEGRAM_SECRET_TOKEN;

const webhookHandler = createTelegramWebhookHandler({
  botToken,
  secretToken,
});

export default async function handler(req: NodeRequest, res: NodeResponse) {
  try {
    const request = toRequest(req);
    const response = await webhookHandler(request);
    await sendResponse(res, response);
  } catch (error) {
    console.error("Telegram API handler failed", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
