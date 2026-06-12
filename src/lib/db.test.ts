import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// fake-indexeddb/auto installs all IDB globals (IDBRequest, IDBKeyRange, IDBTransaction, …)
// required by the idb library's internals. Must be imported before any getDB() call.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { _resetDB, getDB, loadWithFallback, persistToDB } from './db';

// ── Setup ─────────────────────────────────────────────────────────────────────

let lsStore: Record<string, string>;

beforeEach(() => {
  // Fresh in-memory IndexedDB for each test — no cross-test data bleed.
  vi.stubGlobal('indexedDB', new IDBFactory());
  _resetDB();

  // localStorage shim (absent in node environment).
  lsStore = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => lsStore[key] ?? null,
    setItem: (key: string, val: string) => { lsStore[key] = val; },
    removeItem: (key: string) => { delete lsStore[key]; },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── loadWithFallback ──────────────────────────────────────────────────────────

describe('loadWithFallback', () => {
  it('returns the empty default when IDB and localStorage are both empty', async () => {
    const result = await loadWithFallback('stories', 'starlog_stories', []);
    expect(result).toEqual([]);
  });

  it('reads from the IDB data store when populated', async () => {
    const stories = [{ id: '1', title: 'From IDB' }];
    const db = await getDB();
    await db.put('data', JSON.stringify(stories), 'stories');

    const result = await loadWithFallback('stories', 'starlog_stories', []);
    expect(result).toEqual(stories);
  });

  it('falls back to the snapshots store when data store is empty', async () => {
    const stories = [{ id: '2', title: 'From Snapshot' }];
    const db = await getDB();
    await db.put('snapshots', JSON.stringify(stories), 'stories');

    const result = await loadWithFallback('stories', 'starlog_stories', []);
    expect(result).toEqual(stories);
  });

  it('migrates data from localStorage to IDB on first access', async () => {
    const stories = [{ id: '3', title: 'From LS' }];
    lsStore['starlog_stories'] = JSON.stringify(stories);

    const result = await loadWithFallback('stories', 'starlog_stories', []);
    expect(result).toEqual(stories);

    // Verify IDB was populated as part of migration.
    const db = await getDB();
    const raw = await db.get('data', 'stories');
    expect(JSON.parse(raw!)).toEqual(stories);
  });

  it('prefers IDB data over localStorage', async () => {
    const fromIDB = [{ id: 'idb' }];
    const fromLS = [{ id: 'ls' }];
    lsStore['starlog_stories'] = JSON.stringify(fromLS);
    const db = await getDB();
    await db.put('data', JSON.stringify(fromIDB), 'stories');

    expect(await loadWithFallback('stories', 'starlog_stories', [])).toEqual(fromIDB);
  });

  it('returns the empty default when all sources are absent', async () => {
    expect(await loadWithFallback('jobProfiles', 'starlog_job_profiles', [])).toEqual([]);
  });
});

// ── persistToDB ───────────────────────────────────────────────────────────────

describe('persistToDB', () => {
  it('writes the value to the data store', async () => {
    const db = await getDB();
    const data = [{ id: '1' }];
    await persistToDB(db, 'stories', data);

    const raw = await db.get('data', 'stories');
    expect(JSON.parse(raw!)).toEqual(data);
  });

  it('moves the previous data-store value into snapshots before overwriting', async () => {
    const db = await getDB();
    const v1 = [{ id: '1', v: 1 }];
    const v2 = [{ id: '1', v: 2 }];

    await persistToDB(db, 'stories', v1);
    await persistToDB(db, 'stories', v2);

    const snap = await db.get('snapshots', 'stories');
    expect(JSON.parse(snap!)).toEqual(v1);

    const current = await db.get('data', 'stories');
    expect(JSON.parse(current!)).toEqual(v2);
  });

  it('also mirrors the value to localStorage when lsKey is provided', async () => {
    const db = await getDB();
    const data = [{ id: '1' }];
    await persistToDB(db, 'stories', data, 'starlog_stories');

    expect(lsStore['starlog_stories']).toBe(JSON.stringify(data));
  });

  it('does not write to localStorage when lsKey is omitted', async () => {
    const db = await getDB();
    await persistToDB(db, 'stories', [{ id: '1' }]);
    expect(Object.keys(lsStore)).toHaveLength(0);
  });
});
