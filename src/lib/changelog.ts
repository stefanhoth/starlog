export interface ChangelogEntry {
  date: string; // "June 2026" format
  changes: string[]; // user-facing bullet points
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: 'June 2026',
    changes: [
      'Your data is now stored more reliably — it won\'t disappear if the app closes unexpectedly.',
      'Added story readiness rating so you can track which stories you\'re confident telling.',
    ],
  },
];
