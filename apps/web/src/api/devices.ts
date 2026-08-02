import { api } from "./client";

export interface Device {
  id: string;
  branchId: string;
  name: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface ProvisionDeviceResult {
  device: Device;
  /** Shown to the operator exactly once — the backend never returns it again. */
  secret: string;
}

export const devicesApi = {
  list: (branchId: string) => api.get<Device[]>(`/branches/${branchId}/devices`),
  provision: (branchId: string, name: string) =>
    api.post<ProvisionDeviceResult>(`/branches/${branchId}/devices`, { name }),
  revoke: (branchId: string, deviceId: string) =>
    api.post<void>(`/branches/${branchId}/devices/${deviceId}/revoke`),
};
