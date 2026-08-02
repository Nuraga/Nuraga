export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const REFRESH_TOKEN_KEY = "detsad_refresh_token";

let accessToken: string | null = null;
let refreshToken: string | null = localStorage.getItem(REFRESH_TOKEN_KEY);
let refreshInFlight: Promise<TokenPair | null> | null = null;

type ExpiredListener = () => void;
const expiredListeners = new Set<ExpiredListener>();

export function onSessionExpired(listener: ExpiredListener): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

export function setTokens(pair: TokenPair): void {
  accessToken = pair.accessToken;
  refreshToken = pair.refreshToken;
  localStorage.setItem(REFRESH_TOKEN_KEY, pair.refreshToken);
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasSession(): boolean {
  return refreshToken !== null;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join("; ");
    if (body.message) return body.message;
  } catch {
    // response body wasn't JSON — fall through to the generic message
  }
  return `${res.status} ${res.statusText}`;
}

async function doRefresh(): Promise<TokenPair | null> {
  if (!refreshToken) return null;
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const pair = (await res.json()) as TokenPair;
    setTokens(pair);
    return pair;
  } catch {
    return null;
  }
}

async function ensureFreshAccessToken(): Promise<void> {
  if (accessToken || !refreshToken) return;
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  await refreshInFlight;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Skip attaching the Authorization header (login/refresh only). */
  anonymous?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`/api${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.pathname + url.search;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  if (!options.anonymous) await ensureFreshAccessToken();

  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (!options.anonymous && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !options.anonymous && !isRetry) {
    accessToken = null;
    const pair = await doRefresh();
    if (pair) return request<T>(path, options, true);

    clearTokens();
    for (const listener of expiredListeners) listener();
    throw new ApiError(401, "Session expired");
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res));
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function upload<T>(
  path: string,
  file: File,
  options: { fields?: Record<string, string | undefined>; query?: RequestOptions["query"] } = {},
): Promise<T> {
  await ensureFreshAccessToken();

  const formData = new FormData();
  formData.append("file", file);
  if (options.fields) {
    for (const [key, value] of Object.entries(options.fields)) {
      if (value !== undefined) formData.append(key, value);
    }
  }

  const headers: Record<string, string> = {};
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(buildUrl(path, options.query), { method: "POST", headers, body: formData });

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res));
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown, query?: RequestOptions["query"]) =>
    request<T>(path, { method: "POST", body, query }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  anonymousPost: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body, anonymous: true }),
  upload,
};
