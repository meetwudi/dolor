import { tool } from "@openai/agents";
import { z } from "zod";
import { sessionExtraStore } from "./session-extra-store";

const pickAthleteId = (data?: Record<string, unknown>) => {
  const value = data?.athleteId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export const sessionGetAthleteIdTool = tool({
  name: "session_get_athlete_id",
  description:
    "Fetch the stored Intervals.icu athlete ID for this chat session. Call get_session_id first to supply the correct sessionId.",
  parameters: z.object({
    sessionId: z
      .string()
      .min(1, "sessionId is required")
      .describe("Session identifier (fetch it via get_session_id)."),
  }),
  execute: async ({ sessionId }) => {
    const record = await sessionExtraStore.get(sessionId);
    return {
      sessionId,
      athleteId: pickAthleteId(record?.data) ?? null,
      updatedAt: record?.updatedAt ?? null,
    };
  },
});

export const sessionSetAthleteIdTool = tool({
  name: "session_set_athlete_id",
  description:
    "Save or update the Intervals.icu athlete ID for this chat session. Call get_session_id first, then pass the athleteId exactly as the athlete states it.",
  parameters: z.object({
    sessionId: z
      .string()
      .min(1, "sessionId is required")
      .describe("Session identifier (fetch it via get_session_id)."),
    athleteId: z
      .string()
      .min(1, "athleteId is required")
      .describe("Intervals.icu athlete identifier (alphanumeric)."),
  }),
  execute: async ({ sessionId, athleteId }) => {
    const normalizedId = athleteId.trim();
    const record = await sessionExtraStore.merge(sessionId, {
      athleteId: normalizedId,
    });
    return {
      sessionId,
      athleteId: pickAthleteId(record.data),
      updatedAt: record.updatedAt ?? null,
    };
  },
});
