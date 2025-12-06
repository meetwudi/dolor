import { handleConnectRequest } from "../lib/intervals-oauth-handlers";

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request) {
  return handleConnectRequest(request);
}
