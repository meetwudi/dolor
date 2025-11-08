import { Redis } from "@upstash/redis";

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

const DEFAULT_TTL_SECONDS = 600;

export class SessionExtraStore {
  private readonly redis: Redis;
  private readonly keyPrefix: string;
  private readonly ttlSeconds?: number;

  constructor(options: SessionExtraStoreOptions = {}) {
    this.redis = options.redis ?? Redis.fromEnv();
    this.keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  private buildKey(sessionId: string) {
    return `${this.keyPrefix}${sessionId}`;
  }

  async get(sessionId: string): Promise<SessionExtraRecord | null> {
    if (!sessionId) return null;
    const data = await this.redis.get<SessionExtraRecord>(this.buildKey(sessionId));
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
    await this.redis.set(
      this.buildKey(sessionId),
      payload,
      this.ttlSeconds ? { ex: this.ttlSeconds } : undefined,
    );
    return payload;
  }

  async merge(sessionId: string, data: SessionExtraData): Promise<SessionExtraRecord> {
    const existing = await this.get(sessionId);
    const merged = { ...(existing?.data ?? {}), ...data };
    return this.set(sessionId, merged);
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(this.buildKey(sessionId));
  }
}

export const sessionExtraStore = new SessionExtraStore();
