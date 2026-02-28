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
    const repair = (window: AgentInputItem[]) => {
      const knownCallIds = new Set<string>();
      const maybeRecordCallId = (item: any) => {
        const explicitCallId =
          typeof item?.call_id === "string" ? item.call_id : null;
        const id =
          typeof item?.id === "string" ? item.id : null;
        const type = typeof item?.type === "string" ? item.type : "";
        if (explicitCallId && !type.includes("output")) {
          knownCallIds.add(explicitCallId);
          return;
        }
        if (
          id &&
          (type.includes("call") ||
            type === "tool" ||
            type === "function_call")
        ) {
          knownCallIds.add(id);
        }
      };

      const repaired: AgentInputItem[] = [];
      for (const item of window) {
        const typed = item as any;
        const type = typeof typed?.type === "string" ? typed.type : "";
        const outputCallId =
          type.includes("output") && typeof typed?.call_id === "string"
            ? typed.call_id
            : null;
        if (outputCallId && !knownCallIds.has(outputCallId)) {
          continue;
        }
        repaired.push(item);
        maybeRecordCallId(typed);
      }
      return repaired;
    };

    if (this.maxItems <= 0) {
      return [];
    }
    if (items.length <= this.maxItems) {
      return repair(items);
    }
    return repair(items.slice(items.length - this.maxItems));
  }
}
