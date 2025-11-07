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

export const appendHistory: SessionInputCallback = (history, newItems) => [
  // Filter out type: "reasoning" that is not followed by type: "message"
  // https://github.com/openai/codex/issues/5990
  ...history.filter((item, index, arr) => {
    if (item.type !== "reasoning") return true;
    if (index >= arr.length - 1) return false;
    const nextItem = arr[index + 1];
    return nextItem?.type === "message";
  }),
  ...newItems,
];

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
