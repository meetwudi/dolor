import { z } from "zod";
import { getSessionContext } from "./session-context";
import { sessionExtraStore } from "./session-extra-store";

const SubTypeEnum = z.enum(["NONE", "COMMUTE", "WARMUP", "COOLDOWN", "RACE"]);
const GapModelEnum = z.enum(["NONE", "STRAVA_RUN"]);
const TizOrderEnum = z.enum([
  "POWER_HR_PACE",
  "POWER_PACE_HR",
  "HR_POWER_PACE",
  "HR_PACE_POWER",
  "PACE_POWER_HR",
  "PACE_HR_POWER",
]);
const AchievementTypeEnum = z.enum([
  "BEST_POWER",
  "FTP_UP",
  "LTHR_UP",
  "BEST_PACE",
]);
const SourceEnum = z.enum([
  "STRAVA",
  "UPLOAD",
  "MANUAL",
  "GARMIN_CONNECT",
  "OAUTH_CLIENT",
  "DROPBOX",
  "POLAR",
  "SUUNTO",
  "COROS",
  "WAHOO",
  "ZWIFT",
  "ZEPP",
  "CONCEPT2",
]);
const HrLoadTypeEnum = z.enum(["AVG_HR", "HR_ZONES", "HRSS"]);
const PaceLoadTypeEnum = z.enum(["SWIM", "RUN"]);
const SportTypeEnum = z.enum([
  "Ride",
  "Run",
  "Swim",
  "WeightTraining",
  "Hike",
  "Walk",
  "AlpineSki",
  "BackcountrySki",
  "Badminton",
  "Canoeing",
  "Crossfit",
  "EBikeRide",
  "EMountainBikeRide",
  "Elliptical",
  "Golf",
  "GravelRide",
  "TrackRide",
  "Handcycle",
  "HighIntensityIntervalTraining",
  "Hockey",
  "IceSkate",
  "InlineSkate",
  "Kayaking",
  "Kitesurf",
  "MountainBikeRide",
  "NordicSki",
  "OpenWaterSwim",
  "Padel",
  "Pilates",
  "Pickleball",
  "Racquetball",
  "Rugby",
  "RockClimbing",
  "RollerSki",
  "Rowing",
  "Sail",
  "Skateboard",
  "Snowboard",
  "Snowshoe",
  "Soccer",
  "Squash",
  "StairStepper",
  "StandUpPaddling",
  "Surfing",
  "TableTennis",
  "Tennis",
  "TrailRun",
  "Transition",
  "Velomobile",
  "VirtualRide",
  "VirtualRow",
  "VirtualRun",
  "VirtualSki",
  "WaterSport",
  "Wheelchair",
  "Windsurf",
  "Workout",
  "Yoga",
  "Other",
]);
const MenstrualPhaseEnum = z.enum([
  "PERIOD",
  "FOLLICULAR",
  "OVULATING",
  "LUTEAL",
  "NONE",
]);
const EventCategoryEnum = z.enum([
  "WORKOUT",
  "RACE_A",
  "RACE_B",
  "RACE_C",
  "NOTE",
  "PLAN",
  "HOLIDAY",
  "SICK",
  "INJURED",
  "SET_EFTP",
  "FITNESS_DAYS",
  "SEASON_START",
  "TARGET",
  "SET_FITNESS",
]);
const EventTargetEnum = z.enum(["AUTO", "POWER", "HR", "PACE"]);
const EventSubTypeEnum = z.enum(["NONE", "COMMUTE", "WARMUP", "COOLDOWN", "RACE"]);

const GearSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullish(),
    name: z.string().nullish(),
    distance: z.number().nullish(),
    primary: z.boolean().nullish(),
  })
  .nullish();

const SkylineBytesSchema = z.union([
  z.array(z.number()),
  z.string(),
]);

const EventAttachmentSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullish(),
    filename: z.string().nullish(),
    mimetype: z.string().nullish(),
    url: z.string().nullish(),
  })
  .passthrough()
  .nullish();

const EventPushErrorSchema = z
  .object({
    service: z.string().nullish(),
    message: z.string().nullish(),
    date: z.string().nullish(),
  })
  .passthrough()
  .nullish();

const EventWorkoutSchema = z
  .object({
    athlete_id: z.string().nullish(),
    id: z.union([z.number(), z.string()]).nullish(),
    name: z.string().nullish(),
    description: z.string().nullish(),
    type: z.string().nullish(),
    indoor: z.boolean().nullish(),
    moving_time: z.number().nullish(),
    joules: z.number().nullish(),
    joules_above_ftp: z.number().nullish(),
    updated: z.string().nullish(),
    target: EventTargetEnum.nullish(),
    targetS: z.array(EventTargetEnum).nullish(),
    carbs_per_hour: z.number().nullish(),
    tags: z.array(z.string()).nullish(),
    workout_doc: z.record(z.unknown()).nullish(),
    time: z.string().nullish(),
    sub_type: EventSubTypeEnum.nullish(),
    distance: z.number().nullish(),
    icu_intensity: z.number().nullish(),
  })
  .loose()
  .nullish();

const EventSchema = z
  .object({
    id: z.union([z.number(), z.string()]).nullish(),
    start_date_local: z.string().nullish(),
    end_date_local: z.string().nullish(),
    name: z.string().nullish(),
    description: z.string().nullish(),
    icu_training_load: z.number().nullish(),
    icu_atl: z.number().nullish(),
    icu_ctl: z.number().nullish(),
    type: z.string().nullish(),
    carbs_used: z.number().nullish(),
    ss_p_max: z.number().nullish(),
    ss_w_prime: z.number().nullish(),
    ss_cp: z.number().nullish(),
    calendar_id: z.number().int().nullish(),
    uid: z.string().nullish(),
    athlete_id: z.string().nullish(),
    category: EventCategoryEnum.nullish(),
    indoor: z.boolean().nullish(),
    color: z.string().nullish(),
    moving_time: z.number().nullish(),
    icu_ftp: z.number().nullish(),
    w_prime: z.number().nullish(),
    p_max: z.number().nullish(),
    atl_days: z.number().nullish(),
    ctl_days: z.number().nullish(),
    updated: z.string().nullish(),
    not_on_fitness_chart: z.boolean().nullish(),
    show_as_note: z.boolean().nullish(),
    show_on_ctl_line: z.boolean().nullish(),
    for_week: z.boolean().nullish(),
    target: EventTargetEnum.nullish(),
    joules: z.number().nullish(),
    joules_above_ftp: z.number().nullish(),
    workout_doc: z.unknown().nullish(),
    push_errors: z.array(EventPushErrorSchema).nullish(),
    athlete_cannot_edit: z.boolean().nullish(),
    hide_from_athlete: z.boolean().nullish(),
    structure_read_only: z.boolean().nullish(),
    created_by_id: z.string().nullish(),
    shared_event_id: z.number().nullish(),
    entered: z.boolean().nullish(),
    carbs_per_hour: z.number().nullish(),
    sub_type: EventSubTypeEnum.nullish(),
    distance: z.number().nullish(),
    tags: z.array(z.string()).nullish(),
    attachments: z.array(EventAttachmentSchema).nullish(),
    oauth_client_id: z.number().nullish(),
    external_id: z.string().nullish(),
    load_target: z.number().nullish(),
    time_target: z.number().nullish(),
    distance_target: z.number().nullish(),
    plan_athlete_id: z.string().nullish(),
    plan_folder_id: z.number().nullish(),
    plan_workout_id: z.number().nullish(),
    plan_applied: z.string().nullish(),
    icu_intensity: z.number().nullish(),
    strain_score: z.number().nullish(),
    workout: EventWorkoutSchema,
    targetS: z.array(EventTargetEnum).nullish(),
    locale: z.string().nullish(),
  })
  .loose();

const EventListSchema = z.array(EventSchema);

const parseOrThrow = <T>(
  schema: z.ZodType<T>,
  raw: unknown,
  label: string,
): T => {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      `[Intervals.icu] Failed to parse ${label}:`,
      parsed.error.flatten(),
      raw,
    );
    throw new Error(`Failed to parse ${label} from Intervals.icu`);
  }
  return parsed.data;
};

const HrrSchema = z
  .object({
    start_index: z.number().nullish(),
    end_index: z.number().nullish(),
    start_time: z.number().nullish(),
    end_time: z.number().nullish(),
    start_bpm: z.number().nullish(),
    end_bpm: z.number().nullish(),
    average_watts: z.number().nullish(),
    hrr: z.number().nullish(),
  })
  .nullish();

const ActivityIntervalSchema = z
  .object({
    start_index: z.number().nullish(),
    distance: z.number().nullish(),
    moving_time: z.number().nullish(),
    elapsed_time: z.number().nullish(),
    average_watts: z.number().nullish(),
    average_watts_alt: z.number().nullish(),
    average_watts_alt_acc: z.number().nullish(),
    min_watts: z.number().nullish(),
    max_watts: z.number().nullish(),
    average_watts_kg: z.number().nullish(),
    max_watts_kg: z.number().nullish(),
    intensity: z.number().nullish(),
    w5s_variability: z.number().nullish(),
    weighted_average_watts: z.number().nullish(),
    training_load: z.number().nullish(),
    joules: z.number().nullish(),
    joules_above_ftp: z.number().nullish(),
    decoupling: z.union([z.number(), z.string()]).nullish(),
    avg_lr_balance: z.number().nullish(),
    average_dfa_a1: z.number().nullish(),
    average_epoc: z.number().nullish(),
    wbal_start: z.number().nullish(),
    wbal_end: z.number().nullish(),
    average_respiration: z.number().nullish(),
    average_tidal_volume: z.number().nullish(),
    average_tidal_volume_min: z.number().nullish(),
    zone: z.number().nullish(),
    zone_min_watts: z.number().nullish(),
    zone_max_watts: z.number().nullish(),
    average_speed: z.number().nullish(),
    min_speed: z.number().nullish(),
    max_speed: z.number().nullish(),
    gap: z.number().nullish(),
    average_heartrate: z.number().nullish(),
    min_heartrate: z.number().nullish(),
    max_heartrate: z.number().nullish(),
    average_cadence: z.number().nullish(),
    min_cadence: z.number().nullish(),
    max_cadence: z.number().nullish(),
    average_torque: z.number().nullish(),
    min_torque: z.number().nullish(),
    max_torque: z.number().nullish(),
    total_elevation_gain: z.number().nullish(),
    min_altitude: z.number().nullish(),
    max_altitude: z.number().nullish(),
    average_gradient: z.number().nullish(),
    average_smo2: z.number().nullish(),
    average_thb: z.number().nullish(),
    average_smo2_2: z.number().nullish(),
    average_thb_2: z.number().nullish(),
    average_temp: z.number().nullish(),
    average_weather_temp: z.number().nullish(),
    average_feels_like: z.number().nullish(),
    average_wind_speed: z.number().nullish(),
    average_wind_gust: z.number().nullish(),
    prevailing_wind_deg: z.number().nullish(),
    average_yaw: z.number().nullish(),
    headwind_percent: z.number().nullish(),
    tailwind_percent: z.number().nullish(),
    strain_score: z.number().nullish(),
    ss_p_max: z.number().nullish(),
    ss_w_prime: z.number().nullish(),
    ss_cp: z.number().nullish(),
    id: z.union([z.string(), z.number()]).nullish(),
    type: z.enum(["RECOVERY", "WORK"]).nullish(),
    end_index: z.number().nullish(),
    group_id: z.string().nullish(),
    segment_effort_ids: z.array(z.number()).nullish(),
    start_time: z.number().nullish(),
    end_time: z.number().nullish(),
    label: z.string().nullish(),
    average_stride: z.number().nullish(),
  })
  .loose();

const ActivityIntervalGroupSchema = ActivityIntervalSchema.extend({
  count: z.number().nullish(),
}).loose();

const ActivityIntervalsSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullish(),
    analyzed: z.string().nullish(),
    icu_intervals: z.array(ActivityIntervalSchema).nullish(),
    icu_groups: z.array(ActivityIntervalGroupSchema).nullish(),
  })
  .loose();

export type ActivityIntervals = z.infer<typeof ActivityIntervalsSchema>;

const ActivitySchema = z.object({
  id: z.union([z.number(), z.string()]),
  start_date_local: z.string().nullish(),
  type: z.string().nullish(),
  icu_ignore_time: z.boolean().nullish(),
  icu_pm_cp: z.number().nullish(),
  icu_pm_w_prime: z.number().nullish(),
  icu_pm_p_max: z.number().nullish(),
  icu_pm_ftp: z.number().nullish(),
  icu_pm_ftp_secs: z.number().nullish(),
  icu_pm_ftp_watts: z.number().nullish(),
  icu_ignore_power: z.boolean().nullish(),
  icu_rolling_cp: z.number().nullish(),
  icu_rolling_w_prime: z.number().nullish(),
  icu_rolling_p_max: z.number().nullish(),
  icu_rolling_ftp: z.number().nullish(),
  icu_rolling_ftp_delta: z.number().nullish(),
  icu_training_load: z.number().nullish(),
  icu_atl: z.number().nullish(),
  icu_ctl: z.number().nullish(),
  ss_p_max: z.number().nullish(),
  ss_w_prime: z.number().nullish(),
  ss_cp: z.number().nullish(),
  paired_event_id: z.number().nullish(),
  icu_ftp: z.number().nullish(),
  icu_joules: z.number().nullish(),
  icu_recording_time: z.number().nullish(),
  elapsed_time: z.number().nullish(),
  icu_weighted_avg_watts: z.number().nullish(),
  carbs_used: z.number().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  start_date: z.string().nullish(),
  distance: z.number().nullish(),
  icu_distance: z.number().nullish(),
  moving_time: z.number().nullish(),
  coasting_time: z.number().nullish(),
  total_elevation_gain: z.number().nullish(),
  total_elevation_loss: z.number().nullish(),
  timezone: z.string().nullish(),
  trainer: z.boolean().nullish(),
  sub_type: SubTypeEnum.nullish(),
  commute: z.boolean().nullish(),
  race: z.boolean().nullish(),
  max_speed: z.number().nullish(),
  average_speed: z.number().nullish(),
  device_watts: z.boolean().nullish(),
  has_heartrate: z.boolean().nullish(),
  max_heartrate: z.number().nullish(),
  average_heartrate: z.number().nullish(),
  average_cadence: z.number().nullish(),
  calories: z.number().nullish(),
  average_temp: z.number().nullish(),
  min_temp: z.number().nullish(),
  max_temp: z.number().nullish(),
  avg_lr_balance: z.number().nullish(),
  gap: z.number().nullish(),
  gap_model: GapModelEnum.nullish(),
  use_elevation_correction: z.boolean().nullish(),
  gear: GearSchema,
  perceived_exertion: z.number().nullish(),
  device_name: z.string().nullish(),
  power_meter: z.string().nullish(),
  power_meter_serial: z.string().nullish(),
  power_meter_battery: z.string().nullish(),
  crank_length: z.number().nullish(),
  external_id: z.string().nullish(),
  file_sport_index: z.number().nullish(),
  file_type: z.string().nullish(),
  icu_athlete_id: z.string().nullish(),
  created: z.string().nullish(),
  icu_sync_date: z.string().nullish(),
  analyzed: z.string().nullish(),
  icu_w_prime: z.number().nullish(),
  p_max: z.number().nullish(),
  threshold_pace: z.number().nullish(),
  icu_hr_zones: z.array(z.number()).nullish(),
  pace_zones: z.array(z.number()).nullish(),
  lthr: z.number().nullish(),
  icu_resting_hr: z.number().nullish(),
  icu_weight: z.number().nullish(),
  icu_power_zones: z.array(z.number()).nullish(),
  icu_sweet_spot_min: z.number().nullish(),
  icu_sweet_spot_max: z.number().nullish(),
  icu_power_spike_threshold: z.number().nullish(),
  trimp: z.number().nullish(),
  icu_warmup_time: z.number().nullish(),
  icu_cooldown_time: z.number().nullish(),
  icu_chat_id: z.number().nullish(),
  icu_ignore_hr: z.boolean().nullish(),
  ignore_velocity: z.boolean().nullish(),
  ignore_pace: z.boolean().nullish(),
  ignore_parts: z
    .array(
      z.object({
        start_index: z.number(),
        end_index: z.number(),
        power: z.boolean(),
        pace: z.boolean(),
        hr: z.boolean(),
      }),
    )
    .nullish(),
  icu_training_load_data: z.number().nullish(),
  interval_summary: z.array(z.string()).nullish(),
  skyline_chart_bytes: SkylineBytesSchema.nullish(),
  stream_types: z.array(z.string()).nullish(),
  has_weather: z.boolean().nullish(),
  has_segments: z.boolean().nullish(),
  power_field_names: z.array(z.string()).nullish(),
  power_field: z.string().nullish(),
  icu_zone_times: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).nullish(),
        secs: z.number().nullish(),
      }),
    )
    .nullish(),
  icu_hr_zone_times: z.array(z.number()).nullish(),
  pace_zone_times: z.array(z.number()).nullish(),
  gap_zone_times: z.array(z.number()).nullish(),
  use_gap_zone_times: z.boolean().nullish(),
  custom_zones: z
    .array(
      z.object({
        code: z.string().nullish(),
        zones: z.array(
          z.object({
            id: z.union([z.string(), z.number()]).nullish(),
            start: z.number(),
            end: z.number(),
            start_value: z.number(),
            end_value: z.number(),
            secs: z.number(),
          }),
        ),
      }),
    )
    .nullish(),
  tiz_order: TizOrderEnum.nullish(),
  polarization_index: z.number().nullish(),
  icu_achievements: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).nullish(),
        type: AchievementTypeEnum,
        message: z.string().nullish(),
        watts: z.number().nullish(),
        secs: z.number().nullish(),
        value: z.number().nullish(),
        distance: z.number().nullish(),
        pace: z.number().nullish(),
        point: z
          .object({
            start_index: z.number(),
            end_index: z.number(),
            secs: z.number(),
            value: z.number(),
          })
          .nullish(),
      }),
    )
    .nullish(),
  icu_intervals_edited: z.boolean().nullish(),
  lock_intervals: z.boolean().nullish(),
  icu_lap_count: z.number().nullish(),
  icu_joules_above_ftp: z.number().nullish(),
  icu_max_wbal_depletion: z.number().nullish(),
  icu_hrr: HrrSchema,
  icu_sync_error: z.string().nullish(),
  icu_color: z.string().nullish(),
  icu_power_hr_z2: z.number().nullish(),
  icu_power_hr_z2_mins: z.number().nullish(),
  icu_cadence_z2: z.number().nullish(),
  icu_rpe: z.number().nullish(),
  feel: z.number().nullish(),
  kg_lifted: z.number().nullish(),
  decoupling: z.number().nullish(),
  icu_median_time_delta: z.number().nullish(),
  p30s_exponent: z.number().nullish(),
  workout_shift_secs: z.number().nullish(),
  strava_id: z.string().nullish(),
  lengths: z.number().nullish(),
  pool_length: z.number().nullish(),
  compliance: z.number().nullish(),
  coach_tick: z.number().nullish(),
  source: SourceEnum.nullish(),
  oauth_client_id: z.number().nullish(),
  oauth_client_name: z.string().nullish(),
  average_altitude: z.number().nullish(),
  min_altitude: z.number().nullish(),
  max_altitude: z.number().nullish(),
  power_load: z.number().nullish(),
  hr_load: z.number().nullish(),
  pace_load: z.number().nullish(),
  hr_load_type: HrLoadTypeEnum.nullish(),
  pace_load_type: PaceLoadTypeEnum.nullish(),
  tags: z.array(z.string()).nullish(),
  attachments: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).nullish(),
        filename: z.string().nullish(),
        mimetype: z.string().nullish(),
        url: z.string().nullish(),
      }),
    )
    .nullish(),
  recording_stops: z.array(z.number()).nullish(),
  average_weather_temp: z.number().nullish(),
  min_weather_temp: z.number().nullish(),
  max_weather_temp: z.number().nullish(),
  average_feels_like: z.number().nullish(),
  min_feels_like: z.number().nullish(),
  max_feels_like: z.number().nullish(),
  average_wind_speed: z.number().nullish(),
  average_wind_gust: z.number().nullish(),
  prevailing_wind_deg: z.number().nullish(),
  headwind_percent: z.number().nullish(),
  tailwind_percent: z.number().nullish(),
  average_clouds: z.number().nullish(),
  max_rain: z.number().nullish(),
  max_snow: z.number().nullish(),
  carbs_ingested: z.number().nullish(),
  route_id: z.number().nullish(),
  pace: z.number().nullish(),
  athlete_max_hr: z.number().nullish(),
  group: z.string().nullish(),
  icu_intensity: z.number().nullish(),
  icu_efficiency_factor: z.number().nullish(),
  icu_power_hr: z.number().nullish(),
  session_rpe: z.number().nullish(),
  average_stride: z.number().nullish(),
  icu_average_watts: z.number().nullish(),
  icu_variability_index: z.number().nullish(),
  strain_score: z.number().nullish(),
}).loose();

const ActivityListSchema = z.array(ActivitySchema);

export type Activity = z.infer<typeof ActivitySchema>;

const ActivityMessageSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    athlete_id: z.union([z.string(), z.number()]).nullish(),
    name: z.string().nullish(),
    created: z.string().nullish(),
    type: z.string().nullish(),
    content: z.string().nullish(),
    activity_id: z.union([z.string(), z.number()]).nullish(),
    start_index: z.number().nullish(),
    end_index: z.number().nullish(),
    answer: z.string().nullish(),
    activity: ActivitySchema.nullish(),
    attachment_url: z.string().nullish(),
    attachment_mime_type: z.string().nullish(),
    deleted: z.string().nullish(),
    deleted_by_id: z.union([z.string(), z.number()]).nullish(),
    join_group_id: z.number().nullish(),
    accept_coaching_group_id: z.number().nullish(),
    seen: z.boolean().nullish(),
  })
  .loose();

export type ActivityMessage = z.infer<typeof ActivityMessageSchema>;
const ActivityMessageListSchema = z.array(ActivityMessageSchema);

const CreateActivityMessageResponseSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    new_chat: z
      .object({
        id: z.union([z.string(), z.number()]).nullish(),
        type: z.string().nullish(),
        activity_id: z.union([z.string(), z.number()]).nullish(),
        updated: z.string().nullish(),
        name: z.string().nullish(),
        description: z.string().nullish(),
        url: z.string().nullish(),
        slug: z.string().nullish(),
      })
      .loose()
      .nullish(),
  })
  .loose();

const WellnessSportInfoSchema = z.object({
  type: SportTypeEnum,
  eftp: z.number().nullish(),
  wPrime: z.number().nullish(),
  pMax: z.number().nullish(),
});

const WellnessRecordSchema = z
  .object({
    id: z.string(),
    ctl: z.number().nullish(),
    atl: z.number().nullish(),
    rampRate: z.number().nullish(),
    ctlLoad: z.number().nullish(),
    atlLoad: z.number().nullish(),
    sportInfo: z.array(WellnessSportInfoSchema).nullish(),
    updated: z.string().nullish(),
    weight: z.number().nullish(),
    restingHR: z.number().int().nullish(),
    hrv: z.number().nullish(),
    hrvSDNN: z.number().nullish(),
    menstrualPhase: MenstrualPhaseEnum.nullish(),
    menstrualPhasePredicted: MenstrualPhaseEnum.nullish(),
    kcalConsumed: z.number().int().nullish(),
    sleepSecs: z.number().int().nullish(),
    sleepScore: z.number().nullish(),
    sleepQuality: z.number().int().nullish(),
    avgSleepingHR: z.number().nullish(),
    soreness: z.number().int().nullish(),
    fatigue: z.number().int().nullish(),
    stress: z.number().int().nullish(),
    mood: z.number().int().nullish(),
    motivation: z.number().int().nullish(),
    injury: z.number().int().nullish(),
    spO2: z.number().nullish(),
    systolic: z.number().int().nullish(),
    diastolic: z.number().int().nullish(),
    hydration: z.number().int().nullish(),
    hydrationVolume: z.number().nullish(),
    readiness: z.number().nullish(),
    baevskySI: z.number().nullish(),
    bloodGlucose: z.number().nullish(),
    lactate: z.number().nullish(),
    bodyFat: z.number().nullish(),
    abdomen: z.number().nullish(),
    vo2max: z.number().nullish(),
    comments: z.string().nullish(),
    steps: z.number().int().nullish(),
    respiration: z.number().nullish(),
    locked: z.boolean().nullish(),
    tempWeight: z.boolean().nullish(),
    tempRestingHR: z.boolean().nullish(),
  })
  .loose();

const WellnessRecordListSchema = z.array(WellnessRecordSchema);

export interface ListActivitiesParams {
  athleteId: string;
  oldest: string;
  newest: string;
  limit?: number;
}
export type WellnessRecord = z.infer<typeof WellnessRecordSchema>;
export type WellnessRecordUpdate = Partial<WellnessRecord> & { id?: string };
export type Event = z.infer<typeof EventSchema>;

export interface GetWellnessRecordParams {
  athleteId: string;
  date: string;
}

export interface UpdateWellnessRecordParams {
  athleteId: string;
  date: string;
  data: WellnessRecordUpdate;
}

export interface ListWellnessRecordsParams {
  athleteId: string;
  ext: string;
  oldest: string;
  newest: string;
  cols?: string;
  fields?: string;
}

export interface ListEventsParams {
  athleteId: string;
  oldest: string;
  newest: string;
  categories?: string;
  limit?: number;
  calendarId?: number;
  ext?: string;
  powerRange?: number;
  hrRange?: number;
  paceRange?: number;
  locale?: string;
  resolve?: boolean;
}

export interface UpdateEventParams {
  athleteId: string;
  eventId: string | number;
  data: Record<string, unknown>;
}

export interface CreateEventParams {
  athleteId: string;
  upsertOnUid?: boolean;
  data: Record<string, unknown>;
}

export type ListWellnessRecordsResult =
  | {
      format: "json";
      records: WellnessRecord[];
      oldest: string;
      newest: string;
    }
  | { format: "csv"; csv: string; oldest: string; newest: string };

const DEFAULT_BASE_URL = "https://intervals.icu/api/v1";

export class IntervalsClient {
  readonly accessToken: string;
  readonly baseUrl: string;

  constructor(options: { accessToken: string; baseUrl?: string }) {
    const accessToken = options?.accessToken?.trim();
    if (!accessToken) {
      throw new Error(
        "IntervalsClient requires an OAuth access token (call /connect in Telegram to generate one).",
      );
    }
    this.accessToken = accessToken;
    this.baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  }

  private buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
      ...extra,
    };
  }

  async listActivities(params: ListActivitiesParams): Promise<Activity[]> {
    const { athleteId, oldest, newest, limit } = params;

    if (!athleteId) throw new Error("athleteId is required");
    if (!oldest) throw new Error("oldest date is required");
    if (!newest) throw new Error("newest date is required");

    const qs = new URLSearchParams({ oldest, newest });
    if (typeof limit === "number") {
      qs.set("limit", limit.toString());
    }

    const url = `${this.baseUrl}/athlete/${athleteId}/activities?${qs.toString()}`;
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Intervals.icu request failed (${response.status} ${response.statusText}): ${text}`,
      );
    }

    const raw = await response.json();
    const activities = parseOrThrow(
      ActivityListSchema,
      raw,
      "activities list response",
    );
    return activities.sort((a, b) => {
      const aDate = a.start_date_local ?? a.start_date ?? "";
      const bDate = b.start_date_local ?? b.start_date ?? "";
      return aDate < bDate ? 1 : -1;
    });
  }

  async listEvents(params: ListEventsParams): Promise<Event[]> {
    const {
      athleteId,
      oldest,
      newest,
      categories,
      limit,
      calendarId,
      ext,
      powerRange,
      hrRange,
      paceRange,
      locale,
      resolve,
    } = params;

    if (!athleteId) throw new Error("athleteId is required");
    if (!oldest) throw new Error("oldest date is required");
    if (!newest) throw new Error("newest date is required");

    const qs = new URLSearchParams({ oldest, newest });
    if (categories) qs.set("category", categories);
    if (typeof limit === "number") qs.set("limit", limit.toString());
    if (typeof calendarId === "number") qs.set("calendar_id", calendarId.toString());
    if (ext) qs.set("ext", ext);
    if (typeof powerRange === "number") qs.set("powerRange", powerRange.toString());
    if (typeof hrRange === "number") qs.set("hrRange", hrRange.toString());
    if (typeof paceRange === "number") qs.set("paceRange", paceRange.toString());
    if (locale) qs.set("locale", locale);
    if (typeof resolve === "boolean") qs.set("resolve", resolve ? "true" : "false");

    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const url = `${this.baseUrl}/athlete/${athleteId}/events${suffix}`;
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Intervals.icu request failed (${response.status} ${response.statusText}): ${text}`,
      );
    }

    const raw = await response.json();
    return parseOrThrow(EventListSchema, raw, "events list response");
  }

  async getActivity(params: {
    activityId: string | number;
    includeIntervals: boolean;
  }): Promise<Activity> {
    const { activityId, includeIntervals } = params;

    if (!activityId && activityId !== 0) {
      throw new Error("activityId is required");
    }

    const id = String(activityId);
    const qs = new URLSearchParams({
      intervals: includeIntervals ? "true" : "false",
    });
    const url = `${this.baseUrl}/activity/${id}?${qs.toString()}`;
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Intervals.icu request failed (${response.status} ${response.statusText}): ${text}`,
      );
    }

    const raw = await response.json();
    return parseOrThrow(ActivitySchema, raw, "activity response");
  }

  async updateWellnessRecord(
    params: UpdateWellnessRecordParams,
  ): Promise<WellnessRecord> {
    const { athleteId, date, data } = params;

    if (!athleteId) throw new Error("athleteId is required");
    if (!date) throw new Error("date is required");
    if (!data) throw new Error("data is required");

    const payload = {
      ...data,
      id: data.id ?? athleteId,
    };

    const url = `${this.baseUrl}/athlete/${athleteId}/wellness/${date}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: this.buildHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Intervals.icu request failed (${response.status} ${response.statusText}): ${text}`,
      );
    }

    const raw = await response.json();
    return parseOrThrow(WellnessRecordSchema, raw, "wellness record response");
  }

  async getWellnessRecord(
    params: GetWellnessRecordParams,
  ): Promise<WellnessRecord> {
    const { athleteId, date } = params;

    if (!athleteId) throw new Error("athleteId is required");
    if (!date) throw new Error("date is required");

    const url = `${this.baseUrl}/athlete/${athleteId}/wellness/${date}`;
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Intervals.icu request failed (${response.status} ${response.statusText}): ${text}`,
      );
    }

    const raw = await response.json();
    return parseOrThrow(WellnessRecordSchema, raw, "updated wellness record response");
  }

  async listWellnessRecords(
    params: ListWellnessRecordsParams,
  ): Promise<ListWellnessRecordsResult> {
    const { athleteId, ext, oldest, newest, cols, fields } = params;

    if (!athleteId) throw new Error("athleteId is required");
    if (!oldest) throw new Error("oldest date is required");
    if (!newest) throw new Error("newest date is required");
    if (ext === undefined || ext === null) {
      throw new Error("ext is required (use '' for JSON or '.csv' for CSV)");
    }

    const trimmedExt = ext.trim();
    if (trimmedExt && !trimmedExt.startsWith(".")) {
      throw new Error("ext must be empty or start with '.' (e.g., '.csv')");
    }

    const qs = new URLSearchParams({ oldest, newest });
    if (cols?.trim()) {
      qs.set("cols", cols.trim());
    }
    if (fields?.trim()) {
      qs.set("fields", fields.trim());
    }

    const url = `${this.baseUrl}/athlete/${athleteId}/wellness${trimmedExt}${
      qs.toString() ? `?${qs.toString()}` : ""
    }`;

    const expectCsv = trimmedExt === ".csv";
    const response = await fetch(url, {
      headers: this.buildHeaders({
        Accept: expectCsv ? "text/csv" : "application/json",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Intervals.icu request failed (${response.status} ${response.statusText}): ${text}`,
      );
    }

    if (expectCsv) {
      const csv = await response.text();
      return { format: "csv", csv, oldest, newest };
    }

    const raw = await response.json();
    const records = parseOrThrow(
      WellnessRecordListSchema,
      raw,
      "wellness records response",
    );
    return { format: "json", records, oldest, newest };
  }

  async getActivityIntervals(activityId: string | number): Promise<ActivityIntervals> {
    if (!activityId && activityId !== 0) {
      throw new Error("activityId is required");
    }

    const id = String(activityId);
    const url = `${this.baseUrl}/activity/${id}/intervals`;
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Intervals.icu request failed (${response.status} ${response.statusText}): ${text}`,
      );
    }

    const raw = await response.json();
    const result = ActivityIntervalsSchema.safeParse(raw);

    if (!result.success) {
      console.log("Failed to parse ActivityIntervals:", result.error);
      throw new Error("Failed to parse ActivityIntervals from Intervals.icu");
    }

    return result.data;
  }

  async addActivityMessage(params: {
    activityId: string | number;
    content: string;
  }): Promise<{ id: string; new_chat?: { id?: string | number | null } | null }> {
    const { activityId, content } = params;
    if (!activityId && activityId !== 0) {
      throw new Error("activityId is required");
    }
    if (!content?.trim()) {
      throw new Error("content is required");
    }

    const url = `${this.baseUrl}/activity/${String(activityId)}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Intervals.icu request failed (${response.status} ${response.statusText}): ${text}`,
      );
    }

    const raw = await response.json();
    const parsed = parseOrThrow(
      CreateActivityMessageResponseSchema,
      raw,
      "create activity message response",
    );
    return {
      id: String(parsed.id),
      new_chat: parsed.new_chat ?? undefined,
    };
  }

  async listChatMessages(params: {
    chatId: string | number;
    beforeId?: string | number;
    limit?: number;
  }): Promise<ActivityMessage[]> {
    const { chatId, beforeId, limit } = params;
    if (!chatId && chatId !== 0) {
      throw new Error("chatId is required");
    }

    const qs = new URLSearchParams();
    if (beforeId !== undefined) {
      qs.set("beforeId", String(beforeId));
    }
    if (limit !== undefined) {
      const clamped = Math.max(1, Math.min(limit, 100));
      qs.set("limit", String(clamped));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const url = `${this.baseUrl}/chats/${String(chatId)}/messages${suffix}`;
    const response = await fetch(url, {
      headers: this.buildHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Intervals.icu request failed (${response.status} ${response.statusText}): ${text}`,
      );
    }

    const raw = await response.json();
    return parseOrThrow(
      ActivityMessageListSchema,
      raw,
      "activity messages response",
    );
  }

  async createEvent(params: CreateEventParams): Promise<Event> {
    const { athleteId, data, upsertOnUid } = params;
    if (!athleteId) throw new Error("athleteId is required");
    const qs = new URLSearchParams();
    if (typeof upsertOnUid === "boolean") {
      qs.set("upsertOnUid", upsertOnUid ? "true" : "false");
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const url = `${this.baseUrl}/athlete/${athleteId}/events${suffix}`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Intervals.icu request failed (${response.status} ${response.statusText}): ${text}`,
      );
    }

    const raw = await response.json();
    return parseOrThrow(EventSchema, raw, "create event response");
  }

  async updateEvent(params: UpdateEventParams): Promise<Event> {
    const { athleteId, eventId, data } = params;
    if (!athleteId) throw new Error("athleteId is required");
    if (eventId === undefined || eventId === null) {
      throw new Error("eventId is required");
    }
    const url = `${this.baseUrl}/athlete/${athleteId}/events/${String(eventId)}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: this.buildHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Intervals.icu request failed (${response.status} ${response.statusText}): ${text}`,
      );
    }

    const raw = await response.json();
    return parseOrThrow(EventSchema, raw, "update event response");
  }
}

const pickSessionAccessToken = (data?: Record<string, unknown>) => {
  const raw = data?.intervalsAccessToken;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
};

const pickSessionAthleteId = (data?: Record<string, unknown>) => {
  const raw = data?.athleteId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
};

const pickSessionScope = (data?: Record<string, unknown>) => {
  const raw = data?.intervalsScope;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
};

const pickSessionAthleteName = (data?: Record<string, unknown>) => {
  const raw = data?.intervalsAthleteName;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
};

export type SessionIntervalsCredentials = {
  athleteId: string;
  accessToken: string;
  scope?: string | null;
  athleteName?: string | null;
};

export const getSessionIntervalsCredentials =
  async (): Promise<SessionIntervalsCredentials | null> => {
    const context = getSessionContext();
    if (!context?.sessionId) return null;
    const record = await sessionExtraStore.get(context.sessionId);
    const athleteId = pickSessionAthleteId(record?.data);
    const accessToken = pickSessionAccessToken(record?.data);
    if (!athleteId || !accessToken) return null;
    return {
      athleteId,
      accessToken,
      scope: pickSessionScope(record?.data),
      athleteName: pickSessionAthleteName(record?.data),
    };
  };

const missingCredentialError = () =>
  new Error(
    "This chat isn't connected to Intervals.icu yet. Ask the athlete to run /connect and try again.",
  );

export const requireSessionIntervalsCredentials =
  async (): Promise<SessionIntervalsCredentials> => {
    const creds = await getSessionIntervalsCredentials();
    if (!creds) {
      throw missingCredentialError();
    }
    return creds;
  };

export const createIntervalsClientForSession = async (): Promise<IntervalsClient> => {
  const { accessToken } = await requireSessionIntervalsCredentials();
  return new IntervalsClient({ accessToken });
};

export const requireIntervalsClientWithAthlete = async () => {
  const creds = await requireSessionIntervalsCredentials();
  return {
    client: new IntervalsClient({ accessToken: creds.accessToken }),
    athleteId: creds.athleteId,
    athleteName: creds.athleteName ?? null,
    scope: creds.scope ?? null,
  };
};
