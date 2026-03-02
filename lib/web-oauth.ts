import { Redis } from "@upstash/redis";
import {
  createWebSession,
  getCookieName,
  upsertUserFromIntervals,
  type WebUser,
} from "./web-data-store";

const INTERVALS_AUTHORIZE_URL = "https://intervals.icu/oauth/authorize";
const INTERVALS_TOKEN_URL = "https://intervals.icu/api/oauth/token";
const INTERVALS_SCOPES = "ACTIVITY:READ,WELLNESS:READ,CALENDAR:READ";
const WEB_OAUTH_STATE_PREFIX = "intervals:web-oauth-state:";
const WEB_OAUTH_STATE_TTL_SECONDS = 5 * 60;

type WebOAuthState = {
  nonce: string;
  createdAt: string;
};

const getEnv = (key: string) => {
  if (typeof process === "undefined") return undefined;
  return process.env[key];
};

const hasRedisEnv = () =>
  !!(getEnv("KV_REST_API_URL") || getEnv("KV_URL") || getEnv("REDIS_URL")) &&
  !!(getEnv("KV_REST_API_TOKEN") || getEnv("KV_REST_API_READ_ONLY_TOKEN"));

const memoryState = new Map<string, WebOAuthState>();
const redis = hasRedisEnv() ? Redis.fromEnv() : null;

const nowIso = () => new Date().toISOString();
const randomId = () => crypto.randomUUID().replace(/-/g, "");

const normalizeBaseUrl = (value?: string | null) => {
  if (!value) return null;
  return value.replace(/\/+$/, "");
};

const html = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head><body><main style="max-width:560px;margin:5rem auto;padding:1rem;font-family:ui-sans-serif,system-ui"><h1>${title}</h1>${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

const setCookie = (name: string, value: string, maxAgeSeconds: number) =>
  `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}; Secure`;

const createState = async () => {
  const nonce = randomId();
  const state = randomId();
  const payload: WebOAuthState = { nonce, createdAt: nowIso() };
  if (redis) {
    await redis.set(`${WEB_OAUTH_STATE_PREFIX}${state}`, payload, {
      ex: WEB_OAUTH_STATE_TTL_SECONDS,
    });
  } else {
    memoryState.set(state, payload);
  }
  return state;
};

const consumeState = async (state: string | null): Promise<WebOAuthState | null> => {
  if (!state) return null;
  if (redis) {
    const key = `${WEB_OAUTH_STATE_PREFIX}${state}`;
    const value = await redis.get<WebOAuthState>(key);
    if (!value) return null;
    await redis.del(key);
    return value;
  }
  const value = memoryState.get(state) ?? null;
  memoryState.delete(state);
  return value;
};

const exchangeCode = async (code: string) => {
  const clientId = getEnv("INTERVALS_CLIENT_ID");
  const clientSecret = getEnv("INTERVALS_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Missing INTERVALS_CLIENT_ID or INTERVALS_CLIENT_SECRET");
  }

  const response = await fetch(INTERVALS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });
  const raw = await response.text();
  let payload: any = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse Intervals OAuth token response");
  }
  if (!response.ok || !payload) {
    throw new Error(`Intervals OAuth token exchange failed (${response.status}): ${raw}`);
  }
  return payload;
};

const extractIdentity = (payload: any) => {
  const accessToken =
    typeof payload?.access_token === "string" && payload.access_token.trim()
      ? payload.access_token.trim()
      : null;
  const athleteId =
    payload?.athlete?.id !== undefined && payload?.athlete?.id !== null
      ? String(payload.athlete.id)
      : null;
  if (!accessToken || !athleteId) {
    throw new Error("Intervals OAuth payload missing access token or athlete id");
  }
  return {
    athleteId,
    athleteName: typeof payload?.athlete?.name === "string" ? payload.athlete.name : null,
    accessToken,
    scope: typeof payload?.scope === "string" ? payload.scope : "",
    tokenType: typeof payload?.token_type === "string" ? payload.token_type : "Bearer",
    updatedAt: nowIso(),
  };
};

export const handleWebLoginRequest = async (_request: Request) => {
  const baseUrl = normalizeBaseUrl(getEnv("PUBLIC_BASE_URL"));
  const clientId = getEnv("INTERVALS_CLIENT_ID");
  if (!baseUrl || !clientId) {
    return html(
      "Dolor - Missing configuration",
      "<p>Set PUBLIC_BASE_URL and INTERVALS_CLIENT_ID before using web sign in.</p>",
      500,
    );
  }

  const state = await createState();
  const authorize = new URL(INTERVALS_AUTHORIZE_URL);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", `${baseUrl}/auth/web/callback`);
  authorize.searchParams.set("scope", INTERVALS_SCOPES);
  authorize.searchParams.set("state", state);
  return Response.redirect(authorize.toString(), 302);
};

const redirectToApp = (baseUrl: string) => Response.redirect(baseUrl, 302);

export const handleWebCallbackRequest = async (request: Request) => {
  const baseUrl = normalizeBaseUrl(getEnv("PUBLIC_BASE_URL"));
  if (!baseUrl) {
    return html("Dolor - Missing configuration", "<p>Set PUBLIC_BASE_URL.</p>", 500);
  }

  const url = new URL(request.url);
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  const state = await consumeState(stateParam);
  if (!state) {
    return html(
      "Dolor - Link expired",
      "<p>That login link has expired. Please try signing in again.</p>",
      400,
    );
  }
  if (errorParam) {
    return html(
      "Dolor - Sign in canceled",
      "<p>No changes were made. Return to Dolor and try again.</p>",
      400,
    );
  }
  if (!code) {
    return html(
      "Dolor - Missing authorization code",
      "<p>Intervals did not return an authorization code. Please retry sign in.</p>",
      400,
    );
  }

  let user: WebUser;
  try {
    const payload = await exchangeCode(code);
    user = await upsertUserFromIntervals(extractIdentity(payload));
  } catch (error) {
    console.error("Web OAuth callback failed", error);
    return html("Dolor - Sign in failed", "<p>Could not complete sign in.</p>", 502);
  }

  const session = await createWebSession(user.id);
  const response = redirectToApp(baseUrl);
  response.headers.set("Set-Cookie", setCookie(getCookieName(), session.id, 30 * 24 * 60 * 60));
  return response;
};
