import { Redis } from "@upstash/redis";
import isProduction from "./environment";

export type SessionExtraData = Record<string, unknown>;

export type SessionExtraRecord = {
  data: SessionExtraData;
  updatedAt?: string;
};

type SessionExtraStoreOptions = {
  redis?: Redis;
  keyPrefix?: string;
  ttlSeconds?: number;
};

const DEFAULT_KEY_PREFIX = "agent-session-extra:";

const DEFAULT_TTL_SECONDS: number | undefined = isProduction() ? undefined : 600;

const getEnv = (key: string) => {
  if (typeof Bun !== "undefined" && Bun.env[key] !== undefined) {
    return Bun.env[key];
  }
  if (typeof process !== "undefined" && process.env[key] !== undefined) {
    return process.env[key];
  }
  return undefined;
};

export class SessionExtraStore {
  private readonly redis?: Redis;
  private readonly memory: Map<string, SessionExtraRecord>;
  private readonly keyPrefix: string;
  private readonly ttlSeconds?: number;

  constructor(options: SessionExtraStoreOptions = {}) {
    const hasRedisEnv =
      !!(getEnv("KV_REST_API_URL") || getEnv("KV_URL") || getEnv("REDIS_URL")) &&
      !!(getEnv("KV_REST_API_TOKEN") || getEnv("KV_REST_API_READ_ONLY_TOKEN"));
    this.redis = options.redis ?? (hasRedisEnv ? Redis.fromEnv() : undefined);
    this.memory = new Map();
    this.keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  private buildKey(sessionId: string) {
    return `${this.keyPrefix}${sessionId}`;
  }

  async get(sessionId: string): Promise<SessionExtraRecord | null> {
    if (!sessionId) return null;
    const key = this.buildKey(sessionId);
    const data = this.redis
      ? await this.redis.get<SessionExtraRecord>(key)
      : ((this.memory.get(key) as SessionExtraRecord | undefined) ?? null);
    if (!data || typeof data !== "object") return null;
    return {
      data: { ...(data.data ?? {}) },
      updatedAt: data.updatedAt,
    };
  }

  async set(sessionId: string, data: SessionExtraData): Promise<SessionExtraRecord> {
    const payload: SessionExtraRecord = {
      data: structuredClone(data),
      updatedAt: new Date().toISOString(),
    };
    const key = this.buildKey(sessionId);
    if (this.redis) {
      await this.redis.set(
        key,
        payload,
        this.ttlSeconds ? { ex: this.ttlSeconds } : undefined,
      );
    } else {
      this.memory.set(key, payload);
    }
    return payload;
  }

  async merge(sessionId: string, data: SessionExtraData): Promise<SessionExtraRecord> {
    const existing = await this.get(sessionId);
    const merged = { ...(existing?.data ?? {}), ...data };
    return this.set(sessionId, merged);
  }

  async delete(sessionId: string): Promise<void> {
    const key = this.buildKey(sessionId);
    if (this.redis) {
      await this.redis.del(key);
    } else {
      this.memory.delete(key);
    }
  }
}

export const sessionExtraStore = new SessionExtraStore();
