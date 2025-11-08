import { describe, expect, test } from "bun:test";
import type { AgentInputItem } from "@openai/agents";
import { cleanHistoryItems } from "../lib/history-utils";

const buildAssistantMessage = (content: string): AgentInputItem => ({
  type: "message",
  role: "assistant",
  content,
});

describe("cleanHistoryItems", () => {
  test("removes entries that contain large tool payloads anywhere in the object graph", () => {
    const items: AgentInputItem[] = [
      {
        type: "tool",
        name: "list_intervals_events",
      },
      {
        type: "metadata" as any,
        some: { nested: "get_intervals_activity_intervals" },
      },
      buildAssistantMessage("kept"),
    ];

    const cleaned = cleanHistoryItems(items);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0]).toEqual(buildAssistantMessage("kept"));
  });

  test("drops reasoning items that are not followed by a message", () => {
    const items: AgentInputItem[] = [
      { type: "reasoning", content: [{ type: "text", text: "thinking" }] } as any,
      buildAssistantMessage("answer"),
      { type: "reasoning", content: [{ type: "text", text: "dangling" }] } as any,
    ];

    const cleaned = cleanHistoryItems(items);
    expect(cleaned).toHaveLength(2);
    expect(cleaned[0]?.type).toBe("reasoning");
    expect(cleaned[1]?.type).toBe("message");
  });

  test("preserves reasoning + message pairs", () => {
    const reasoning: AgentInputItem = {
      type: "reasoning",
      content: [{ type: "text", text: "plan" }],
    } as any;
    const message = buildAssistantMessage("done");
    const cleaned = cleanHistoryItems([reasoning, message]);
    expect(cleaned).toEqual([reasoning, message]);
  });

  test("returns cloned items so callers cannot mutate the stored history", () => {
    const message = buildAssistantMessage("immutable");
    const cleaned = cleanHistoryItems([message]);
    expect(cleaned[0]).not.toBe(message);
    expect(cleaned[0]).toEqual(message);
  });
});
