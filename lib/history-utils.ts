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

const removeOrphanReasoning = (items: AgentInputItem[]) =>
  items.filter((item, index, arr) => {
    if (item?.type !== "reasoning") return true;
    const next = arr[index + 1];
    return !!next && next.type === "message";
  });

export const cleanHistoryItems = (items: AgentInputItem[]): AgentInputItem[] =>
  removeOrphanReasoning(dropLargeToolOutputs(items)).map((item) => structuredClone(item));
