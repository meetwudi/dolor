import {
  Client,
  type MessageHandler,
  type MessageMetadata,
} from "@vercel/queue";
import { run, system, user, type Agent, type Session } from "@openai/agents";
import { Redis } from "@upstash/redis";
import { fitnessAgent } from "../lib/fitness-agent";
import {
  appendHistory,
  buildIntervalsInstruction,
  sendDolorGreeting,
} from "../lib/dolor-chat";
import { UpstashSession } from "../lib/upstash-session";
import { getFinalResponseText } from "../lib/run-stream-utils";
import { withSessionContext } from "../lib/session-context";
import isProduction from "../lib/environment";

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  message_thread_id?: number;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

type SessionState = {
  session: Session;
  athleteId?: string;
  lastInstructionKey?: string;
  expiresAt?: number;
};

const TELEGRAM_CHAR_LIMIT = 4096;
const UPDATE_DEDUPE_TTL_SECONDS = 600;
const SESSION_TTL_SECONDS: number | undefined = isProduction() ? undefined : 600;
const LOCAL_SESSION_TTL_MS = 10 * 60 * 1000;
const redis = Redis.fromEnv();

const sessionStore = new Map<string, SessionState>();

const claimUpdateLock = async (updateId: number) => {
  const key = `telegram:update:${updateId}`;
  try {
    const result = await redis.set(key, "1", {
      nx: true,
      ex: UPDATE_DEDUPE_TTL_SECONDS,
    });
    return result === "OK";
  } catch (error) {
    console.warn("Failed to claim update lock; proceeding without dedupe", error);
    return true;
  }
};

const getChatKey = (chatId: number, threadId?: number) =>
  threadId ? `${chatId}:${threadId}` : String(chatId);

const getInstructionKey = (athleteId?: string) =>
  athleteId ? `athlete:${athleteId}` : "athlete:none";

const createSession = (sessionId: string): Session =>
  new UpstashSession({
    sessionId,
    ...(SESSION_TTL_SECONDS !== undefined ? { ttlSeconds: SESSION_TTL_SECONDS } : {}),
  });

const createSessionState = (key: string): SessionState => ({
  session: createSession(key),
  expiresAt: Date.now() + LOCAL_SESSION_TTL_MS,
});

const ensureSessionState = (key: string) => {
  let state = sessionStore.get(key);
  const now = Date.now();

  if (state?.expiresAt && state.expiresAt <= now) {
    sessionStore.delete(key);
    state = undefined;
  }

  if (!state) {
    state = createSessionState(key);
    sessionStore.set(key, state);
  } else {
    state.expiresAt = now + LOCAL_SESSION_TTL_MS;
  }
  return state;
};

const resetSessionState = (key: string) => {
  const next = createSessionState(key);
  sessionStore.set(key, next);
  return next;
};

const ensureIntervalsInstruction = async (state: SessionState) => {
  const instructionKey = getInstructionKey(state.athleteId);
  if (state.lastInstructionKey === instructionKey) return;

  await state.session.addItems([
    system(buildIntervalsInstruction({ athleteId: state.athleteId })),
  ]);
  state.lastInstructionKey = instructionKey;
};

const chunkMessage = (text: string) => {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > TELEGRAM_CHAR_LIMIT) {
    let slice = remaining.slice(0, TELEGRAM_CHAR_LIMIT);
    const lastBreak = slice.lastIndexOf("\n");
    if (lastBreak > TELEGRAM_CHAR_LIMIT * 0.5) {
      slice = slice.slice(0, lastBreak);
    }
    chunks.push(slice.trim());
    remaining = remaining.slice(slice.length).trimStart();
  }

  if (remaining.length) {
    chunks.push(remaining);
  }

  return chunks;
};

const sendTelegramMessage = async (
  apiBaseUrl: string,
  payload: Record<string, unknown>,
) => {
  const response = await fetch(`${apiBaseUrl}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch (error) {
    console.error("Telegram sendMessage parse failure", error);
  }

  if (!response.ok || !data?.ok) {
    const body = data ? JSON.stringify(data) : await response.text();
    console.error("Telegram sendMessage failed", response.status, body);
    return null;
  }

  return data.result as TelegramMessage;
};

const sendTextResponse = async (
  apiBaseUrl: string,
  chatId: number,
  text: string,
  replyTo?: number,
) => {
  const chunks = chunkMessage(text);

  for (const chunk of chunks) {
    await sendTelegramMessage(apiBaseUrl, {
      chat_id: chatId,
      text: chunk,
      reply_to_message_id: replyTo,
      disable_notification: false,
      disable_web_page_preview: true,
    });
    // Only the first chunk should reply to the triggering message.
    replyTo = undefined;
  }
};

const parseCommand = (text: string) => {
  if (!text.startsWith("/")) return null;
  const trimmed = text.trim();
  const [rawCommand, ...args] = trimmed.split(/\s+/);
  if (!rawCommand) return null;
  const command = rawCommand.toLowerCase();
  return { command, args };
};

export type TelegramQueuePayload = {
  update: TelegramUpdate;
};

const createTelegramUpdateProcessor = (apiBaseUrl: string) => {
  const handleCommand = async (
    chatId: number,
    key: string,
    command: string,
    args: string[],
    messageId: number,
  ) => {
    switch (command) {
      case "/start": {
        const state = ensureSessionState(key);
        const greeting = await sendDolorGreeting({
          session: state.session,
          athleteId: state.athleteId,
        });
        state.lastInstructionKey = getInstructionKey(state.athleteId);
        await sendTextResponse(apiBaseUrl, chatId, greeting, messageId);
        await sendTextResponse(
          apiBaseUrl,
          chatId,
          "You can set your Intervals.icu athlete ID any time with /athlete <id>. Use /help to see all commands.",
        );
        return true;
      }
      case "/help": {
        const helpMessage = [
          "Available commands:",
          "/start — receive Dolor's greeting and current context",
          "/athlete <id> — pin an Intervals.icu athlete for tool calls",
          "/reset — drop the current chat history",
        ].join("\n");
        await sendTextResponse(apiBaseUrl, chatId, helpMessage, messageId);
        return true;
      }
      case "/reset": {
        await resetSessionState(key);
        await sendTextResponse(
          apiBaseUrl,
          chatId,
          "Cleared Dolor's memory for this chat. Start fresh!",
          messageId,
        );
        return true;
      }
      case "/athlete": {
        const athleteId = args[0];
        if (!athleteId) {
          await sendTextResponse(
            apiBaseUrl,
            chatId,
            "Usage: /athlete <id>",
            messageId,
          );
          return true;
        }
        const state = ensureSessionState(key);
        state.athleteId = athleteId;
        state.lastInstructionKey = undefined;
        await sendTextResponse(
          apiBaseUrl,
          chatId,
          `Got it. I'll use athlete ID ${athleteId} the next time Dolor calls Intervals.icu.`,
          messageId,
        );
        return true;
      }
      default:
        return false;
    }
  };

  return async (update: TelegramUpdate) => {
    const chatId =
      update.message?.chat.id ?? update.edited_message?.chat.id ?? "unknown";
    console.log(`[Telegram] Processing update ${update.update_id} for chat ${chatId}`);
    const message = update.message ?? update.edited_message;
    if (!message) {
      console.log(
        `[Telegram] Update ${update.update_id} has no message payload; skipping`,
      );
      return;
    }

    const text = message.text?.trim();
    if (!text) {
      await sendTextResponse(
        apiBaseUrl,
        message.chat.id,
        "Dolor can only read text messages for now.",
        message.message_id,
      );
      console.log(`[Telegram] Update ${update.update_id} skipped due to missing text`);
      return;
    }

    const chatKey = getChatKey(message.chat.id, message.message_thread_id);

    const command = parseCommand(text);
    if (command) {
      const handled = await handleCommand(
        message.chat.id,
        chatKey,
        command.command,
        command.args,
        message.message_id,
      );
      if (handled) {
        console.log(
          `[Telegram] Update ${update.update_id} handled via command ${command.command}`,
        );
        return;
      }
    }

    const state = ensureSessionState(chatKey);
    await ensureIntervalsInstruction(state);

    try {
      const sessionId = await state.session.getSessionId();
      const result = await withSessionContext({ sessionId }, () =>
        run(fitnessAgent, [user(text)], {
          session: state.session,
          sessionInputCallback: appendHistory,
        }),
      );
      const reply = (await getFinalResponseText(result)).trim();
      if (reply) {
        await sendTextResponse(apiBaseUrl, message.chat.id, reply, message.message_id);
      }
      console.log(`[Telegram] Finished update ${update.update_id}`);
    } catch (error) {
      console.error("Dolor Telegram run failed", error);
      await sendTextResponse(
        apiBaseUrl,
        message.chat.id,
        "Dolor hit an error. Please try again in a moment.",
        message.message_id,
      );
    }
  };
};

export const TELEGRAM_QUEUE_TOPIC = "telegram-updates";
export const TELEGRAM_QUEUE_CONSUMER = "telegram-webhook";

export type TelegramWebhookHandlerOptions = {
  botToken: string;
  secretToken?: string;
};

export const createTelegramWebhookHandler = ({
  botToken,
  secretToken,
}: TelegramWebhookHandlerOptions) => {
  if (!botToken) {
    throw new Error("createTelegramWebhookHandler requires a TELEGRAM_BOT_TOKEN");
  }

  if (!Bun.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY must be set to chat with Dolor.");
  }

  const apiBaseUrl = `https://api.telegram.org/bot${botToken}`;
  const processUpdate = createTelegramUpdateProcessor(apiBaseUrl);
  const queueClient = new Client();
  const queueTopic = TELEGRAM_QUEUE_TOPIC;

  return async (request: Request) => {
    if (request.method === "GET") {
      return new Response(
        "Dolor Telegram webhook is up. Configure Telegram to POST updates to this URL.",
      );
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (
      secretToken &&
      request.headers.get("x-telegram-bot-api-secret-token") !== secretToken
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    let update: TelegramUpdate;
    try {
      update = await request.json();
    } catch (error) {
      console.error("Failed to parse Telegram payload", error);
      return new Response("Bad Request", { status: 400 });
    }

    const lockAcquired = await claimUpdateLock(update.update_id);
    if (!lockAcquired) {
      return new Response("Duplicate update", { status: 200 });
    }

    const message = update.message ?? update.edited_message;
    if (!message) {
      return new Response("No message to process", { status: 200 });
    }

    try {
      console.log(`[Telegram] Enqueuing update ${update.update_id} -> ${queueTopic}`);
      const { messageId } = await queueClient.send(queueTopic, { update });
      console.log(
        `[Telegram] Enqueued update ${update.update_id} as queue message ${messageId}`,
      );
      return new Response("Queued", { status: 200 });
    } catch (error) {
      console.error("Failed to enqueue Telegram update; processing inline", error);
    }

    await processUpdate(update);
    return new Response("OK");
  };
};

export const createTelegramQueueConsumer = (): MessageHandler => {
  const botToken = Bun.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN must be set to create the queue consumer");
  }
  const apiBaseUrl = `https://api.telegram.org/bot${botToken}`;
  const processUpdate = createTelegramUpdateProcessor(apiBaseUrl);

  return async (payload: unknown, _metadata?: MessageMetadata) => {
    const typedPayload = payload as TelegramQueuePayload | undefined;
    if (!typedPayload?.update) {
      console.warn("Received queue payload without 'update'; skipping");
      return;
    }
    console.log(
      `[Telegram] Queue consumer handling message ${_metadata?.messageId ?? "unknown"} (update ${typedPayload.update.update_id})`,
    );
    await processUpdate(typedPayload.update);
    console.log(
      `[Telegram] Queue consumer completed message ${_metadata?.messageId ?? "unknown"} (update ${typedPayload.update.update_id})`,
    );
  };
};
