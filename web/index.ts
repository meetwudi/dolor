import { serve } from "bun";
import { handleConnectRequest, handleIntervalsCallback } from "../lib/intervals-oauth-handlers";
import index from "./index.html";

const server = serve({
  routes: {
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
    "/api/hello": {
      async GET() {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT() {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },
    "/api/hello/:name": async (req) => {
      const name = req.params.name;
      return Response.json({ message: `Hello, ${name}!` });
    },
    "/*": index,
  },
  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
