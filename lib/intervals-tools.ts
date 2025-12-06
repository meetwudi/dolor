import { tool } from "@openai/agents";
import { z } from "zod";
import {
  createIntervalsClientForSession,
  requireIntervalsClientWithAthlete,
  type Activity,
  type ActivityIntervals,
  type ActivityMessage,
  type ListWellnessRecordsResult,
  type Event,
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

const summarizeEvent = (event: Event) => ({
  id: event.id ?? null,
  name: event.name ?? null,
  category: event.category ?? null,
  target: event.target ?? null,
  start_date_local: event.start_date_local ?? null,
  end_date_local: event.end_date_local ?? null,
  calendar_id: event.calendar_id ?? null,
  description: event.description ?? null,
  strain_score: event.strain_score ?? null,
  workout_id: event.workout?.id ?? null,
  updated: event.updated ?? null,
});

export const listIntervalsActivitiesTool = tool({
  name: "list_intervals_activities",
  description:
    "Fetch the connected athlete's Intervals.icu activities within a date range. Defaults to the last 7 days ending today in the athlete's San Francisco (America/Los_Angeles) timezone when no dates are given—do NOT ask the user to confirm this fallback. Returns summary rows (name, start_time, duration, type, power_load/hr_load).",
  parameters: z.object({
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
  execute: async ({ oldest, newest }) => {
    const defaultRange = getDefaultActivityDateRange();
    const resolvedOldest = oldest.trim()
      ? oldest
      : defaultRange.oldest;
    const resolvedNewest = newest.trim()
      ? newest
      : defaultRange.newest;

    const { client, athleteId } = await requireIntervalsClientWithAthlete();
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

export const listIntervalsEventsTool = tool({
  name: "list_intervals_events",
  description:
    "List the connected athlete's Intervals.icu calendar events (planned workouts, races, notes, etc.). Defaults to the last 7 days ending today in America/Los_Angeles when no dates are provided—do NOT stop to confirm that range, just mention it. The `description` field contains the workout text for structured workouts, so read/write it when you need the athlete-facing prescription.",
  parameters: z.object({
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
    categories: z
      .string()
      .describe(
        "Comma-separated categories to filter (WORKOUT,NOTE,etc.). Use an empty string for all.",
      ),
    limit: z
      .string()
      .describe(
        "Max number of events to return (integer). Use an empty string for the API default.",
      ),
    calendarId: z
      .string()
      .describe(
        "Numeric calendar_id to filter. Use an empty string to include all calendars.",
      ),
    resolve: z
      .string()
      .describe(
        "Set to 'true' to resolve targets into watts/bpm/pace; otherwise leave empty for default.",
      ),
    locale: z
      .string()
      .describe(
        "Locale code (en, es, de, etc.) for multi-lingual workouts, or empty to use the athlete default.",
      ),
  }),
  execute: async ({ oldest, newest, categories, limit, calendarId, resolve, locale }) => {
    const defaultRange = getDefaultActivityDateRange();
    const resolvedOldest = oldest.trim()
      ? oldest
      : defaultRange.oldest;
    const resolvedNewest = newest.trim()
      ? newest
      : defaultRange.newest;

    const resolvedCategories = categories.trim() || undefined;
    const parsedLimit = limit.trim() ? Number.parseInt(limit.trim(), 10) : undefined;
    const resolvedLimit =
      parsedLimit !== undefined && Number.isFinite(parsedLimit) ? parsedLimit : undefined;
    const parsedCalendarId = calendarId.trim()
      ? Number.parseInt(calendarId.trim(), 10)
      : undefined;
    const resolvedCalendarId =
      parsedCalendarId !== undefined && Number.isFinite(parsedCalendarId)
        ? parsedCalendarId
        : undefined;
    const resolvedResolve =
      resolve.trim() === ""
        ? undefined
        : resolve.trim().toLowerCase() === "true";
    const resolvedLocale = locale.trim() || undefined;

    const { client, athleteId } = await requireIntervalsClientWithAthlete();
    const events = await client.listEvents({
      oldest: resolvedOldest,
      newest: resolvedNewest,
      categories: resolvedCategories,
      limit: Number.isNaN(resolvedLimit ?? NaN) ? undefined : resolvedLimit,
      calendarId: Number.isNaN(resolvedCalendarId ?? NaN)
        ? undefined
        : resolvedCalendarId,
      resolve: resolvedResolve,
      locale: resolvedLocale,
    });

    return {
      oldest: resolvedOldest,
      newest: resolvedNewest,
      count: events.length,
      events: events.map(summarizeEvent),
    };
  },
});

export const updateIntervalsEventTool = tool({
  name: "update_intervals_event",
  description:
    "Update an Intervals.icu calendar event (planned workout, race, or note). Patching the `description` field is the way to store the workout text you generated. Supply only the fields you intend to modify via payload_json (e.g., {\"description\": \"...\"}).",
  parameters: z.object({
    eventId: z
      .union([z.string(), z.number()])
      .describe("Event identifier from list_intervals_events."),
    payload_json: z
      .string()
      .min(2, "payload_json must not be empty")
      .describe(
        "Stringified JSON body to send to Intervals.icu. Include only the fields you want to update (e.g., description, start_date_local, target).",
      ),
  }),
  execute: async ({ eventId, payload_json }) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(payload_json);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid JSON payload.";
      throw new Error(`Failed to parse payload_json: ${message}`);
    }

    const { client, athleteId } = await requireIntervalsClientWithAthlete();
    const event = await client.updateEvent({
      athleteId,
      eventId,
      data,
    });

    return summarizeEvent(event);
  },
});

export const createIntervalsEventTool = tool({
  name: "create_intervals_event",
  description:
    "Create an Intervals.icu calendar event (planned workout, race, note, etc.). Populate the `description` field with workout text when you generate a structured workout. Set upsertOnUid to true when you want to update an existing event that shares the same UID instead of creating a duplicate.",
  parameters: z.object({
    payload_json: z
      .string()
      .min(2, "payload_json must not be empty")
      .describe(
        "Stringified JSON body for POST /athlete/{id}/events (include start_date_local, category, description, etc.).",
      ),
    upsertOnUid: z
      .string()
      .describe(
        "Set to 'true' to update an existing event with the same uid; leave empty to always create a new event.",
      ),
  }),
  execute: async ({ payload_json, upsertOnUid }) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(payload_json);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid JSON payload.";
      throw new Error(`Failed to parse payload_json: ${message}`);
    }

    const resolvedUpsert =
      upsertOnUid.trim() === ""
        ? undefined
        : upsertOnUid.trim().toLowerCase() === "true";

    const { client, athleteId } = await requireIntervalsClientWithAthlete();
    const event = await client.createEvent({
      athleteId,
      data,
      upsertOnUid: resolvedUpsert,
    });

    return summarizeEvent(event);
  },
});

export const getIntervalsActivityTool = tool({
  name: "get_intervals_activity",
  description:
    "Fetch a single Intervals.icu activity with all metadata (power/hr/pace loads, device info, notes, etc.). Set includeIntervals=true when you want the interval arrays embedded in the same response; otherwise keep it false and call get_intervals_activity_intervals for a slimmer interval-only payload. Prefer this when you need the entire activity context in one call.",
  parameters: z.object({
    activityId: z
      .union([z.string(), z.number()])
      .describe(
        "Intervals.icu activity identifier (found via list_intervals_activities or athlete share).",
      ),
    includeIntervals: z
      .boolean()
      .describe(
        "Set to true to embed interval data directly in the activity response; false keeps the payload lighter.",
      ),
  }),
  execute: async ({ activityId, includeIntervals }) => {
    const client = await createIntervalsClientForSession();
    return client.getActivity({ activityId, includeIntervals });
  },
});

export const getIntervalsWellnessRecordTool = tool({
  name: "get_intervals_wellness_record",
  description:
    "Fetch a single Intervals.icu wellness record for the connected athlete on a specific local date (YYYY-MM-DD). Records include CTL/ATL/rampRate loads, weight, restingHR, HRV + SDNN, sleep duration/score/quality, avg sleep HR, soreness/fatigue/stress/mood/motivation/injury, SpO2, blood pressure, hydration + volume, readiness/Baevsky SI, calories, steps, respiration, menstrual phases, body fat/abdomen/VO2max, blood glucose, lactate, comments, and sport-specific FTP/CP metrics.",
  parameters: z.object({
    date: z
      .string()
      .min(1, "date is required")
      .describe("Local date in YYYY-MM-DD format."),
  }),
  execute: async ({ date }) => {
    const { client, athleteId } = await requireIntervalsClientWithAthlete();
    const record = await client.getWellnessRecord({ athleteId, date });
    return record;
  },
});

export const updateIntervalsWellnessCommentTool = tool({
  name: "update_intervals_wellness_comment",
  description:
    "Update the wellness comment for the connected Intervals.icu athlete on a specific date. Use this tool to log notes about the athlete on a given day (especially when they volunteer how they're doing today) and do NOT need to re-confirm with them before logging.",
  parameters: z.object({
    date: z
      .string()
      .describe("Date in YYYY-MM-DD format to match the wellness entry."),
    comments: z
      .string()
      .min(1, "comments cannot be empty")
      .describe("Freeform wellness note to store for that date."),
  }),
  execute: async ({ date, comments }) => {
    console.log("[Updating wellness records...]");

    const { client, athleteId } = await requireIntervalsClientWithAthlete();
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
    "List Intervals.icu wellness records (same CTL/ATL/rampRate, weight, restingHR/HRV, sleep, soreness/fatigue/stress/mood/motivation/injury, SpO2, BP, hydration, readiness, calories, steps, respiration, menstrual phases, composition, blood glucose, lactate, comments, sport FTP metrics, etc.) for the connected athlete between two local dates. Provide '.csv' in ext for CSV output or leave blank for JSON—the response tells you which via its `format` field. cols/fields are comma-separated lists; use empty strings when no filtering is needed.",
  parameters: z.object({
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
  execute: async ({ ext, oldest, newest, cols, fields }) => {
    const { client, athleteId } = await requireIntervalsClientWithAthlete();
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
    "Fetch only the interval breakdown (icu_intervals and icu_groups) for a specific Intervals.icu activity. Use this when you want the concise interval view (power, cadence, HR, strain, etc.) without the rest of the activity metadata. For the complete activity plus optional intervals in a single call, use get_intervals_activity instead.",
  parameters: z.object({
    activityId: z
      .union([z.string(), z.number()])
      .describe(
        "Intervals.icu activity identifier. You can get it from list_intervals_activities or the athlete directly.",
      ),
  }),
  execute: async ({ activityId }) => {
    const client = await createIntervalsClientForSession();
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
    const client = await createIntervalsClientForSession();
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
    const client = await createIntervalsClientForSession();
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
