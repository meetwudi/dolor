import type { IncomingMessage, ServerResponse } from "node:http";

export type NodeRequest = IncomingMessage & {
  body?: any;
  rawBody?: any;
};

export type NodeResponse = ServerResponse & {
  status: (code: number) => NodeResponse;
  send: (body?: any) => void;
  json: (body: any) => void;
};

const buildHeaders = (req: NodeRequest) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === "string") headers.append(key, entry);
      });
      continue;
    }
    if (typeof value === "string") {
      headers.append(key, value);
    }
  }
  return headers;
};

const getBody = (req: NodeRequest): BodyInit | undefined => {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const body = req.body ?? (req as any).rawBody;
  if (!body) return undefined;
  if (typeof body === "string") return body;
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    return body as unknown as BodyInit;
  }
  return JSON.stringify(body) as BodyInit;
};

export const toRequest = (req: NodeRequest) => {
  const protocol =
    (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined) ??
    req.headers.host ??
    "localhost";
  const origin = `${protocol}://${host}`;
  const url = new URL(req.url ?? "/api/telegram", origin);

  return new Request(url, {
    method: req.method,
    headers: buildHeaders(req),
    body: getBody(req),
  });
};

export const sendResponse = async (res: NodeResponse, response: Response) => {
  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  res.send(buffer);
};
