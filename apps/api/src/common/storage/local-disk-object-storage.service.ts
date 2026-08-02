import { join, normalize, resolve, sep } from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ObjectStorage } from "./object-storage.interface";

@Injectable()
export class LocalDiskObjectStorage implements ObjectStorage {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>("OBJECT_STORAGE_LOCAL_ROOT") ?? "storage/local");
  }

  // contentType is unused here (local disk has no object metadata store) —
  // the S3/MinIO adapter that replaces this in prod-like envs will use it.
  // It's tracked in Document.mimeType in the DB either way.
  async save(key: string, data: Buffer, _contentType: string): Promise<void> {
    const path = this.resolveKey(key);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, data);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  // Rejects any key that would escape the storage root (path traversal).
  private resolveKey(key: string): string {
    const path = resolve(this.root, normalize(key));
    if (!path.startsWith(this.root + sep) && path !== this.root) {
      throw new Error("Invalid object storage key");
    }
    return path;
  }
}
