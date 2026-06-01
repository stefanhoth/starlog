export interface ChangelogEntry {
  date: string; // "Month YYYY" format
  changes: string[]; // user-facing bullet points
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: 'June 2026',
    changes: [
      'Your data is now stored more reliably — it won\'t disappear if the app closes unexpectedly.',
      'Added story readiness rating so you can track which stories you\'re confident telling.',
      'When mapping stories to job requirements, you can now pick a primary and a backup story for each competency.',
      'You can now edit a job profile after creating it.',
    ],
  },
  {
    date: 'May 2026',
    changes: [
      'Install Starlog as an app on your phone or desktop — works even when you\'re offline.',
      'The Starlog logo now appears in the sidebar and on the welcome screen.',
      'Export and import your data from a dedicated Data page in the sidebar.',
      'Choose which Gemini AI model powers your story improvements in Settings.',
      'A glowing animation now shows while AI is processing so you know it\'s working.',
    ],
  },
  {
    date: 'April 2026',
    changes: [
      'Redesigned the app around your target job — start with a job description and map your best stories to it.',
      'Drag and drop to reorder the steps in your story\'s Action section.',
      'Click any part of a story to edit it inline, with coaching hints to guide you.',
      'Fully usable on mobile with a bottom navigation bar.',
      'Back up and restore all your stories and job profiles as a downloadable file.',
      'AI-generated questions help you recall concrete details when writing a new story.',
    ],
  },
];
