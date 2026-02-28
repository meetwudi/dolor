import { Redis } from "@upstash/redis";

const generateUUID = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  const segments = [
    Array.from(bytes.slice(0, 4), toHex).join(""),
    Array.from(bytes.slice(4, 6), toHex).join(""),
    Array.from(bytes.slice(6, 8), toHex).join(""),
    Array.from(bytes.slice(8, 10), toHex).join(""),
    Array.from(bytes.slice(10, 16), toHex).join(""),
  ];
  return segments.join("-");
};

type Store = {
  set: (key: string, value: unknown, ttlSeconds?: number) => Promise<void>;
  get: <T>(key: string) => Promise<T | null>;
  del: (key: string) => Promise<void>;
};

const hasRedisEnv = () =>
  !!(Bun.env.KV_REST_API_URL || Bun.env.KV_URL || Bun.env.REDIS_URL) &&
  !!(Bun.env.KV_REST_API_TOKEN || Bun.env.KV_REST_API_READ_ONLY_TOKEN);

const memory = new Map<string, unknown>();

const store: Store = hasRedisEnv()
  ? (() => {
      const redis = Redis.fromEnv();
      return {
        async set(key: string, value: unknown, ttlSeconds?: number) {
          await redis.set(key, value, ttlSeconds ? { ex: ttlSeconds } : undefined);
        },
        async get<T>(key: string) {
          const value = await redis.get<T>(key);
          if (value === undefined || value === null) return null;
          return value;
        },
        async del(key: string) {
          await redis.del(key);
        },
      };
    })()
  : {
      async set(key: string, value: unknown) {
        memory.set(key, structuredClone(value));
      },
      async get<T>(key: string) {
        return (memory.get(key) as T | undefined) ?? null;
      },
      async del(key: string) {
        memory.delete(key);
      },
    };

const CONNECT_TOKEN_PREFIX = "intervals:connect:";
const CONNECT_TOKEN_TTL_SECONDS = 15 * 60;
const OAUTH_STATE_PREFIX = "intervals:oauth-state:";
const OAUTH_STATE_TTL_SECONDS = 2 * 60;
const TELEGRAM_TOKEN_PREFIX = "intervals:telegram:";

export type TelegramConnectPayload = {
  telegramUserId: number;
  telegramUsername?: string | null;
};

export const createTelegramConnectToken = async (
  payload: TelegramConnectPayload,
): Promise<string> => {
  const token = generateUUID().replace(/-/g, "");
  await store.set(
    `${CONNECT_TOKEN_PREFIX}${token}`,
    structuredClone(payload),
    CONNECT_TOKEN_TTL_SECONDS,
  );
  return token;
};

export const consumeTelegramConnectToken = async (
  token: string,
): Promise<TelegramConnectPayload | null> => {
  if (!token) return null;
  const key = `${CONNECT_TOKEN_PREFIX}${token}`;
  const payload = await store.get<TelegramConnectPayload>(key);
  if (payload) {
    await store.del(key);
    return payload;
  }
  return null;
};

export type OAuthStatePayload = TelegramConnectPayload & {
  createdAt: string;
};

export const createIntervalsOAuthState = async (
  payload: TelegramConnectPayload,
): Promise<string> => {
  const state = generateUUID().replace(/-/g, "");
  const record: OAuthStatePayload = {
    ...payload,
    createdAt: new Date().toISOString(),
  };
  await store.set(`${OAUTH_STATE_PREFIX}${state}`, record, OAUTH_STATE_TTL_SECONDS);
  return state;
};

export const consumeIntervalsOAuthState = async (
  state: string | null,
): Promise<OAuthStatePayload | null> => {
  if (!state) return null;
  const key = `${OAUTH_STATE_PREFIX}${state}`;
  const payload = await store.get<OAuthStatePayload>(key);
  if (payload) {
    await store.del(key);
    return payload;
  }
  return null;
};

export type TelegramIntervalsCredential = {
  telegramUserId: number;
  telegramUsername?: string | null;
  athleteId: string;
  athleteName?: string | null;
  accessToken: string;
  scope: string;
  tokenType: string;
  updatedAt: string;
};

export const saveTelegramIntervalsCredential = async (
  credential: TelegramIntervalsCredential,
): Promise<void> => {
  await store.set(
    `${TELEGRAM_TOKEN_PREFIX}${credential.telegramUserId}`,
    structuredClone(credential),
  );
};

export const getTelegramIntervalsCredential = async (
  telegramUserId: number,
): Promise<TelegramIntervalsCredential | null> => {
  const credential = await store.get<TelegramIntervalsCredential>(
    `${TELEGRAM_TOKEN_PREFIX}${telegramUserId}`,
  );
  if (!credential) return null;
  return { ...credential };
};
