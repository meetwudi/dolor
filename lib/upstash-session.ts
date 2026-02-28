import { randomUUID } from "@openai/agents-core/_shims";
import type { AgentInputItem, Session } from "@openai/agents";
import { Redis } from "@upstash/redis";
import { cleanHistoryItems } from "./history-utils";

type UpstashSessionOptions = {
  sessionId?: string;
  redis?: Redis;
  keyPrefix?: string;
  ttlSeconds?: number;
  maxItems?: number;
};

const DEFAULT_KEY_PREFIX = "agent-session:";
const DEFAULT_MAX_ITEMS = 60;

export class UpstashSession implements Session {
  private readonly redis: Redis;
  private readonly sessionId: string;
  private readonly key: string;
  private readonly ttlSeconds?: number;
  private readonly maxItems: number;

  constructor(options: UpstashSessionOptions = {}) {
    this.sessionId = options.sessionId ?? randomUUID();
    this.redis = options.redis ?? Redis.fromEnv();
    this.key = `${options.keyPrefix ?? DEFAULT_KEY_PREFIX}${this.sessionId}`;
    this.ttlSeconds = options.ttlSeconds;
    this.maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
  }

  async getSessionId(): Promise<string> {
    return this.sessionId;
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    const items = await this.readItems();
    if (limit === undefined || limit >= this.maxItems) {
      return items;
    }
    if (limit <= 0) {
      return [];
    }
    const start = Math.max(items.length - limit, 0);
    return items.slice(start);
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    if (!items.length) return;
    const existing = await this.readItems();
    const merged = [...existing, ...items];
    await this.writeItems(merged);
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    const items = await this.readItems();
    if (!items.length) return undefined;
    const popped = items.pop();
    if (!popped) return undefined;
    await this.writeItems(items);
    return structuredClone(popped);
  }

  async clearSession(): Promise<void> {
    await this.redis.del(this.key);
  }

  private async readItems(): Promise<AgentInputItem[]> {
    const data = await this.redis.get<AgentInputItem[]>(this.key);
    if (!Array.isArray(data)) return [];
    return this.keepMostRecent(cleanHistoryItems(data));
  }

  private async writeItems(items: AgentInputItem[]): Promise<void> {
    const sanitized = this.keepMostRecent(cleanHistoryItems(items));
    if (!sanitized.length) {
      await this.redis.del(this.key);
      return;
    }
    await this.redis.set(
      this.key,
      sanitized.map((item) => structuredClone(item)),
      this.ttlSeconds ? { ex: this.ttlSeconds } : undefined,
    );
  }

  private keepMostRecent(items: AgentInputItem[]): AgentInputItem[] {
    if (this.maxItems <= 0) {
      return [];
    }
    if (items.length <= this.maxItems) {
      return items;
    }
    return items.slice(items.length - this.maxItems);
  }
}
