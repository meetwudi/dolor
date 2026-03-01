import type { AgentInputItem } from "@openai/agents";

const LARGE_INTERVAL_TOOLS = new Set([
  "list_intervals_activities",
  "list_intervals_events",
  "get_intervals_activity",
  "get_intervals_activity_intervals",
  "list_intervals_chat_messages",
  "list_intervals_wellness_records",
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

const recursivelyStripReasoningKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => recursivelyStripReasoningKeys(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const next: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase();
    if (
      normalized === "reasoning" ||
      normalized === "reasoning_id" ||
      normalized === "reasoningid" ||
      normalized.includes("reasoning")
    ) {
      continue;
    }
    next[key] = recursivelyStripReasoningKeys(nested);
  }
  return next;
};

const stripReasoningReferences = (item: AgentInputItem) => {
  const cloned = recursivelyStripReasoningKeys(structuredClone(item)) as Record<
    string,
    unknown
  >;
  if (!cloned || typeof cloned !== "object") {
    return cloned as AgentInputItem;
  }

  // Message IDs can carry hard dependencies on reasoning items (rs_*).
  // Keep tool/call IDs intact for function_call_output pairing.
  const type = typeof cloned.type === "string" ? cloned.type : "";
  if (type === "message" && "id" in cloned) {
    delete cloned.id;
  }
  return cloned as AgentInputItem;
};

export const cleanHistoryItems = (items: AgentInputItem[]): AgentInputItem[] =>
  dropReasoningItems(dropLargeToolOutputs(items)).map((item) => stripReasoningReferences(item));
