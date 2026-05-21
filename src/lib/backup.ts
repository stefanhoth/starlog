import { get } from 'svelte/store';
import { storiesStore } from './stores/stories';
import { jobProfilesStore } from './stores/jobProfiles';
import type { Story, JobProfile } from './types';

export interface BackupBundle {
  version: number;
  exportedAt: string;
  appVersion: string;
  stories: Story[];
  jobProfiles: JobProfile[];
}

export function exportData(): void {
  const bundle: BackupBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: __APP_VERSION__,
    stories: get(storiesStore),
    jobProfiles: get(jobProfilesStore),
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `starlog-backup-${new Date().toISOString().slice(0, 10)}.starlog.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseBackup(file: File): Promise<BackupBundle> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (typeof data !== 'object' || data === null) throw new Error('Invalid backup file.');
  const d = data as Record<string, unknown>;
  if (typeof d.version !== 'number') throw new Error('Missing or invalid "version" field.');
  if (!Array.isArray(d.stories)) throw new Error('Missing or invalid "stories" field.');
  if (!Array.isArray(d.jobProfiles)) throw new Error('Missing or invalid "jobProfiles" field.');
  for (const s of d.stories as unknown[]) {
    if (typeof s !== 'object' || s === null || !('id' in s) || !('title' in s))
      throw new Error('One or more stories have an invalid shape (missing id or title).');
  }
  for (const p of d.jobProfiles as unknown[]) {
    if (typeof p !== 'object' || p === null || !('id' in p) || !('company' in p))
      throw new Error('One or more job profiles have an invalid shape (missing id or company).');
  }
  return data as BackupBundle;
}

export function applyImport(bundle: BackupBundle): void {
  storiesStore.restore(bundle.stories);
  jobProfilesStore.restore(bundle.jobProfiles);
}
