import { handleWebApiRequest } from "../../lib/web-chat-api";
import { handleWebCallbackRequest, handleWebLoginRequest } from "../../lib/web-oauth";
import {
  toRequest,
  sendResponse,
  type NodeRequest,
  type NodeResponse,
} from "../../lib/vercel-request";

export default async function handler(req: NodeRequest, res: NodeResponse) {
  try {
    const request = await toRequest(req);
    const url = new URL(request.url);
    let response: Response;

    if (url.pathname === "/api/web/auth/login") {
      response = await handleWebLoginRequest(request);
    } else if (url.pathname === "/api/web/auth/callback") {
      response = await handleWebCallbackRequest(request);
    } else {
      response = await handleWebApiRequest(request);
    }

    await sendResponse(res, response);
  } catch (error) {
    console.error("Web API handler failed", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

