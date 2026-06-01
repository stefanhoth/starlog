import { writable } from 'svelte/store';
import { getDB } from '../db';

const IDB_KEY = 'whatsNewLastSeen';

export const lastSeenDate = writable<string | null>(null);

export async function initWhatsNew(): Promise<void> {
  const db = await getDB();
  const raw = await db.get('data', IDB_KEY);
  if (raw) lastSeenDate.set(raw); // raw is stored as a plain string (not JSON)
}

export async function markSeen(date: string): Promise<void> {
  lastSeenDate.set(date);
  const db = await getDB();
  const tx = db.transaction('data', 'readwrite');
  tx.objectStore('data').put(date, IDB_KEY);
  await tx.done;
}
