#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { IntervalsClient } from "../lib/intervals";

const usage = () => `
Usage: bun scripts/intervals-cli.ts --athlete-id <id> [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--limit 50] [--json]

Environment:
  INTERVALS_API_KEY   Required. API key from https://intervals.icu (Settings → API).
`.trim();

const main = async () => {
  const parsed = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "athlete-id": { type: "string", short: "a" },
      start: { type: "string", short: "s" },
      end: { type: "string", short: "e" },
      limit: { type: "string", short: "l" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  const args = {
    athleteId: parsed.values["athlete-id"],
    start: parsed.values.start,
    end: parsed.values.end,
    limit: parsed.values.limit
      ? Number.parseInt(parsed.values.limit, 10)
      : undefined,
    json: Boolean(parsed.values.json),
    help: Boolean(parsed.values.help),
  };

  if (args.help) {
    console.log(usage());
    return;
  }

  if (!args.athleteId) {
    console.error("Missing required --athlete-id.\n");
    console.log(usage());
    process.exitCode = 1;
    return;
  }

  const dateDefaults = getDateDefaults();
  const start = args.start ?? dateDefaults.start;
  const end = args.end ?? dateDefaults.end;

  try {
    const client = new IntervalsClient();
    const activities = await client.listActivities({
      athleteId: args.athleteId,
      oldest: start,
      newest: end,
      limit: args.limit,
    });

    if (args.json) {
      console.log(JSON.stringify(activities, null, 2));
      return;
    }

    if (!activities.length) {
      console.log("No activities found for that date range.");
      return;
    }

    console.log(
      `Found ${activities.length} activit${
        activities.length === 1 ? "y" : "ies"
      }`,
    );
    console.log("");

    const rows = activities.map((activity) => ({
      Date: formatValue(activity.start_date_local ?? activity.start_date),
      Name: formatValue(activity.name),
      Type: formatValue(activity.activity_type ?? activity.type),
      DistanceKm: formatNumber(activity.distance, (value) =>
        (value / 1000).toFixed(1),
      ),
      MovingTime: formatDuration(activity.moving_time),
      Id: formatValue(activity.id),
    }));

    renderTable(rows);
  } catch (error) {
    console.error(
      `Failed to list activities: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exitCode = 1;
    throw error;
  }
};

const formatDuration = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined) return "";
  const hours = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${minutes}:${secs}`;
};

const renderTable = (rows: Record<string, string>[]) => {
  const headers = Object.keys(rows[0]);
  const widths = headers.map((header) =>
    Math.max(
      header.length,
      ...rows.map((row) => (row[header]?.length ?? 0)),
    ),
  );

  const divider = widths.map((w) => "-".repeat(w + 2)).join("+");

  const formatRow = (row: Record<string, string>) =>
    headers
      .map((header, index) => {
        const value = row[header] ?? "";
        return ` ${value.padEnd(widths[index])} `;
      })
      .join("|");

  console.log(divider);
  console.log(
    headers
      .map((header, index) => ` ${header.padEnd(widths[index])} `)
      .join("|"),
  );
  console.log(divider);
  rows.forEach((row) => console.log(formatRow(row)));
  console.log(divider);
};

const getDateDefaults = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  const toIsoDate = (date: Date) => date.toISOString().split("T")[0]!;

  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
  };
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const formatNumber = (
  value: number | null | undefined,
  formatter: (val: number) => string,
) => {
  if (value === null || value === undefined) return "";
  return formatter(value);
};

main();
