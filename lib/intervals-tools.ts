import { tool } from "@openai/agents";
import { z } from "zod";
import { IntervalsClient, type Activity } from "./intervals";

const summarizeActivity = (activity: Activity) => ({
  id: activity.id,
  name: activity.name ?? null,
  start_time: activity.start_date_local ?? activity.start_date ?? null,
  duration_s: activity.moving_time ?? null,
  type: activity.type ?? null,
  power_load: activity.power_load ?? null,
  hr_load: activity.hr_load ?? null,
});

export const listIntervalsActivitiesTool = tool({
  name: "list_intervals_activities",
  description:
    "Fetch Intervals.icu activities for an athlete within a required date range. Returns summary rows (name, start_time, duration, type, power_load/hr_load).",
  parameters: z.object({
    athleteId: z
      .string()
      .min(1, "athleteId is required")
      .describe("Intervals.icu athlete identifier (usually numeric)."),
    oldest: z
      .string()
      .describe("Start date (YYYY-MM-DD)."),
    newest: z
      .string()
      .describe("End date (YYYY-MM-DD)."),
  }),
  execute: async ({ athleteId, oldest, newest }) => {
    const client = new IntervalsClient();
    const activities = await client.listActivities({
      athleteId,
      oldest,
      newest,
      limit: 500,
    });

    return {
      oldest,
      newest,
      count: activities.length,
      activities: activities.map(summarizeActivity),
    };
  },
});
