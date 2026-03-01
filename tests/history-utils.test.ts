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
      {
        type: "tool",
        name: "get_intervals_activity",
        id: "call",
      },
      buildAssistantMessage("kept"),
    ];

    const cleaned = cleanHistoryItems(items);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0]).toEqual(buildAssistantMessage("kept"));
  });

  test("drops all reasoning items", () => {
    const reasoning: AgentInputItem = {
      type: "reasoning",
      content: [{ type: "text", text: "plan" }],
    } as any;
    const message = buildAssistantMessage("done");
    const cleaned = cleanHistoryItems([reasoning, message]);
    expect(cleaned).toEqual([message]);
  });

  test("removes reasoning references from assistant messages", () => {
    const message: AgentInputItem = {
      ...buildAssistantMessage("with plan"),
      reasoning: { id: "rs_123" },
      id: "msg_1",
    } as any;
    const cleaned = cleanHistoryItems([message]);
    expect(cleaned[0]).toEqual(buildAssistantMessage("with plan"));
    expect((cleaned[0] as any).reasoning).toBeUndefined();
    expect((cleaned[0] as any).id).toBeUndefined();
  });

  test("removes reasoning references from tool calls", () => {
    const toolCall: AgentInputItem = {
      type: "tool",
      name: "test_tool",
      reasoning: { id: "rs_tool" },
      id: "call_1",
    } as any;
    const cleaned = cleanHistoryItems([toolCall]);
    expect(cleaned[0]).toEqual({
      type: "tool",
      name: "test_tool",
      id: "call_1",
    });
    expect((cleaned[0] as any).id).toBe("call_1");
  });

  test("strips nested reasoning keys deeply", () => {
    const item: AgentInputItem = {
      type: "message",
      role: "assistant",
      id: "msg_nested",
      content: [{ type: "output_text", text: "ok" }],
      metadata: {
        nestedReasoningId: "rs_abc",
        child: { reasoning_id: "rs_xyz", keep: "yes" },
      },
    } as any;
    const cleaned = cleanHistoryItems([item])[0] as any;
    expect(cleaned.id).toBeUndefined();
    expect(cleaned.metadata?.nestedReasoningId).toBeUndefined();
    expect(cleaned.metadata?.child?.reasoning_id).toBeUndefined();
    expect(cleaned.metadata?.child?.keep).toBe("yes");
  });

  test("returns cloned items so callers cannot mutate the stored history", () => {
    const message = buildAssistantMessage("immutable");
    const cleaned = cleanHistoryItems([message]);
    expect(cleaned[0]).not.toBe(message);
    expect(cleaned[0]).toEqual(message);
  });
});
