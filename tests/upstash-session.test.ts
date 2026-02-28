import { describe, expect, test } from "bun:test";
import type { AgentInputItem } from "@openai/agents";
import { UpstashSession } from "../lib/upstash-session";

type MemoryRedis = {
  get: (key: string) => Promise<AgentInputItem[] | null>;
  set: (key: string, value: AgentInputItem[]) => Promise<void>;
  del: (key: string) => Promise<void>;
};

const createMemoryRedis = (): MemoryRedis => {
  const map = new Map<string, AgentInputItem[]>();
  return {
    async get(key: string) {
      return map.get(key) ?? null;
    },
    async set(key: string, value: AgentInputItem[]) {
      map.set(key, structuredClone(value));
    },
    async del(key: string) {
      map.delete(key);
    },
  };
};

describe("UpstashSession trimming", () => {
  test("drops orphan function_call_output when call is trimmed out", async () => {
    const redis = createMemoryRedis();
    const session = new UpstashSession({
      redis: redis as any,
      sessionId: "test-session",
      maxItems: 2,
    });

    await session.addItems([
      {
        type: "function_call",
        id: "call_1",
        name: "test_tool",
        arguments: "{}",
      } as any,
      {
        type: "function_call_output",
        call_id: "call_1",
        output: "{}",
      } as any,
      {
        type: "message",
        role: "assistant",
        content: "done",
      } as any,
    ]);

    const items = await session.getItems();
    expect(items.some((item: any) => item.type === "function_call_output")).toBe(
      false,
    );
    expect(items.length).toBe(1);
  });
});

