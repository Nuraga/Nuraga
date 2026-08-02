// A Device is deliberately not an AuthenticatedUser — see the schema.prisma
// comment above the Device model. It never carries branch grants, network
// access, or any of the human permission machinery.
export interface AuthenticatedDevice {
  id: string;
  branchId: string;
}
