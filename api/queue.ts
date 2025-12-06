import { Client } from "@vercel/queue";
import { createTelegramQueueConsumer } from "../telegram/webhook";
import {
  toRequest,
  sendResponse,
  type NodeRequest,
  type NodeResponse,
} from "../lib/vercel-request";

const botToken = Bun.env.TELEGRAM_BOT_TOKEN ?? "";
const queueTopic = Bun.env.TELEGRAM_QUEUE_TOPIC;
const consumerGroup = Bun.env.TELEGRAM_QUEUE_CONSUMER ?? "telegram-webhook";

const queueClient = queueTopic ? new Client() : null;
const queueConsumer = botToken ? createTelegramQueueConsumer({ botToken }) : null;

const queueHandler =
  queueClient && queueConsumer && queueTopic
    ? queueClient.handleCallback({
        [queueTopic]: {
          [consumerGroup]: queueConsumer,
        },
      })
    : null;

export default async function handler(req: NodeRequest, res: NodeResponse) {
  if (!queueHandler) {
    console.error("Queue callback invoked but TELEGRAM_QUEUE_TOPIC or TELEGRAM_BOT_TOKEN missing");
    res.status(500).json({ error: "Queue not configured" });
    return;
  }
  try {
    const request = toRequest(req);
    const response = await queueHandler(request);
    await sendResponse(res, response);
  } catch (error) {
    console.error("Queue callback handler failed", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
