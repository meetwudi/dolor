import { Redis } from "@upstash/redis";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const COOKIE_NAME = "dolor_web_session";

type IntervalsIdentity = {
  athleteId: string;
  athleteName?: string | null;
  accessToken: string;
  scope?: string;
  tokenType?: string;
  updatedAt: string;
};

export type WebUser = {
  id: string;
  createdAt: string;
  updatedAt: string;
  displayName?: string | null;
  linkedIdentities: {
    intervals?: IntervalsIdentity;
  };
};

export type WebSession = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type ThreadSourceType = "web" | "telegram";
export type MessageSource =
  | "web_user"
  | "web_assistant"
  | "telegram_user"
  | "telegram_assistant"
  | "system";

export type ThreadMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  source: MessageSource;
  createdAt: string;
  meta?: Record<string, unknown>;
};

export type ChatThread = {
  id: string;
  userId: string;
  title: string;
  sourceType: ThreadSourceType;
  sourceRef?: string | null;
  readOnly: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  messageCount: number;
};

type StoredThread = ChatThread & {
  agentSessionId: string;
  messages: ThreadMessage[];
};

type Store = {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, ttlSeconds?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
};

const getEnv = (key: string) => {
  if (typeof Bun !== "undefined" && Bun.env[key] !== undefined) {
    return Bun.env[key];
  }
  if (typeof process !== "undefined" && process.env[key] !== undefined) {
    return process.env[key];
  }
  return undefined;
};

const hasRedisEnv = () =>
  !!(getEnv("KV_REST_API_URL") || getEnv("KV_URL") || getEnv("REDIS_URL")) &&
  !!(getEnv("KV_REST_API_TOKEN") || getEnv("KV_REST_API_READ_ONLY_TOKEN"));

const memoryStore = new Map<string, unknown>();

const store: Store = hasRedisEnv()
  ? (() => {
      const redis = Redis.fromEnv();
      return {
        async get<T>(key: string) {
          const value = await redis.get<T>(key);
          if (value === undefined || value === null) return null;
          return value;
        },
        async set(key: string, value: unknown, ttlSeconds?: number) {
          await redis.set(key, value, ttlSeconds ? { ex: ttlSeconds } : undefined);
        },
        async del(key: string) {
          await redis.del(key);
        },
      };
    })()
  : {
      async get<T>(key: string) {
        return (memoryStore.get(key) as T | undefined) ?? null;
      },
      async set(key: string, value: unknown) {
        memoryStore.set(key, structuredClone(value));
      },
      async del(key: string) {
        memoryStore.delete(key);
      },
    };

const nowIso = () => new Date().toISOString();
const randomId = () => crypto.randomUUID().replace(/-/g, "");

const userKey = (userId: string) => `dolor:web:user:${userId}`;
const userByIntervalsKey = (athleteId: string) =>
  `dolor:web:user-by-intervals:${athleteId}`;
const userThreadsKey = (userId: string) => `dolor:web:user-threads:${userId}`;
const threadKey = (threadId: string) => `dolor:web:thread:${threadId}`;
const sessionKey = (sessionId: string) => `dolor:web:session:${sessionId}`;
const telegramChatMapKey = (chatKey: string) =>
  `dolor:web:telegram-chat-map:${chatKey}`;
const telegramUserMapKey = (telegramUserId: number) =>
  `dolor:web:telegram-user-map:${telegramUserId}`;

const loadUserThreadIds = async (userId: string): Promise<string[]> => {
  const data = await store.get<string[]>(userThreadsKey(userId));
  return Array.isArray(data) ? data : [];
};

const saveUserThreadIds = async (userId: string, ids: string[]) => {
  await store.set(userThreadsKey(userId), ids);
};

export const getCookieName = () => COOKIE_NAME;

export const createWebSession = async (userId: string): Promise<WebSession> => {
  const id = randomId();
  const createdAt = nowIso();
  const expires = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const session: WebSession = { id, userId, createdAt, expiresAt: expires };
  await store.set(sessionKey(id), session, SESSION_TTL_SECONDS);
  return session;
};

export const getWebSession = async (id: string): Promise<WebSession | null> => {
  if (!id) return null;
  const session = await store.get<WebSession>(sessionKey(id));
  if (!session) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) {
    await store.del(sessionKey(id));
    return null;
  }
  return session;
};

export const deleteWebSession = async (id: string): Promise<void> => {
  if (!id) return;
  await store.del(sessionKey(id));
};

export const upsertUserFromIntervals = async (identity: IntervalsIdentity) => {
  const mappedUserId = await store.get<string>(userByIntervalsKey(identity.athleteId));
  const existing = mappedUserId ? await store.get<WebUser>(userKey(mappedUserId)) : null;
  const timestamp = nowIso();
  const user: WebUser =
    existing ??
    ({
      id: mappedUserId ?? randomId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      displayName: identity.athleteName ?? null,
      linkedIdentities: {},
    } as WebUser);

  user.updatedAt = timestamp;
  if (!user.displayName && identity.athleteName) {
    user.displayName = identity.athleteName;
  }
  user.linkedIdentities.intervals = identity;

  await store.set(userKey(user.id), user);
  await store.set(userByIntervalsKey(identity.athleteId), user.id);
  return user;
};

export const getUserById = async (userId: string) => {
  if (!userId) return null;
  return store.get<WebUser>(userKey(userId));
};

export const createThread = async (userId: string, title: string) => {
  const id = randomId();
  const createdAt = nowIso();
  const thread: StoredThread = {
    id,
    userId,
    title: title.trim() || "New thread",
    sourceType: "web",
    sourceRef: null,
    readOnly: false,
    archived: false,
    createdAt,
    updatedAt: createdAt,
    lastMessageAt: createdAt,
    messageCount: 0,
    agentSessionId: id,
    messages: [],
  };
  await store.set(threadKey(id), thread);
  const ids = await loadUserThreadIds(userId);
  await saveUserThreadIds(userId, [id, ...ids.filter((item) => item !== id)]);
  return toPublicThread(thread);
};

const toPublicThread = (thread: StoredThread): ChatThread => ({
  id: thread.id,
  userId: thread.userId,
  title: thread.title,
  sourceType: thread.sourceType,
  sourceRef: thread.sourceRef ?? null,
  readOnly: thread.readOnly,
  archived: thread.archived,
  createdAt: thread.createdAt,
  updatedAt: thread.updatedAt,
  lastMessageAt: thread.lastMessageAt,
  messageCount: thread.messageCount,
});

export const listThreads = async (
  userId: string,
  archived = false,
): Promise<ChatThread[]> => {
  const ids = await loadUserThreadIds(userId);
  const threads = await Promise.all(ids.map((id) => store.get<StoredThread>(threadKey(id))));
  return threads
    .filter((item): item is StoredThread => !!item && item.archived === archived)
    .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1))
    .map(toPublicThread);
};

export const getThread = async (threadId: string): Promise<ChatThread | null> => {
  const thread = await store.get<StoredThread>(threadKey(threadId));
  return thread ? toPublicThread(thread) : null;
};

export const getStoredThread = async (threadId: string): Promise<StoredThread | null> =>
  store.get<StoredThread>(threadKey(threadId));

export const updateThread = async (
  userId: string,
  threadId: string,
  patch: { title?: string; archived?: boolean },
) => {
  const existing = await store.get<StoredThread>(threadKey(threadId));
  if (!existing || existing.userId !== userId) return null;
  if (typeof patch.title === "string" && patch.title.trim()) {
    existing.title = patch.title.trim();
  }
  if (typeof patch.archived === "boolean") {
    existing.archived = patch.archived;
  }
  existing.updatedAt = nowIso();
  await store.set(threadKey(threadId), existing);
  return toPublicThread(existing);
};

export const listMessages = async (
  threadId: string,
  limit = 50,
): Promise<ThreadMessage[]> => {
  const thread = await store.get<StoredThread>(threadKey(threadId));
  if (!thread) return [];
  return thread.messages.slice(Math.max(thread.messages.length - limit, 0));
};

export const appendMessage = async (
  threadId: string,
  message: Omit<ThreadMessage, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): Promise<ThreadMessage | null> => {
  const thread = await store.get<StoredThread>(threadKey(threadId));
  if (!thread) return null;
  const createdAt = message.createdAt ?? nowIso();
  const record: ThreadMessage = {
    id: message.id ?? randomId(),
    threadId,
    role: message.role,
    content: message.content,
    source: message.source,
    createdAt,
    meta: message.meta ?? {},
  };
  thread.messages.push(record);
  thread.messageCount = thread.messages.length;
  thread.lastMessageAt = createdAt;
  thread.updatedAt = createdAt;
  await store.set(threadKey(threadId), thread);

  const ids = await loadUserThreadIds(thread.userId);
  await saveUserThreadIds(thread.userId, [threadId, ...ids.filter((id) => id !== threadId)]);
  return record;
};

export const linkTelegramUserToUser = async (
  telegramUserId: number,
  userId: string,
): Promise<void> => {
  await store.set(telegramUserMapKey(telegramUserId), userId);
};

export const getUserIdByTelegramUserId = async (
  telegramUserId: number,
): Promise<string | null> => {
  return store.get<string>(telegramUserMapKey(telegramUserId));
};

export const getOrCreateTelegramThread = async (
  userId: string,
  chatKey: string,
  title: string,
) => {
  const mapped = await store.get<string>(telegramChatMapKey(chatKey));
  const now = nowIso();
  if (mapped) {
    const existing = await store.get<StoredThread>(threadKey(mapped));
    if (existing && existing.userId === userId) return existing;
  }

  const id = randomId();
  const thread: StoredThread = {
    id,
    userId,
    title: title.trim() || "Telegram",
    sourceType: "telegram",
    sourceRef: chatKey,
    readOnly: true,
    archived: false,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    messageCount: 0,
    agentSessionId: chatKey,
    messages: [],
  };

  await store.set(threadKey(id), thread);
  await store.set(telegramChatMapKey(chatKey), id);
  const ids = await loadUserThreadIds(userId);
  await saveUserThreadIds(userId, [id, ...ids.filter((item) => item !== id)]);
  return thread;
};
