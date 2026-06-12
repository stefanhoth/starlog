import { describe, it, expect } from 'vitest';
import { parseBackupJson, KNOWN_BUNDLE_VERSION } from './backup';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_STORY = {
  id: 's1',
  title: 'Led a migration',
  original_language: 'en',
  competency_tags: ['Leadership'],
  star: { situation: 'S', task: 'T', action: ['A1', 'A2'], result: 'R' },
  quality: { situation: 'high', task: 'medium', action: 'low', result: 'high', notes: '' },
  notes: '',
  rank: 3,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
};

const VALID_JOB_PROFILE = {
  id: 'p1',
  company: 'Acme',
  role: 'Engineering Manager',
  jobDescription: 'Lead a team.',
  extractedCompetencies: ['Leadership'],
  competencyMap: { Leadership: ['s1'] },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
  archivedAt: null,
};

function validBundle(overrides: Record<string, unknown> = {}) {
  return {
    version: KNOWN_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: '0.0.0',
    stories: [VALID_STORY],
    jobProfiles: [VALID_JOB_PROFILE],
    ...overrides,
  };
}

const ok = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify(validBundle(overrides));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('parseBackupJson', () => {
  // Happy path
  it('accepts a valid bundle and returns a BackupBundle', () => {
    const result = parseBackupJson(ok());
    expect(result.stories).toHaveLength(1);
    expect(result.jobProfiles).toHaveLength(1);
    expect(result.version).toBe(KNOWN_BUNDLE_VERSION);
  });

  it('accepts a bundle with version older than current', () => {
    expect(() => parseBackupJson(ok({ version: 0 }))).not.toThrow();
  });

  it('accepts a story with rank: null', () => {
    expect(() => parseBackupJson(ok({ stories: [{ ...VALID_STORY, rank: null }] }))).not.toThrow();
  });

  it('accepts 10 000 stories exactly', () => {
    const manyStories = Array.from({ length: 10_000 }, (_, i) => ({ ...VALID_STORY, id: `s${i}` }));
    expect(() => parseBackupJson(ok({ stories: manyStories }))).not.toThrow();
  });

  // Top-level structure
  it('rejects non-JSON input', () => {
    expect(() => parseBackupJson('not json')).toThrow('not valid JSON');
  });

  it('rejects a JSON null', () => {
    expect(() => parseBackupJson('null')).toThrow('Invalid backup file');
  });

  it('rejects a JSON array', () => {
    expect(() => parseBackupJson('[]')).toThrow('Invalid backup file');
  });

  // Version field
  it('rejects a bundle from a newer app version', () => {
    expect(() => parseBackupJson(ok({ version: KNOWN_BUNDLE_VERSION + 1 }))).toThrow(
      'newer version of StarLog',
    );
  });

  it('rejects when version field is missing', () => {
    const bundle = validBundle();
    delete (bundle as Record<string, unknown>).version;
    expect(() => parseBackupJson(JSON.stringify(bundle))).toThrow('"version"');
  });

  it('rejects a string version field', () => {
    expect(() => parseBackupJson(ok({ version: '1' }))).toThrow('"version"');
  });

  // exportedAt field
  it('rejects when exportedAt is missing', () => {
    const bundle = validBundle();
    delete (bundle as Record<string, unknown>).exportedAt;
    expect(() => parseBackupJson(JSON.stringify(bundle))).toThrow('exportedAt');
  });

  it('rejects an invalid exportedAt date string', () => {
    expect(() => parseBackupJson(ok({ exportedAt: 'not-a-date' }))).toThrow('exportedAt');
  });

  // stories / jobProfiles arrays
  it('rejects when stories field is missing', () => {
    const bundle = validBundle();
    delete (bundle as Record<string, unknown>).stories;
    expect(() => parseBackupJson(JSON.stringify(bundle))).toThrow('"stories"');
  });

  it('rejects when jobProfiles field is missing', () => {
    const bundle = validBundle();
    delete (bundle as Record<string, unknown>).jobProfiles;
    expect(() => parseBackupJson(JSON.stringify(bundle))).toThrow('"jobProfiles"');
  });

  // Size caps
  it('rejects stories array exceeding 10 000', () => {
    const manyStories = Array.from({ length: 10_001 }, (_, i) => ({ ...VALID_STORY, id: `s${i}` }));
    expect(() => parseBackupJson(ok({ stories: manyStories }))).toThrow('too many stories');
  });

  it('rejects jobProfiles array exceeding 1 000', () => {
    const manyProfiles = Array.from({ length: 1_001 }, (_, i) => ({ ...VALID_JOB_PROFILE, id: `p${i}` }));
    expect(() => parseBackupJson(ok({ jobProfiles: manyProfiles }))).toThrow('too many job profiles');
  });

  // Story validation
  it('rejects a story missing a required field (title)', () => {
    const bad = { ...VALID_STORY };
    delete (bad as Record<string, unknown>).title;
    expect(() => parseBackupJson(ok({ stories: [bad] }))).toThrow('invalid or malformed shape');
  });

  it('rejects a story with star: null', () => {
    expect(() =>
      parseBackupJson(ok({ stories: [{ ...VALID_STORY, star: null }] })),
    ).toThrow('invalid or malformed shape');
  });

  it('rejects a story with rank as a string', () => {
    expect(() =>
      parseBackupJson(ok({ stories: [{ ...VALID_STORY, rank: '999' }] })),
    ).toThrow('invalid or malformed shape');
  });

  it('rejects a story with rank out of range (6)', () => {
    expect(() =>
      parseBackupJson(ok({ stories: [{ ...VALID_STORY, rank: 6 }] })),
    ).toThrow('invalid or malformed shape');
  });

  it('rejects a story with a title exceeding 500 chars', () => {
    expect(() =>
      parseBackupJson(ok({ stories: [{ ...VALID_STORY, title: 'A'.repeat(501) }] })),
    ).toThrow('invalid or malformed shape');
  });

  it('rejects a story with non-array action in star', () => {
    expect(() =>
      parseBackupJson(
        ok({ stories: [{ ...VALID_STORY, star: { ...VALID_STORY.star, action: 'not an array' } }] }),
      ),
    ).toThrow('invalid or malformed shape');
  });

  it('rejects a story with quality: null', () => {
    expect(() =>
      parseBackupJson(ok({ stories: [{ ...VALID_STORY, quality: null }] })),
    ).toThrow('invalid or malformed shape');
  });

  // JobProfile validation
  it('rejects a jobDescription exceeding 100 000 chars', () => {
    expect(() =>
      parseBackupJson(
        ok({ jobProfiles: [{ ...VALID_JOB_PROFILE, jobDescription: 'A'.repeat(100_001) }] }),
      ),
    ).toThrow('invalid or malformed shape');
  });

  it('rejects a job profile with __proto__ key in competencyMap', () => {
    const rawBundle = `{
      "version": ${KNOWN_BUNDLE_VERSION},
      "exportedAt": "${new Date().toISOString()}",
      "appVersion": "0.0.0",
      "stories": [${JSON.stringify(VALID_STORY)}],
      "jobProfiles": [{
        "id": "p1", "company": "Acme", "role": "EM", "jobDescription": "",
        "extractedCompetencies": [], "competencyMap": {"__proto__": ["s1"]},
        "createdAt": "2024-01-01T00:00:00.000Z", "updatedAt": "2024-01-01T00:00:00.000Z",
        "archivedAt": null
      }]
    }`;
    expect(() => parseBackupJson(rawBundle)).toThrow('invalid or malformed shape');
  });

  it('rejects a job profile with constructor key in competencyMap', () => {
    const rawBundle = `{
      "version": ${KNOWN_BUNDLE_VERSION},
      "exportedAt": "${new Date().toISOString()}",
      "appVersion": "0.0.0",
      "stories": [${JSON.stringify(VALID_STORY)}],
      "jobProfiles": [{
        "id": "p1", "company": "Acme", "role": "EM", "jobDescription": "",
        "extractedCompetencies": [], "competencyMap": {"constructor": ["s1"]},
        "createdAt": "2024-01-01T00:00:00.000Z", "updatedAt": "2024-01-01T00:00:00.000Z",
        "archivedAt": null
      }]
    }`;
    expect(() => parseBackupJson(rawBundle)).toThrow('invalid or malformed shape');
  });
});
