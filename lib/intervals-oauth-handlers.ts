import {
  consumeIntervalsOAuthState,
  consumeTelegramConnectToken,
  createIntervalsOAuthState,
  saveTelegramIntervalsCredential,
} from "./intervals-oauth-store";
import { linkTelegramUserToUser, upsertUserFromIntervals } from "./web-data-store";

const INTERVALS_AUTHORIZE_URL = "https://intervals.icu/oauth/authorize";
const INTERVALS_TOKEN_URL = "https://intervals.icu/api/oauth/token";
const INTERVALS_SCOPES = "ACTIVITY:READ,WELLNESS:READ,CALENDAR:READ";

const getEnv = (key: string) => {
  if (typeof Bun !== "undefined" && Bun.env[key] !== undefined) {
    return Bun.env[key];
  }
  if (typeof process !== "undefined" && process.env[key] !== undefined) {
    return process.env[key];
  }
  return undefined;
};

const normalizeBaseUrl = (value?: string | null) => {
  if (!value) return null;
  return value.replace(/\/+$/, "");
};

const renderHtmlPage = (title: string, body: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0b0f1a;
        color: #f6faff;
        display: flex;
        min-height: 100vh;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 1rem;
      }
      main {
        max-width: 480px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 16px;
        padding: 2rem;
        box-shadow: 0 10px 40px rgba(5, 6, 28, 0.4);
      }
      h1 {
        margin-top: 0;
        font-size: 1.75rem;
      }
      p {
        line-height: 1.5;
      }
      a {
        color: #6ee7b7;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      ${body}
    </main>
  </body>
</html>`;

const htmlResponse = (title: string, body: string, status = 200) =>
  new Response(renderHtmlPage(title, body), {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });

export const handleConnectRequest = async (request: Request) => {
  const baseUrl = normalizeBaseUrl(getEnv("PUBLIC_BASE_URL"));
  const clientId = getEnv("INTERVALS_CLIENT_ID");
  if (!baseUrl || !clientId) {
    return htmlResponse(
      "Dolor — Missing configuration",
      "<p>The server is missing PUBLIC_BASE_URL or INTERVALS_CLIENT_ID. Let the Dolor team know and try again later.</p>",
      500,
    );
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return htmlResponse(
      "Dolor — Invalid link",
      "<p>This link is missing its token. Ask the Telegram bot for a new /connect link.</p>",
      400,
    );
  }

  const pending = await consumeTelegramConnectToken(token);
  if (!pending) {
    return htmlResponse(
      "Dolor — Link expired",
      "<p>That connect link has expired. Head back to Telegram and run /connect again.</p>",
      410,
    );
  }

  const state = await createIntervalsOAuthState(pending);
  const authorize = new URL(INTERVALS_AUTHORIZE_URL);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", `${baseUrl}/auth/intervals/callback`);
  authorize.searchParams.set("scope", INTERVALS_SCOPES);
  authorize.searchParams.set("state", state);

  return Response.redirect(authorize.toString(), 302);
};

export const handleIntervalsCallback = async (request: Request) => {
  const clientId = getEnv("INTERVALS_CLIENT_ID");
  const clientSecret = getEnv("INTERVALS_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return htmlResponse(
      "Dolor — Missing configuration",
      "<p>The server is missing INTERVALS_CLIENT_ID or INTERVALS_CLIENT_SECRET. Let the Dolor team know and try again later.</p>",
      500,
    );
  }

  const url = new URL(request.url);
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = await consumeIntervalsOAuthState(stateParam);

  if (!state) {
    return htmlResponse(
      "Dolor — Link expired",
      "<p>Your authorization link has expired. Head back to Telegram and request a fresh /connect link.</p>",
      400,
    );
  }

  if (errorParam) {
    return htmlResponse(
      "Dolor — Authorization canceled",
      "<p>No changes were made. Head back to Telegram if you want to try again.</p>",
      400,
    );
  }

  if (!code) {
    return htmlResponse(
      "Dolor — Missing authorization code",
      "<p>We didn't receive the authorization code from Intervals.icu. Please try the /connect link again.</p>",
      400,
    );
  }

  const tokenResponse = await fetch(INTERVALS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const rawBody = await tokenResponse.text();
  let payload: any = null;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error("Failed to parse Intervals token response", error, rawBody);
  }

  if (!tokenResponse.ok || !payload) {
    console.error(
      "Intervals token exchange failed",
      tokenResponse.status,
      tokenResponse.statusText,
      rawBody,
    );
    return htmlResponse(
      "Dolor — Authorization failed",
      "<p>Intervals.icu declined the token exchange. Head back to Telegram and try again.</p>",
      502,
    );
  }

  const accessToken =
    typeof payload.access_token === "string" && payload.access_token.trim()
      ? payload.access_token.trim()
      : null;
  const athleteId =
    payload.athlete?.id !== undefined && payload.athlete?.id !== null
      ? String(payload.athlete.id)
      : null;

  if (!accessToken || !athleteId) {
    console.error("Intervals token response missing required fields", payload);
    return htmlResponse(
      "Dolor — Authorization failed",
      "<p>Intervals.icu sent an incomplete token payload. Head back to Telegram and try again.</p>",
      502,
    );
  }

  await saveTelegramIntervalsCredential({
    telegramUserId: state.telegramUserId,
    telegramUsername: state.telegramUsername ?? null,
    athleteId,
    athleteName: payload.athlete?.name ?? null,
    accessToken,
    scope: typeof payload.scope === "string" ? payload.scope : "",
    tokenType: typeof payload.token_type === "string" ? payload.token_type : "Bearer",
    updatedAt: new Date().toISOString(),
  });

  try {
    const user = await upsertUserFromIntervals({
      athleteId,
      athleteName: payload.athlete?.name ?? null,
      accessToken,
      scope: typeof payload.scope === "string" ? payload.scope : "",
      tokenType: typeof payload.token_type === "string" ? payload.token_type : "Bearer",
      updatedAt: new Date().toISOString(),
    });
    await linkTelegramUserToUser(state.telegramUserId, user.id);
  } catch (error) {
    console.error("Failed to link Telegram credential to web user", error);
  }

  return htmlResponse(
    "Dolor is connected",
    "<p>All set! You can close this tab and jump back into Telegram—Dolor now has access to your Intervals.icu data.</p>",
  );
};
