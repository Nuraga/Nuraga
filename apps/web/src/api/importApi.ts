import { api } from "./client";
import type { ImportReport } from "./types";

export const importApi = {
  importChildren: (branchId: string, file: File, dryRun: boolean) =>
    api.upload<ImportReport>(`/branches/${branchId}/import/children`, file, {
      query: { dryRun: dryRun ? "true" : undefined },
    }),
};
