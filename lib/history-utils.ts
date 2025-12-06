import type { AgentInputItem } from "@openai/agents";

const LARGE_INTERVAL_TOOLS = new Set([
  "list_intervals_activities",
  "list_intervals_events",
  "get_intervals_activity_intervals",
  "list_intervals_chat_messages",
  "update_intervals_event",
  "create_intervals_event",
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

const dropLargeToolOutputs = (items: AgentInputItem[]) =>
  items.filter((item) => {
    if (item && typeof item === "object" && valueContainsLargeToolName(item)) {
      return false;
    }
    return true;
  });

const dropReasoningItems = (items: AgentInputItem[]) =>
  items.filter((item) => item?.type !== "reasoning");

const stripReasoningReferences = (item: AgentInputItem) => {
  const cloned = structuredClone(item);
  if (!cloned || typeof cloned !== "object") {
    return cloned;
  }
  if (
    "id" in cloned &&
    ((cloned as AgentInputItem).type === "message" || (cloned as AgentInputItem).type === "tool")
  ) {
    delete (cloned as { id?: unknown }).id;
  }
  if ("reasoning" in cloned) {
    delete (cloned as { reasoning?: unknown }).reasoning;
  }
  if ("reasoning_id" in cloned) {
    delete (cloned as { reasoning_id?: unknown }).reasoning_id;
  }
  if ("reasoningId" in cloned) {
    delete (cloned as { reasoningId?: unknown }).reasoningId;
  }
  return cloned;
};

export const cleanHistoryItems = (items: AgentInputItem[]): AgentInputItem[] =>
  dropReasoningItems(dropLargeToolOutputs(items)).map((item) => stripReasoningReferences(item));
