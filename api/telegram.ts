import { createTelegramWebhookHandler } from "../telegram/webhook";
import {
  toRequest,
  sendResponse,
  type NodeRequest,
  type NodeResponse,
} from "../lib/vercel-request";

const getEnv = (key: string) => {
  if (typeof process === "undefined") return undefined;
  return process.env[key];
};

const botToken = getEnv("TELEGRAM_BOT_TOKEN") ?? "";
const secretToken = getEnv("TELEGRAM_SECRET_TOKEN");

const webhookHandler = createTelegramWebhookHandler({
  botToken,
  secretToken,
});

export default async function handler(req: NodeRequest, res: NodeResponse) {
  try {
    const request = await toRequest(req);
    const response = await webhookHandler(request);
    await sendResponse(res, response);
  } catch (error) {
    console.error("Telegram API handler failed", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
