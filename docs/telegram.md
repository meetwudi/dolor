# Telegram bot + Vercel deployment

This document explains how to run the Dolor Telegram bot locally for development and how to deploy it on Vercel.

> Prerequisites: Bun ≥ 1.1, a Telegram bot token from [@BotFather](https://t.me/BotFather), and access to an Intervals.icu API key.

## 1. Environment variables

Set these locally (e.g. in `.env`) and in your Vercel project:

- `OPENAI_API_KEY`
- `INTERVALS_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_SECRET_TOKEN` — any random string; Telegram will include it in the `x-telegram-bot-api-secret-token` header so we can verify webhook authenticity.

## 2. Run the webhook locally

```sh
bun --hot scripts/telegram-server.ts
```

This starts `Bun.serve()` on `http://localhost:8787/api/telegram`. Use a tunnel (e.g. `ngrok http 8787`) to expose it to Telegram while testing.

## 3. Point Telegram at your server

Call Telegram’s HTTP API once per environment. Replace `<PUBLIC_URL>` with your tunnel URL during development or your Vercel domain in production:

```sh
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"<PUBLIC_URL>/api/telegram\", \"secret_token\": \"${TELEGRAM_SECRET_TOKEN}\"}"
```

To disable delivery (while still letting Telegram log updates) call `deleteWebhook` the same way.

## 4. Optional: Vercel Queue

If you want Telegram updates to ack immediately and process asynchronously, configure a Vercel Queue topic and set these env vars:

- `TELEGRAM_QUEUE_TOPIC` — the queue topic slug (e.g. `telegram-updates`).
- `TELEGRAM_QUEUE_CONSUMER` — optional consumer group name; defaults to `telegram-webhook`.

Update `vercel.json` so Vercel knows which topic/consumer should trigger `/api/queue`:

```json
{
  "functions": {
    "api/queue.ts": {
      "experimentalTriggers": [
        {
          "type": "queue/v1beta",
          "topic": "telegram-updates",
          "consumer": "telegram-webhook"
        }
      ]
    }
  }
}
```

Replace the topic/consumer names with your actual queue settings. When deployed, Vercel Queue will call `/api/queue` via `Client.handleCallback`. The Telegram webhook now enqueues updates (and falls back to inline processing if enqueueing fails). For local development leave `TELEGRAM_QUEUE_TOPIC` unset so messages are processed inline without a queue.

## 5. Deploy to Vercel

`vercel.json` runs `bun install`, `bun run build`, and serves `api/telegram` with the Bun runtime. After `vercel deploy`, rerun the `setWebhook` command above using the production domain so Telegram sends updates directly to Vercel.

## 6. Telegram commands

- `/start` — Dolor greets you and reminds you how to pin an athlete.
- `/athlete <id>` — pins an Intervals.icu athlete so Dolor fills tool calls automatically.
- `/reset` — clears the chat’s memory and starts fresh.
- `/help` — lists all commands.

That’s it—message your bot in Telegram and Dolor will mirror the behavior you see in the CLI (`bun run agent`), but now from anywhere Telegram runs.
