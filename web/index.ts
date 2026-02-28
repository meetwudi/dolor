import { serve } from "bun";
import { handleConnectRequest, handleIntervalsCallback } from "../lib/intervals-oauth-handlers";
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
import index from "./index.html";

const server = serve({
  idleTimeout: 255,
  routes: {
    "/auth/web/login": {
      async GET(req) {
        return handleWebLoginRequest(req);
      },
    },
    "/auth/web/callback": {
      async GET(req) {
        return handleWebCallbackRequest(req);
      },
    },
    "/connect": {
      async GET(req) {
        return handleConnectRequest(req);
      },
    },
    "/auth/intervals/callback": {
      async GET(req) {
        return handleIntervalsCallback(req);
      },
    },
    "/api/web/me": {
      async GET(req) {
        return handleMeRequest(req);
      },
    },
    "/api/web/logout": {
      async POST(req) {
        return handleLogoutRequest(req);
      },
    },
    "/api/web/threads": {
      async GET(req) {
        return handleListThreadsRequest(req);
      },
      async POST(req) {
        return handleCreateThreadRequest(req);
      },
    },
    "/api/web/threads/:threadId": {
      async PATCH(req) {
        return handlePatchThreadRequest(req, req.params.threadId);
      },
    },
    "/api/web/threads/:threadId/messages": {
      async GET(req) {
        return handleThreadMessagesRequest(req, req.params.threadId);
      },
    },
    "/api/web/threads/:threadId/messages/stream": {
      async POST(req) {
        return handleStreamMessageRequest(req, req.params.threadId);
      },
    },
    "/*": index,
  },
  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
