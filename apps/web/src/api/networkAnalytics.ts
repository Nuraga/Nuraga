import { api } from "./client";
import type { NetworkDashboard } from "./types";

export const networkAnalyticsApi = {
  dashboard: () => api.get<NetworkDashboard>("/network-analytics/dashboard"),
};
