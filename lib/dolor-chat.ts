import {
  extractAllTextOutput,
  type Session,
  run,
  system,
  user,
  type AgentInputItem,
  type SessionInputCallback,
} from "@openai/agents";
import { fitnessAgent } from "./fitness-agent";

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
  if (value === null || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (seen.has(obj)) return false;
  seen.add(obj);

  for (const key of Object.keys(obj)) {
    const field = obj[key];
    if (typeof field === "string" && LARGE_INTERVAL_TOOLS.has(field)) {
      return true;
    }
    if (valueContainsLargeToolName(field, seen)) {
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
    if (item.type !== "reasoning") return true;
    if (index >= arr.length - 1) return false;
    const nextItem = arr[index + 1];
    return nextItem?.type === "message";
  });

export const appendHistory: SessionInputCallback = (history, newItems) => {
  const cleanedHistory = removeOrphanReasoning(dropLargeToolOutputs(history));
  const cleanedNewItems = removeOrphanReasoning(dropLargeToolOutputs(newItems));

  return [...cleanedHistory, ...cleanedNewItems];
};

export type GreetingOptions = {
  session: Session;
  athleteId?: string;
};

export const buildIntervalsInstruction = (athleteId?: string) => {
  const intervalsGuidance = athleteId
    ? `You can query Intervals.icu for athlete ${athleteId}.`
    : "Ask the athlete for their Intervals.icu athlete ID before calling any intervals.icu tool";

  return `${intervalsGuidance}
- If the user did not ask for a workout, do not suggest a workout.
- Default to the athlete being in San Francisco (America/Los_Angeles); call get_current_time when you need the exact local date or time.`;
};

export const sendDolorGreeting = async ({
  session,
  athleteId,
}: GreetingOptions) => {
  const items: AgentInputItem[] = [
    system(buildIntervalsInstruction(athleteId)),
    user(
      "Start the session with a concise, encouraging greeting and invite the athlete to share what they need help with today.",
    ),
  ];

  const result = await run(fitnessAgent, items, {
    session,
    sessionInputCallback: appendHistory,
  });

  return typeof result.finalOutput === "string"
    ? result.finalOutput
    : extractAllTextOutput(result.newItems) || "[No response]";
};
