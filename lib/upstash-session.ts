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

const LARGE_INTERVAL_TOOLS = new Set([
  "list_intervals_activities",
  "get_intervals_activity_intervals",
  "list_intervals_chat_messages",
]);

const valueContainsLargeToolName = (
  value: unknown,
  seen = new WeakSet<object>(),
): boolean => {
  if (typeof value === "string") {
    return LARGE_INTERVAL_TOOLS.has(value);
  }
  if (!value || typeof value !== "object") return false;
  if (seen.has(value as object)) return false;
  seen.add(value as object);

  for (const nested of Object.values(value as Record<string, unknown>)) {
    if (typeof nested === "string" && LARGE_INTERVAL_TOOLS.has(nested)) {
      return true;
    }
    if (valueContainsLargeToolName(nested, seen)) {
      return true;
    }
  }
  return false;
};

const sanitizeItems = (items: AgentInputItem[]): AgentInputItem[] =>
  items
    .filter((item) => !(item && typeof item === "object" && valueContainsLargeToolName(item)))
    .map((item) => structuredClone(item));

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
      return sanitizeItems(items);
    }
    if (limit <= 0) {
      return [];
    }
    const start = Math.max(items.length - limit, 0);
    return sanitizeItems(items.slice(start));
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    if (!items.length) return;
    const existing = await this.readItems();
    const merged = [...existing, ...items];
    const sanitized = sanitizeItems(merged);
    await this.writeItems(sanitized);
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
    return data.map((item) => structuredClone(item));
  }

  private async writeItems(items: AgentInputItem[]): Promise<void> {
    if (!items.length) {
      await this.redis.del(this.key);
      return;
    }
    await this.redis.set(
      this.key,
      items.map((item) => structuredClone(item)),
      this.ttlSeconds ? { ex: this.ttlSeconds } : undefined,
    );
  }
}
