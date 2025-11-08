import { AsyncLocalStorage } from "async_hooks";

type SessionContextValue = {
  sessionId?: string;
};

const storage = new AsyncLocalStorage<SessionContextValue>();

export const withSessionContext = async <T>(
  context: SessionContextValue,
  fn: () => Promise<T> | T,
): Promise<T> => {
  return await storage.run(context, async () => await fn());
};

export const getSessionContext = (): SessionContextValue | undefined => storage.getStore();
