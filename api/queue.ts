import { Client } from "@vercel/queue";
import {
  createTelegramQueueConsumer,
  TELEGRAM_QUEUE_CONSUMER,
  TELEGRAM_QUEUE_TOPIC,
} from "../telegram/webhook";
import {
  toRequest,
  sendResponse,
  type NodeRequest,
  type NodeResponse,
} from "../lib/vercel-request";

const queueTopic = TELEGRAM_QUEUE_TOPIC;
const consumerGroup = TELEGRAM_QUEUE_CONSUMER;

const queueClient = new Client();
const queueConsumer = createTelegramQueueConsumer();

const queueHandler = queueClient.handleCallback({
  [queueTopic]: {
    [consumerGroup]: queueConsumer,
  },
});

export default async function handler(req: NodeRequest, res: NodeResponse) {
  try {
    const request = await toRequest(req);
    const response = await queueHandler(request);
    await sendResponse(res, response);
  } catch (error) {
    console.error("Queue callback handler failed", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
