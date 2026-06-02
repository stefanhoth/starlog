import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

interface StarlogSchema extends DBSchema {
  data: { key: string; value: string };
  snapshots: { key: string; value: string };
}

export type StarlogDB = IDBPDatabase<StarlogSchema>;

let _db: Promise<StarlogDB> | null = null;

export function getDB(): Promise<StarlogDB> {
  if (!_db) {
    _db = openDB<StarlogSchema>('starlog', 2, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        // Create stores only on a fresh install (not present when upgrading from v1).
        if (oldVersion < 1) {
          db.createObjectStore('data');
          db.createObjectStore('snapshots');
        }

        // v1 → v2: reset rank === 3 (the pre-#103 auto-default) to null (unrated).
        // Runs exactly once per browser thanks to the version gate.
        if (oldVersion < 2) {
          // Migrate stories already in the IDB data and snapshots stores.
          for (const storeName of ['data', 'snapshots'] as const) {
            const raw = await tx.objectStore(storeName).get('stories');
            if (!raw) continue;
            try {
              const stories = JSON.parse(raw) as Array<Record<string, unknown>>;
              if (stories.some(s => s['rank'] === 3)) {
                const migrated = stories.map(s =>
                  s['rank'] === 3 ? { ...s, rank: null } : s
                );
                await tx.objectStore(storeName).put(JSON.stringify(migrated), 'stories');
              }
            } catch {
              // corrupted blob — leave as-is rather than destroying data
            }
          }

        }
      },
    });
  }
  return _db;
}

/**
 * Reads a JSON value from the data store, falls back to snapshots if missing,
 * then falls back to localStorage. Migrates to IndexedDB on first access.
 */
export async function loadWithFallback<T>(key: string, lsKey: string, empty: T): Promise<T> {
  const db = await getDB();

  let raw = await db.get('data', key);

  if (!raw) {
    raw = await db.get('snapshots', key);
  }

  if (raw) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      // corrupted — fall through to localStorage
    }
  }

  // One-time migration from localStorage
  try {
    const lsRaw = localStorage.getItem(lsKey);
    if (lsRaw) {
      const data = JSON.parse(lsRaw) as T;
      await persistToDB(db, key, data);
      return data;
    }
  } catch {
    // localStorage inaccessible or corrupt — continue with empty
  }

  return empty;
}

/**
 * Writes value to the data store and updates the rolling snapshot
 * (snapshot = the previous known-good state, one write behind).
 */
export async function persistToDB<T>(db: StarlogDB, key: string, value: T): Promise<void> {
  const tx = db.transaction(['data', 'snapshots'], 'readwrite');
  const current = tx.objectStore('data').get(key);
  const prev = await current;
  if (prev !== undefined) {
    // archive the previous state before overwriting
    tx.objectStore('snapshots').put(prev, key);
  }
  tx.objectStore('data').put(JSON.stringify(value), key);
  await tx.done;
}
