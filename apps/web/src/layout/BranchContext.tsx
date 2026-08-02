import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { branchesApi } from "../api/branches";
import type { Branch } from "../api/types";
import { useAuth } from "../auth/AuthContext";

const SELECTED_BRANCH_KEY = "detsad_selected_branch";

interface BranchContextValue {
  branches: Branch[];
  isLoading: boolean;
  selectedBranchId: string | null;
  selectedBranch: Branch | null;
  setSelectedBranchId: (id: string) => void;
}

const BranchContext = createContext<BranchContextValue | null>(null);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: branchesApi.list,
    enabled: status === "authenticated",
  });

  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(
    () => localStorage.getItem(SELECTED_BRANCH_KEY),
  );

  useEffect(() => {
    if (branches.length === 0) return;
    const stillValid = branches.some((b) => b.id === selectedBranchId);
    if (!stillValid) {
      setSelectedBranchIdState(branches[0].id);
      localStorage.setItem(SELECTED_BRANCH_KEY, branches[0].id);
    }
  }, [branches, selectedBranchId]);

  function setSelectedBranchId(id: string) {
    setSelectedBranchIdState(id);
    localStorage.setItem(SELECTED_BRANCH_KEY, id);
  }

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );

  const value = useMemo(
    () => ({ branches, isLoading, selectedBranchId, selectedBranch, setSelectedBranchId }),
    [branches, isLoading, selectedBranchId, selectedBranch],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch(): BranchContextValue {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within BranchProvider");
  return ctx;
}
