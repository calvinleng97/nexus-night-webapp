/**
 * On-disk schema version. Bump when the shapes in src/lib/domain/types.ts
 * change incompatibly, and add a migration keyed to the old version.
 */
export const SCHEMA_VERSION = 6;

export interface StoreMeta {
  schemaVersion: number;
  createdAt: string;
  app: string;
}
