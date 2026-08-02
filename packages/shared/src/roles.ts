// Mirrors the Prisma `Role` enum. Kept independent so the web app never
// depends on @prisma/client directly.
export const ROLES = [
  "SUPERADMIN",
  "OWNER",
  "BRANCH_MANAGER",
  "MANAGER",
  "ACCOUNTANT",
  "TEACHER",
  "PARENT",
] as const;

export type Role = (typeof ROLES)[number];
