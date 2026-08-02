// Deliberately separate from api/client.ts's token storage (single global
// slot) — a kiosk tablet that's ever also used to browse the normal staff
// app must not have its device session clobbered by a human login, or vice
// versa. See apps/api/src/devices for the backend half of this split.

const KIOSK_TOKEN_KEY = "detsad_kiosk_token";
const KIOSK_BRANCH_KEY = "detsad_kiosk_branch_id";
const KIOSK_NAME_KEY = "detsad_kiosk_device_name";

export function getKioskToken(): string | null {
  return localStorage.getItem(KIOSK_TOKEN_KEY);
}

export function getKioskBranchId(): string | null {
  return localStorage.getItem(KIOSK_BRANCH_KEY);
}

export function getKioskDeviceName(): string | null {
  return localStorage.getItem(KIOSK_NAME_KEY);
}

export function hasKioskSession(): boolean {
  return getKioskToken() !== null;
}

export function setKioskSession(accessToken: string, branchId: string, deviceName: string): void {
  localStorage.setItem(KIOSK_TOKEN_KEY, accessToken);
  localStorage.setItem(KIOSK_BRANCH_KEY, branchId);
  localStorage.setItem(KIOSK_NAME_KEY, deviceName);
}

export function clearKioskSession(): void {
  localStorage.removeItem(KIOSK_TOKEN_KEY);
  localStorage.removeItem(KIOSK_BRANCH_KEY);
  localStorage.removeItem(KIOSK_NAME_KEY);
}

export class KioskApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "KioskApiError";
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join("; ");
    if (body.message) return body.message;
  } catch {
    // response body wasn't JSON
  }
  return `${res.status} ${res.statusText}`;
}

async function kioskRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  const token = getKioskToken();
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    clearKioskSession();
    throw new KioskApiError(401, "Сессия устройства недействительна — настройте киоск заново");
  }
  if (!res.ok) throw new KioskApiError(res.status, await parseErrorMessage(res));

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface KioskPairResult {
  accessToken: string;
  branchId: string;
  deviceName: string;
}

export interface KioskScanResult {
  staffFullName: string;
  type: "CHECK_IN" | "CHECK_OUT";
  occurredAt: string;
}

export const kioskApi = {
  pair: (deviceId: string, secret: string) =>
    kioskRequest<KioskPairResult>(`/devices/${deviceId}/pair`, { method: "POST", body: { secret } }),
  scan: (branchId: string, token: string) =>
    kioskRequest<KioskScanResult>(`/branches/${branchId}/kiosk/scan`, { method: "POST", body: { token } }),
};
