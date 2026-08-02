export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");

// Adapter boundary (TRD section 13: swapping the provider must never touch
// business logic). Local-disk today, S3/MinIO-compatible later — same
// interface either way.
export interface ObjectStorage {
  save(key: string, data: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
