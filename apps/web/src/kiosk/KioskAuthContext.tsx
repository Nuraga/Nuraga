import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  clearKioskSession,
  getKioskBranchId,
  getKioskDeviceName,
  hasKioskSession,
  kioskApi,
  setKioskSession,
} from "../api/kioskClient";

type KioskStatus = "unpaired" | "paired";

interface KioskAuthContextValue {
  status: KioskStatus;
  branchId: string | null;
  deviceName: string | null;
  pair: (deviceId: string, secret: string) => Promise<void>;
  unpair: () => void;
}

const KioskAuthContext = createContext<KioskAuthContextValue | null>(null);

export function KioskAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<KioskStatus>(hasKioskSession() ? "paired" : "unpaired");
  const [branchId, setBranchId] = useState<string | null>(getKioskBranchId());
  const [deviceName, setDeviceName] = useState<string | null>(getKioskDeviceName());

  const pair = useCallback(async (deviceId: string, secret: string) => {
    const result = await kioskApi.pair(deviceId, secret);
    setKioskSession(result.accessToken, result.branchId, result.deviceName);
    setBranchId(result.branchId);
    setDeviceName(result.deviceName);
    setStatus("paired");
  }, []);

  const unpair = useCallback(() => {
    clearKioskSession();
    setBranchId(null);
    setDeviceName(null);
    setStatus("unpaired");
  }, []);

  const value = useMemo(
    () => ({ status, branchId, deviceName, pair, unpair }),
    [status, branchId, deviceName, pair, unpair],
  );

  return <KioskAuthContext.Provider value={value}>{children}</KioskAuthContext.Provider>;
}

export function useKioskAuth(): KioskAuthContextValue {
  const ctx = useContext(KioskAuthContext);
  if (!ctx) throw new Error("useKioskAuth must be used within KioskAuthProvider");
  return ctx;
}
