import { randomUUID } from "@openai/agents-core/_shims";
import type { AgentInputItem, Session } from "@openai/agents";
import { Redis } from "@upstash/redis";

type UpstashSessionOptions = {
  sessionId?: string;
  redis?: Redis;
  keyPrefix?: string;
  ttlSeconds?: number;
};

const DEFAULT_KEY_PREFIX = "agent-session:";

export class UpstashSession implements Session {
  private readonly redis: Redis;
  private readonly sessionId: string;
  private readonly key: string;
  private readonly ttlSeconds?: number;

  constructor(options: UpstashSessionOptions = {}) {
    this.sessionId = options.sessionId ?? randomUUID();
    this.redis = options.redis ?? Redis.fromEnv();
    this.key = `${options.keyPrefix ?? DEFAULT_KEY_PREFIX}${this.sessionId}`;
    this.ttlSeconds = options.ttlSeconds;
  }

  async getSessionId(): Promise<string> {
    return this.sessionId;
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    const items = await this.readItems();
    if (limit === undefined) {
      return cloneAgentItems(items);
    }
    if (limit <= 0) {
      return [];
    }
    const start = Math.max(items.length - limit, 0);
    return cloneAgentItems(items.slice(start));
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    if (!items.length) return;
    const existing = await this.readItems();
    const merged = existing.concat(cloneAgentItems(items));
    await this.writeItems(merged);
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    const items = await this.readItems();
    if (!items.length) return undefined;
    const popped = items.pop();
    if (!popped) return undefined;
    await this.writeItems(items);
    return cloneAgentItem(popped);
  }

  async clearSession(): Promise<void> {
    await this.redis.del(this.key);
  }

  private async readItems(): Promise<AgentInputItem[]> {
    const data = await this.redis.get<AgentInputItem[]>(this.key);
    if (!Array.isArray(data)) return [];
    return cloneAgentItems(data);
  }

  private async writeItems(items: AgentInputItem[]): Promise<void> {
    if (!items.length) {
      await this.redis.del(this.key);
      return;
    }
    const cloned = cloneAgentItems(items);
    await this.redis.set(this.key, cloned, this.ttlSeconds ? { ex: this.ttlSeconds } : undefined);
  }
}

const cloneAgentItem = <T extends AgentInputItem>(item: T): T =>
  structuredClone(item);

const cloneAgentItems = <T extends AgentInputItem>(items: T[]): T[] =>
  items.map((item) => cloneAgentItem(item));
