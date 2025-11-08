import { tool } from "@openai/agents";
import { z } from "zod";
import {
  IntervalsClient,
  type Activity,
  type ActivityIntervals,
  type ActivityMessage,
  type ListWellnessRecordsResult,
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

const summarizeChatMessage = (message: ActivityMessage) => ({
  id: message.id,
  athlete_id: message.athlete_id ?? null,
  name: message.name ?? null,
  created: message.created ?? null,
  type: message.type ?? null,
  content: message.content ?? null,
  activity_id: message.activity_id ?? null,
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
        'Start date (YYYY-MM-DD). Use an empty string to default to 6 days prior in America/Los_Angeles.',
      ),
    newest: z
      .string()
      .describe(
        "End date (YYYY-MM-DD). Use an empty string to default to today in America/Los_Angeles.",
      ),
  }),
  execute: async ({ athleteId, oldest, newest }) => {
    const defaultRange = getDefaultActivityDateRange();
    const resolvedOldest = oldest.trim()
      ? oldest
      : defaultRange.oldest;
    const resolvedNewest = newest.trim()
      ? newest
      : defaultRange.newest;

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

export const getIntervalsWellnessRecordTool = tool({
  name: "get_intervals_wellness_record",
  description:
    "Fetch a single Intervals.icu wellness record for an athlete on a specific local date (YYYY-MM-DD). Records include CTL/ATL/rampRate loads, weight, restingHR, HRV + SDNN, sleep duration/score/quality, avg sleep HR, soreness/fatigue/stress/mood/motivation/injury, SpO2, blood pressure, hydration + volume, readiness/Baevsky SI, calories, steps, respiration, menstrual phases, body fat/abdomen/VO2max, blood glucose, lactate, comments, and sport-specific FTP/CP metrics.",
  parameters: z.object({
    athleteId: z
      .string()
      .min(1, "athleteId is required")
      .describe("Intervals.icu athlete identifier (usually numeric)."),
    date: z
      .string()
      .min(1, "date is required")
      .describe("Local date in YYYY-MM-DD format."),
  }),
  execute: async ({ athleteId, date }) => {
    const client = new IntervalsClient();
    const record = await client.getWellnessRecord({ athleteId, date });
    return record;
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

export const listIntervalsWellnessRecordsTool = tool({
  name: "list_intervals_wellness_records",
  description:
    "List Intervals.icu wellness records (same CTL/ATL/rampRate, weight, restingHR/HRV, sleep, soreness/fatigue/stress/mood/motivation/injury, SpO2, BP, hydration, readiness, calories, steps, respiration, menstrual phases, composition, blood glucose, lactate, comments, sport FTP metrics, etc.) for an athlete between two local dates. Provide '.csv' in ext for CSV output or leave blank for JSON—the response tells you which via its `format` field. cols/fields are comma-separated lists; use empty strings when no filtering is needed.",
  parameters: z.object({
    athleteId: z
      .string()
      .min(1, "athleteId is required")
      .describe("Intervals.icu athlete identifier (usually numeric)."),
    ext: z
      .string()
      .describe(
        "Extension appended to /wellness ('' for JSON, '.csv' for CSV export).",
      ),
    oldest: z
      .string()
      .min(1, "oldest date is required")
      .describe("Start date (YYYY-MM-DD)."),
    newest: z
      .string()
      .min(1, "newest date is required")
      .describe("End date (YYYY-MM-DD), inclusive."),
    cols: z
      .string()
      .describe(
        "Comma separated column names for CSV export. Use an empty string for defaults.",
      ),
    fields: z
      .string()
      .describe(
        "Comma separated JSON fields to include. Use an empty string for defaults.",
      ),
  }),
  execute: async ({ athleteId, ext, oldest, newest, cols, fields }) => {
    const client = new IntervalsClient();
    const result: ListWellnessRecordsResult =
      await client.listWellnessRecords({
        athleteId,
        ext,
        oldest,
        newest,
        cols,
        fields,
      });
    return result;
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

export const addIntervalsActivityCommentTool = tool({
  name: "add_intervals_activity_comment",
  description:
    "Post a coaching comment on a specific Intervals.icu activity. Use this to leave feedback or reminders tied to a workout; the athlete will see it in the activity chat.",
  parameters: z.object({
    activityId: z
      .union([z.string(), z.number()])
      .describe(
        "Intervals.icu activity identifier (same as returned by list_intervals_activities).",
      ),
    content: z
      .string()
      .min(1, "content cannot be empty")
      .describe("The message to post. Keep it concise and actionable."),
  }),
  execute: async ({ activityId, content }) => {
    const client = new IntervalsClient();
    const result = await client.addActivityMessage({
      activityId,
      content,
    });
    return {
      messageId: result.id,
      chatId: result.new_chat?.id ?? null,
    };
  },
});

export const listIntervalsChatMessagesTool = tool({
  name: "list_intervals_chat_messages",
  description:
    "List the most recent messages from an Intervals.icu chat (e.g., an activity chat). Use this to review what you or the athlete already discussed before adding new guidance.",
  parameters: z.object({
    chatId: z
      .union([z.string(), z.number()])
      .describe(
        "Intervals.icu chat identifier (for activity chats this is often activity.icu_chat_id).",
      ),
    beforeId: z
      .string()
      .describe("Only return messages older than this ID. Provide an empty string to skip."),
    limit: z
      .number()
      .int()
      .min(0)
      .max(100)
      .describe("Maximum number of messages to return. Use 0 to accept the default (30)."),
  }),
  execute: async ({ chatId, beforeId, limit }) => {
    const client = new IntervalsClient();
    const trimmedBefore = beforeId.trim();
    const messages = await client.listChatMessages({
      chatId,
      beforeId: trimmedBefore.length ? trimmedBefore : undefined,
      limit: limit && limit > 0 ? limit : undefined,
    });

    return {
      chatId: String(chatId),
      count: messages.length,
      messages: messages.map(summarizeChatMessage),
    };
  },
});
