import { api } from "./client";
import type { AppNotification } from "./types";

export const notificationsApi = {
  list: (onlyUnread = false) => api.get<AppNotification[]>("/notifications", { onlyUnread }),
  markRead: (id: string) => api.post<{ ok: true }>(`/notifications/${id}/read`),
  markAllRead: () => api.post<{ ok: true }>("/notifications/read-all"),
};
