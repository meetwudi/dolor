#!/usr/bin/env bun
import { createTelegramWebhookHandler } from "../telegram/webhook";

const botToken = Bun.env.TELEGRAM_BOT_TOKEN ?? "";
const secretToken = Bun.env.TELEGRAM_SECRET_TOKEN;

const handler = createTelegramWebhookHandler({
  botToken,
  secretToken,
});

const port = Number(Bun.env.PORT ?? 8787);

Bun.serve({
  port,
  fetch: (request) => {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return new Response("ok");
    }

    if (url.pathname !== "/api/telegram") {
      return new Response("Not Found", { status: 404 });
    }

    return handler(request);
  },
});

console.log(`Dolor Telegram webhook listening on http://localhost:${port}/api/telegram`);
