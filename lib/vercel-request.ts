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

const readStreamBody = async (req: NodeRequest) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk);
    }
  }
  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks);
};

const getBody = async (req: NodeRequest): Promise<BodyInit | undefined> => {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const body = req.body ?? (req as any).rawBody;
  if (body !== undefined && body !== null) {
    if (typeof body === "string") return body;
    if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
      return body as unknown as BodyInit;
    }
    return JSON.stringify(body) as BodyInit;
  }
  return (await readStreamBody(req)) as BodyInit | undefined;
};

export const toRequest = async (req: NodeRequest) => {
  const protocol =
    (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined) ??
    req.headers.host ??
    "localhost";
  const origin = `${protocol}://${host}`;
  const url = new URL(req.url ?? "/api/telegram", origin);

  const body = await getBody(req);
  return new Request(url, {
    method: req.method,
    headers: buildHeaders(req),
    body,
  });
};

export const sendResponse = async (res: NodeResponse, response: Response) => {
  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();
  try {
    if (typeof (res as any).flushHeaders === "function") {
      (res as any).flushHeaders();
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length) {
        res.write(Buffer.from(value));
      }
    }
  } finally {
    res.end();
  }
};
