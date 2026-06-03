import { get } from 'svelte/store';
import { storiesStore } from './stores/stories';
import { jobProfilesStore } from './stores/jobProfiles';
import type { Story, JobProfile } from './types';

// The current bundle format version this app understands.
// Bundles with a higher version number were made by a newer build and
// may contain fields/shapes we don't know about — reject them rather
// than silently misparse.
export const KNOWN_BUNDLE_VERSION = 1;

// Policy: a single malformed entry rejects the whole bundle.
// Partial imports are harder to reason about and could leave the user
// with a subtly broken data set. Fail loudly so the user knows.

// ─── Size caps ───────────────────────────────────────────────────────────────
const MAX_STORIES = 10_000;
const MAX_JOB_PROFILES = 1_000;
const MAX_LEN_TITLE = 500;
const MAX_LEN_JOB_DESCRIPTION = 100_000;
const MAX_LEN_STRING = 10_000;

// ─── Prototype-pollution sentinel ────────────────────────────────────────────
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isStringOrNull(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

function isNonEmptyStringOrNull(v: unknown): v is string | null {
  return v === null || isNonEmptyString(v);
}

function isBoundedString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length <= max;
}

function isArrayOfStrings(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

// ─── Per-field type guards ────────────────────────────────────────────────────

function isStory(x: unknown): x is Story {
  if (typeof x !== 'object' || x === null) return false;
  const s = x as Record<string, unknown>;

  // id
  if (!isNonEmptyString(s.id)) return false;
  if (!isBoundedString(s.id, MAX_LEN_STRING)) return false;

  // title
  if (!isNonEmptyString(s.title)) return false;
  if (!isBoundedString(s.title, MAX_LEN_TITLE)) return false;

  // original_language
  if (typeof s.original_language !== 'string') return false;
  if (!isBoundedString(s.original_language, MAX_LEN_STRING)) return false;

  // competency_tags
  if (!isArrayOfStrings(s.competency_tags)) return false;
  if (s.competency_tags.some((t) => t.length > MAX_LEN_STRING)) return false;

  // star
  if (typeof s.star !== 'object' || s.star === null) return false;
  const star = s.star as Record<string, unknown>;
  if (typeof star.situation !== 'string') return false;
  if (typeof star.task !== 'string') return false;
  if (typeof star.result !== 'string') return false;
  if (!isArrayOfStrings(star.action)) return false;

  // quality
  if (typeof s.quality !== 'object' || s.quality === null) return false;
  const q = s.quality as Record<string, unknown>;
  if (typeof q.situation !== 'string') return false;
  if (typeof q.task !== 'string') return false;
  if (typeof q.action !== 'string') return false;
  if (typeof q.result !== 'string') return false;
  if (typeof q.notes !== 'string') return false;

  // rank: null or integer 1–5
  if (s.rank !== null) {
    if (typeof s.rank !== 'number') return false;
    if (!Number.isInteger(s.rank) || s.rank < 1 || s.rank > 5) return false;
  }

  // createdAt / updatedAt: non-empty string or null
  if (!isNonEmptyStringOrNull(s.createdAt)) return false;
  if (!isNonEmptyStringOrNull(s.updatedAt)) return false;

  return true;
}

function isJobProfile(x: unknown): x is JobProfile {
  if (typeof x !== 'object' || x === null) return false;
  const p = x as Record<string, unknown>;

  // id
  if (!isNonEmptyString(p.id)) return false;
  if (!isBoundedString(p.id, MAX_LEN_STRING)) return false;

  // company, role
  if (typeof p.company !== 'string') return false;
  if (!isBoundedString(p.company, MAX_LEN_STRING)) return false;
  if (typeof p.role !== 'string') return false;
  if (!isBoundedString(p.role, MAX_LEN_STRING)) return false;

  // jobDescription
  if (typeof p.jobDescription !== 'string') return false;
  if (!isBoundedString(p.jobDescription, MAX_LEN_JOB_DESCRIPTION)) return false;

  // extractedCompetencies
  if (!isArrayOfStrings(p.extractedCompetencies)) return false;
  if (p.extractedCompetencies.some((c) => c.length > MAX_LEN_STRING)) return false;

  // competencyMap — object with string-array values; no prototype-pollution keys
  if (typeof p.competencyMap !== 'object' || p.competencyMap === null || Array.isArray(p.competencyMap))
    return false;
  const map = p.competencyMap as Record<string, unknown>;
  for (const key of Object.keys(map)) {
    if (DANGEROUS_KEYS.has(key)) return false;
    if (!isArrayOfStrings(map[key])) return false;
  }

  // createdAt / updatedAt: non-empty strings
  if (!isNonEmptyString(p.createdAt)) return false;
  if (!isBoundedString(p.createdAt, MAX_LEN_STRING)) return false;
  if (!isNonEmptyString(p.updatedAt)) return false;
  if (!isBoundedString(p.updatedAt, MAX_LEN_STRING)) return false;

  // archivedAt: string or null
  if (!isStringOrNull(p.archivedAt)) return false;

  return true;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface BackupBundle {
  version: number;
  exportedAt: string;
  appVersion: string;
  stories: Story[];
  jobProfiles: JobProfile[];
}

export function exportData(): void {
  const bundle: BackupBundle = {
    version: KNOWN_BUNDLE_VERSION,
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

  // Version check — reject bundles from a newer app build
  if (typeof d.version !== 'number') throw new Error('Missing or invalid "version" field.');
  if (d.version > KNOWN_BUNDLE_VERSION)
    throw new Error(
      'This backup was made by a newer version of StarLog. Please update the app to import it.',
    );

  // exportedAt — must be a string that parses to a valid date
  if (typeof d.exportedAt !== 'string' || isNaN(new Date(d.exportedAt).getTime()))
    throw new Error('Missing or invalid "exportedAt" field.');

  if (!Array.isArray(d.stories)) throw new Error('Missing or invalid "stories" field.');
  if (!Array.isArray(d.jobProfiles)) throw new Error('Missing or invalid "jobProfiles" field.');

  // Size caps
  if (d.stories.length > MAX_STORIES)
    throw new Error(
      `Backup contains too many stories (${d.stories.length} > ${MAX_STORIES}).`,
    );
  if (d.jobProfiles.length > MAX_JOB_PROFILES)
    throw new Error(
      `Backup contains too many job profiles (${d.jobProfiles.length} > ${MAX_JOB_PROFILES}).`,
    );

  // Per-field validation for each story
  for (const s of d.stories as unknown[]) {
    if (!isStory(s))
      throw new Error(
        'One or more stories have an invalid or malformed shape. Check all required fields and types.',
      );
  }

  // Per-field validation for each job profile
  for (const p of d.jobProfiles as unknown[]) {
    if (!isJobProfile(p))
      throw new Error(
        'One or more job profiles have an invalid or malformed shape. Check all required fields and types.',
      );
  }

  return data as BackupBundle;
}

export function applyImport(bundle: BackupBundle): void {
  storiesStore.restore(bundle.stories);
  jobProfilesStore.restore(bundle.jobProfiles);
}
