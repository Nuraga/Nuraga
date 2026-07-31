import { BadRequestException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { DocumentsService } from "./documents.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import type { ChildAccessService } from "./child-access.service";

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "u1",
    email: "u1@example.com",
    phone: null,
    fullName: "Test",
    grants: [],
    hasNetworkAccess: false,
    ...overrides,
  };
}

describe("DocumentsService", () => {
  const branchId = "b1";
  const childId = "c1";
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });

  let prisma: any;
  let childAccess: { assertWriteAccess: jest.Mock; getReadableOrThrow: jest.Mock };
  let audit: { record: jest.Mock };
  let fileUrls: { sign: jest.Mock };
  let storage: { save: jest.Mock; read: jest.Mock; delete: jest.Mock };
  let service: DocumentsService;

  beforeEach(() => {
    prisma = {
      documentType: {
        findUnique: jest.fn(() => Promise.resolve({ id: "dt1", name: "Справка", isActive: true })),
      },
      document: {
        create: jest.fn((args: any) => Promise.resolve({ id: "doc1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() =>
          Promise.resolve({ id: "doc1", ownerType: "CHILD", ownerId: childId, fileKey: "k1" }),
        ),
        delete: jest.fn(() => Promise.resolve()),
      },
      child: { findMany: jest.fn(() => Promise.resolve([{ id: childId }])) },
    };
    childAccess = {
      assertWriteAccess: jest.fn(),
      getReadableOrThrow: jest.fn(() => Promise.resolve({ id: childId })),
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    fileUrls = { sign: jest.fn(() => Promise.resolve("signed-token")) };
    storage = {
      save: jest.fn(() => Promise.resolve()),
      read: jest.fn(),
      delete: jest.fn(() => Promise.resolve()),
    };

    service = new DocumentsService(
      prisma,
      new BranchScopeService(),
      childAccess as unknown as ChildAccessService,
      audit as any,
      fileUrls as any,
      storage as any,
    );
  });

  it("uploads a file: saves to storage and records metadata (not raw bytes) in the audit log", async () => {
    const file = { buffer: Buffer.from("pdf-bytes"), mimetype: "application/pdf", originalname: "справка.pdf" };
    const doc = await service.upload(manager, branchId, childId, { documentTypeId: "dt1" }, file);

    expect(childAccess.assertWriteAccess).toHaveBeenCalledWith(manager, branchId);
    expect(storage.save).toHaveBeenCalledWith(
      expect.stringContaining(`children/${childId}/`),
      file.buffer,
      "application/pdf",
    );
    expect(doc).toMatchObject({ ownerType: "CHILD", ownerId: childId, mimeType: "application/pdf" });
    expect(JSON.stringify(audit.record.mock.calls[0][0])).not.toContain("pdf-bytes");
  });

  it("rejects upload for an unknown document type", async () => {
    prisma.documentType.findUnique.mockResolvedValue(null);
    const file = { buffer: Buffer.from("x"), mimetype: "text/plain", originalname: "a.txt" };
    await expect(
      service.upload(manager, branchId, childId, { documentTypeId: "missing" }, file),
    ).rejects.toThrow(NotFoundException);
  });

  it("rejects upload for an archived document type", async () => {
    prisma.documentType.findUnique.mockResolvedValue({ id: "dt1", name: "Справка", isActive: false });
    const file = { buffer: Buffer.from("x"), mimetype: "text/plain", originalname: "a.txt" };
    await expect(
      service.upload(manager, branchId, childId, { documentTypeId: "dt1" }, file),
    ).rejects.toThrow(BadRequestException);
  });

  it("list() returns documents with a signed download URL", async () => {
    prisma.document.findMany.mockResolvedValue([
      { id: "doc1", fileKey: "k1", mimeType: "application/pdf", fileName: "a.pdf" },
    ]);

    const docs = await service.list(manager, branchId, childId);
    expect(docs[0].downloadUrl).toBe("/api/files/signed-token");
  });

  it("remove() 404s when the document belongs to a different child", async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: "doc1",
      ownerType: "CHILD",
      ownerId: "other-child",
    });
    await expect(service.remove(manager, branchId, childId, "doc1")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("remove() deletes from storage and the DB", async () => {
    await service.remove(manager, branchId, childId, "doc1");
    expect(storage.delete).toHaveBeenCalledWith("k1");
    expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: "doc1" } });
  });

  it("listExpiring() restricts to children in the branch within the lookahead window", async () => {
    await service.listExpiring(manager, branchId, 14);
    expect(prisma.child.findMany).toHaveBeenCalledWith({
      where: { family: { branchId } },
      select: { id: true },
    });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerId: { in: [childId] } }),
      }),
    );
  });
});
