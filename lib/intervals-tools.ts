import { tool } from "@openai/agents";
import { z } from "zod";
import {
  IntervalsClient,
  type Activity,
  type ActivityIntervals,
  type WellnessRecord,
} from "./intervals";

const SAN_FRANCISCO_TZ = "America/Los_Angeles";
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ACTIVITY_WINDOW_DAYS = 7;

const formatDateInTimeZone = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
};

const getDefaultActivityDateRange = () => {
  const now = new Date();
  const newest = formatDateInTimeZone(now, SAN_FRANCISCO_TZ);
  const oldest = formatDateInTimeZone(
    new Date(
      now.getTime() - (DEFAULT_ACTIVITY_WINDOW_DAYS - 1) * DAY_MS,
    ),
    SAN_FRANCISCO_TZ,
  );

  return { oldest, newest };
};

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
    "Fetch Intervals.icu activities for an athlete within a date range. Defaults to the last 7 days ending today in the athlete's San Francisco (America/Los_Angeles) timezone when no dates are given—do NOT ask the user to confirm this fallback. Returns summary rows (name, start_time, duration, type, power_load/hr_load).",
  parameters: z.object({
    athleteId: z
      .string()
      .min(1, "athleteId is required")
      .describe("Intervals.icu athlete identifier (usually numeric)."),
    oldest: z
      .string()
      .describe(
        "Start date (YYYY-MM-DD). Optional; defaults to 6 days prior in America/Los_Angeles.",
      ),
    newest: z
      .string()
      .describe(
        "End date (YYYY-MM-DD). Optional; defaults to today in America/Los_Angeles.",
      ),
  }),
  execute: async ({ athleteId, oldest, newest }) => {
    const defaultRange = getDefaultActivityDateRange();
    const resolvedOldest = oldest ?? defaultRange.oldest;
    const resolvedNewest = newest ?? defaultRange.newest;

    const client = new IntervalsClient();
    const activities = await client.listActivities({
      athleteId,
      oldest: resolvedOldest,
      newest: resolvedNewest,
      limit: 500,
    });

    return {
      oldest: resolvedOldest,
      newest: resolvedNewest,
      count: activities.length,
      activities: activities.map(summarizeActivity),
    };
  },
});

export const updateIntervalsWellnessCommentTool = tool({
  name: "update_intervals_wellness_comment",
  description:
    "Update the wellness comment for an Intervals.icu athlete on a specific date. Use this tool to log notes about the athlete on a given day (especially when they volunteer how they're doing today) and do NOT need to re-confirm with them before logging.",
  parameters: z.object({
    athleteId: z
      .string()
      .min(1, "athleteId is required")
      .describe("Intervals.icu athlete identifier (usually numeric)."),
    date: z
      .string()
      .describe("Date in YYYY-MM-DD format to match the wellness entry."),
    comments: z
      .string()
      .min(1, "comments cannot be empty")
      .describe("Freeform wellness note to store for that date."),
  }),
  execute: async ({ athleteId, date, comments }) => {
    console.log("[Updating wellness records...]");

    const client = new IntervalsClient();
    const record = await client.updateWellnessRecord({
      athleteId,
      date,
      data: {
        id: athleteId,
        updated: new Date().toISOString(),
        comments,
      },
    });

    const summary: Pick<
      WellnessRecord,
      "id" | "comments" | "updated" | "restingHR" | "fatigue" | "mood"
    > & { date: string } = {
      id: record.id,
      comments: record.comments ?? null,
      updated: record.updated ?? null,
      restingHR: record.restingHR ?? null,
      fatigue: record.fatigue ?? null,
      mood: record.mood ?? null,
      date,
    };

    return summary;
  },
});

export const getIntervalsActivityIntervalsTool = tool({
  name: "get_intervals_activity_intervals",
  description:
    "Fetch the full interval breakdown (icu_intervals and icu_groups) for a specific Intervals.icu activity. Use this when you need detailed workout interval performance metrics like power, cadence, heart rate, or strain for targeted coaching.",
  parameters: z.object({
    activityId: z
      .union([z.string(), z.number()])
      .describe(
        "Intervals.icu activity identifier. You can get it from list_intervals_activities or the athlete directly.",
      ),
  }),
  execute: async ({ activityId }) => {
    const client = new IntervalsClient();
    const resolvedId =
      typeof activityId === "number" ? activityId.toString() : activityId;
    if (!resolvedId) {
      throw new Error("activityId is required");
    }
    const intervals: ActivityIntervals =
      await client.getActivityIntervals(resolvedId);
    return {
      activityId: resolvedId,
      analyzed: intervals.analyzed ?? null,
      icu_intervals: intervals.icu_intervals ?? [],
      icu_groups: intervals.icu_groups ?? [],
    };
  },
});
