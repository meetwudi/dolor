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
import { cleanHistoryItems } from "./history-utils";
import { withSessionContext } from "./session-context";

export const appendHistory: SessionInputCallback = (history, newItems) => {
  const cleanedHistory = cleanHistoryItems(history);
  const cleanedNewItems = cleanHistoryItems(newItems);

  return [...cleanedHistory, ...cleanedNewItems];
};

export type GreetingOptions = {
  session: Session;
  athleteId?: string;
};

export type IntervalsInstructionOptions = {
  athleteId?: string;
};

export const buildIntervalsInstruction = ({ athleteId }: IntervalsInstructionOptions = {}) => {
  const intervalsGuidance = athleteId
    ? `You already have Intervals.icu access for athlete ${athleteId}.`
    : "If the athlete hasn't connected Intervals.icu yet, remind them to visit the Dolor link (or run /connect in Telegram) before you attempt any Intervals tools.";

  return `${intervalsGuidance}
- If the user did not ask for a workout, do not suggest a workout.
- Never add follow-up solicitation language like "if you want...", "let me know if...", "I can also...", or "would you like...".
- Do not end with optional offers or invitations unless the user explicitly asks for options.
- Do not ask follow-up questions unless needed to fill missing required information.
- Default to the athlete being in San Francisco (America/Los_Angeles); call get_current_time when you need the exact local date or time.`;
};

export const sendDolorGreeting = async ({
  session,
  athleteId,
}: GreetingOptions) => {
  const sessionId = await session.getSessionId();
  const items: AgentInputItem[] = [
    system(buildIntervalsInstruction({ athleteId })),
    user(
      "Start the session with a concise, encouraging greeting and invite the athlete to share what they need help with today.",
    ),
  ];

  const result = await withSessionContext({ sessionId }, () =>
    run(fitnessAgent, items, {
      session,
      sessionInputCallback: appendHistory,
    }),
  );

  return typeof result.finalOutput === "string"
    ? result.finalOutput
    : extractAllTextOutput(result.newItems) ||
        "Hello! I'm ready to help—what do you need today?";
};
