# Dolor

Dolor means pain in Spanish — and as the joke goes, pain is just bread in French.

Dolor is a Fitness AI agent that just works. It integrates with Intervals.ICU to help you plan, analyze, and optimize your workouts with minimal effort. Simple, smart, and consistent — Dolor handles the training pain so you can enjoy the gain.

## Session athlete ID storage

Agents can remember the athlete's Intervals.icu ID per chat session via the `session_set_athlete_id` / `session_get_athlete_id` tools. Always call `get_session_id` first to fetch the current session identifier.

```ts
const { sessionId } = await get_session_id({});

await session_set_athlete_id({ sessionId, athleteId: "123abc" });

const { athleteId } = await session_get_athlete_id({ sessionId });

// get_session_id response shape
// { sessionId: "..." }
```

## Tooling guidelines

- Tools cannot declare optional/nullable parameters. Use discriminated unions or separate required fields so the schema communicates exactly what the agent must send.
