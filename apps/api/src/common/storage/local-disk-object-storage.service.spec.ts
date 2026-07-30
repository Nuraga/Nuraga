import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalDiskObjectStorage } from "./local-disk-object-storage.service";

describe("LocalDiskObjectStorage", () => {
  let root: string;
  let storage: LocalDiskObjectStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "detsad-storage-"));
    const config = { get: jest.fn(() => root) };
    storage = new LocalDiskObjectStorage(config as any);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("round-trips a saved file", async () => {
    await storage.save("children/child1/doc.pdf", Buffer.from("hello"), "application/pdf");
    const data = await storage.read("children/child1/doc.pdf");
    expect(data.toString()).toBe("hello");
  });

  it("deletes a file", async () => {
    await storage.save("a.txt", Buffer.from("x"), "text/plain");
    await storage.delete("a.txt");
    await expect(storage.read("a.txt")).rejects.toThrow();
  });

  it("rejects a key that attempts path traversal", async () => {
    await expect(storage.save("../../escape.txt", Buffer.from("x"), "text/plain")).rejects.toThrow(
      "Invalid object storage key",
    );
  });
});
