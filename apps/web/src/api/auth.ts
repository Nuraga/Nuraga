import { api } from "./client";
import type { CurrentUser } from "./types";

export type LoginResult =
  | { status: "mfa_required"; mfaToken: string }
  | { status: "ok"; totpSetupRequired: boolean; accessToken: string; refreshToken: string };

export interface TwoFactorSetup {
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export const authApi = {
  login: (identifier: string, password: string) =>
    api.anonymousPost<LoginResult>("/auth/login", { identifier, password }),
  verify2fa: (mfaToken: string, code: string) =>
    api.anonymousPost<{ accessToken: string; refreshToken: string }>("/auth/2fa/verify", {
      mfaToken,
      code,
    }),
  me: () => api.get<CurrentUser>("/auth/me"),
  logout: (refreshToken: string) => api.anonymousPost<{ ok: true }>("/auth/logout", { refreshToken }),
  setup2fa: () => api.post<TwoFactorSetup>("/auth/2fa/setup"),
  enable2fa: (code: string) => api.post<{ ok: true }>("/auth/2fa/enable", { code }),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post<{ ok: true }>("/auth/change-password", { oldPassword, newPassword }),
};
