import { createTelegramWebhookHandler } from "../telegram/webhook";

const botToken = Bun.env.TELEGRAM_BOT_TOKEN ?? "";
const secretToken = Bun.env.TELEGRAM_SECRET_TOKEN;

const handler = createTelegramWebhookHandler({
  botToken,
  secretToken,
});

export const config = {
  runtime: "nodejs",
};

export default function (request: Request) {
  return handler(request);
}
