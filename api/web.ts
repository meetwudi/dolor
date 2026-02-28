import {
  handleCreateThreadRequest,
  handleListThreadsRequest,
  handleLogoutRequest,
  handleMeRequest,
  handlePatchThreadRequest,
  handleStreamMessageRequest,
  handleThreadMessagesRequest,
} from "../lib/web-chat-api";
import { handleWebCallbackRequest, handleWebLoginRequest } from "../lib/web-oauth";
import {
  toRequest,
  sendResponse,
  type NodeRequest,
  type NodeResponse,
} from "../lib/vercel-request";

const notFound = () => Response.json({ error: "Not Found" }, { status: 404 });

const decodePath = (requestUrl: string) => {
  const url = new URL(requestUrl);
  const raw = url.searchParams.get("path") ?? "";
  return raw.startsWith("/") ? raw.slice(1) : raw;
};

export default async function handler(req: NodeRequest, res: NodeResponse) {
  try {
    const request = await toRequest(req);
    const path = decodePath(request.url);
    const method = request.method.toUpperCase();

    let response: Response;

    if (path === "auth/login") {
      response = await handleWebLoginRequest(request);
    } else if (path === "auth/callback") {
      response = await handleWebCallbackRequest(request);
    } else if (path === "me" && method === "GET") {
      response = await handleMeRequest(request);
    } else if (path === "logout" && method === "POST") {
      response = await handleLogoutRequest(request);
    } else if (path === "threads" && method === "GET") {
      response = await handleListThreadsRequest(request);
    } else if (path === "threads" && method === "POST") {
      response = await handleCreateThreadRequest(request);
    } else {
      const threadMatch = path.match(/^threads\/([^/]+)$/);
      const messagesMatch = path.match(/^threads\/([^/]+)\/messages$/);
      const streamMatch = path.match(/^threads\/([^/]+)\/messages\/stream$/);

      if (threadMatch && method === "PATCH") {
        response = await handlePatchThreadRequest(
          request,
          decodeURIComponent(threadMatch[1] ?? ""),
        );
      } else if (messagesMatch && method === "GET") {
        response = await handleThreadMessagesRequest(
          request,
          decodeURIComponent(messagesMatch[1] ?? ""),
        );
      } else if (streamMatch && method === "POST") {
        response = await handleStreamMessageRequest(
          request,
          decodeURIComponent(streamMatch[1] ?? ""),
        );
      } else {
        response = notFound();
      }
    }

    await sendResponse(res, response);
  } catch (error) {
    console.error("Web API handler failed", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

