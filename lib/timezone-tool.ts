import { tool } from "@openai/agents";
import { z } from "zod";

const DEFAULT_TIME_ZONE = "America/Los_Angeles";

const formatDate = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const formatTime = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

const formatDateTime = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);

const extractTimeZoneName = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(date);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? null;
};

export const getCurrentTimeTool = tool({
  name: "get_current_time",
  description:
    "Returns the current date and time for a requested IANA timezone. Use this tool to find out the athelete's current local time.",
  parameters: z.object({
    timeZone: z
      .string()
      .describe(
        "IANA timezone identifier, e.g. America/Los_Angeles.",
      ),
  }),
  execute: async ({ timeZone }) => {
    const resolvedTimeZone = timeZone || DEFAULT_TIME_ZONE;
    const now = new Date();
    return {
      timeZone: resolvedTimeZone,
      iso: now.toISOString(),
      date: formatDate(now, resolvedTimeZone),
      time: formatTime(now, resolvedTimeZone),
      dateTime: formatDateTime(now, resolvedTimeZone),
      timeZoneName: extractTimeZoneName(now, resolvedTimeZone),
    };
  },
});
