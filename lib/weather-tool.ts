import { tool } from "@openai/agents";
import { z } from "zod";

const WEATHER_BASE_URL = "https://api.open-meteo.com/v1/forecast";
const MAX_HOURLY_HORIZON = 72;
const DEFAULT_HOURLY_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation_probability",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "cloud_cover",
  "visibility",
  "relative_humidity_2m",
  "dew_point_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
];
const DEFAULT_DAILY_FIELDS = [
  "sunrise",
  "sunset",
  "uv_index_max",
  "uv_index_clear_sky_max",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
];
const DEFAULT_CURRENT_FIELDS = ["temperature_2m", "relative_humidity_2m", "wind_speed_10m"];

type OpenMeteoResponse = {
  latitude: number;
  longitude: number;
  timezone: string;
  timezone_abbreviation?: string;
  elevation?: number;
  generationtime_ms?: number;
  hourly?: Record<string, any>;
  hourly_units?: Record<string, string>;
  daily?: Record<string, any>;
  daily_units?: Record<string, string>;
  current?: Record<string, any>;
  current_units?: Record<string, string>;
};

const buildForecastUrl = ({
  latitude,
  longitude,
  timeZone,
}: {
  latitude: number;
  longitude: number;
  timeZone: string;
}) => {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(5),
    longitude: longitude.toFixed(5),
    hourly: DEFAULT_HOURLY_FIELDS.join(","),
    daily: DEFAULT_DAILY_FIELDS.join(","),
    current: DEFAULT_CURRENT_FIELDS.join(","),
    timezone: timeZone,
    forecast_days: "3",
  });

  return `${WEATHER_BASE_URL}?${params.toString()}`;
};

const pickHourlyEntries = (response: OpenMeteoResponse, hoursAhead: number) => {
  const hourly = response.hourly ?? {};
  const timeValues: string[] = Array.isArray(hourly.time) ? hourly.time : [];
  const limit = Math.min(timeValues.length, hoursAhead);
  const result: any[] = [];
  for (let i = 0; i < limit; i += 1) {
    result.push({
      time: timeValues[i],
      temperature: hourly.temperature_2m?.[i] ?? null,
      apparent_temperature: hourly.apparent_temperature?.[i] ?? null,
      precipitation_probability: hourly.precipitation_probability?.[i] ?? null,
      precipitation: hourly.precipitation?.[i] ?? null,
      rain: hourly.rain?.[i] ?? null,
      showers: hourly.showers?.[i] ?? null,
      snowfall: hourly.snowfall?.[i] ?? null,
      cloud_cover: hourly.cloud_cover?.[i] ?? null,
      visibility: hourly.visibility?.[i] ?? null,
      relative_humidity: hourly.relative_humidity_2m?.[i] ?? null,
      dew_point: hourly.dew_point_2m?.[i] ?? null,
      wind_speed: hourly.wind_speed_10m?.[i] ?? null,
      wind_direction: hourly.wind_direction_10m?.[i] ?? null,
      wind_gusts: hourly.wind_gusts_10m?.[i] ?? null,
    });
  }
  return result;
};

const mapDailyEntries = (response: OpenMeteoResponse) => {
  const daily = response.daily ?? {};
  const timeValues: string[] = Array.isArray(daily.time) ? daily.time : [];
  return timeValues.map((time, idx) => ({
    date: time,
    sunrise: daily.sunrise?.[idx] ?? null,
    sunset: daily.sunset?.[idx] ?? null,
    uv_index_max: daily.uv_index_max?.[idx] ?? null,
    uv_index_clear_sky_max: daily.uv_index_clear_sky_max?.[idx] ?? null,
    precipitation_probability_max: daily.precipitation_probability_max?.[idx] ?? null,
    wind_speed_max: daily.wind_speed_10m_max?.[idx] ?? null,
    wind_gusts_max: daily.wind_gusts_10m_max?.[idx] ?? null,
  }));
};

export const getLocalWeatherForecastTool = tool({
  name: "get_local_weather_forecast",
  description:
    "Fetches the next few hours of local weather plus upcoming daily conditions using Open-Meteo. Use this before recommending outdoor workouts so you can account for temperature swings, wind, rain, daylight, or UV exposure.",
  parameters: z.object({
    latitude: z
      .number()
      .describe("Latitude in decimal degrees (positive north, negative south)."),
    longitude: z
      .number()
      .describe("Longitude in decimal degrees (positive east, negative west)."),
    hoursAhead: z
      .number()
      .int()
      .min(1)
      .max(MAX_HOURLY_HORIZON)
      .describe("How many upcoming hourly entries to return (1-72)."),
    timeZone: z
      .string()
      .describe(
        "IANA timezone identifier for aligning sunrise/sunset (use an empty string to auto-detect).",
      ),
  }),
  execute: async ({ latitude, longitude, hoursAhead, timeZone }) => {
    const resolvedTimeZone = timeZone.trim() || "auto";
    const cappedHours = Math.min(Math.max(hoursAhead, 1), MAX_HOURLY_HORIZON);
    const response = await fetch(
      buildForecastUrl({ latitude, longitude, timeZone: resolvedTimeZone }),
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Open-Meteo request failed (${response.status} ${response.statusText}): ${text}`,
      );
    }

    const raw = (await response.json()) as OpenMeteoResponse;
    return {
      location: {
        latitude: raw.latitude,
        longitude: raw.longitude,
        timezone: raw.timezone,
        timezone_abbreviation: raw.timezone_abbreviation ?? null,
        elevation_m: raw.elevation ?? null,
      },
      current: raw.current ?? null,
      current_units: raw.current_units ?? null,
      hourly_units: raw.hourly_units ?? null,
      hourly: pickHourlyEntries(raw, cappedHours),
      daily_units: raw.daily_units ?? null,
      daily: mapDailyEntries(raw),
      generated_ms: raw.generationtime_ms ?? null,
    };
  },
});
