export interface ChangelogItem {
  title: string;
  detail: string;
}

export interface ChangelogEntry {
  date: string;
  changes: ChangelogItem[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: 'June 2026',
    changes: [
      {
        title: 'Your data survives app crashes',
        detail: 'No more losing everything after the app closes unexpectedly — stories and job profiles are now stored in a crash-resistant format that the OS can\'t silently wipe.',
      },
      {
        title: 'Rate how confident you are telling each story',
        detail: 'Now you can mark stories as "not ready", "shaky", "ok", "confident", or "nailed it" — so your story bank shows you where to focus your practice next.',
      },
      {
        title: 'Primary and backup story per job requirement',
        detail: 'When mapping stories to a job\'s competencies, you can now pick one story as your main answer and a second as a fallback — so you\'re never caught off guard in the interview.',
      },
      {
        title: 'Edit a job profile after creating it',
        detail: 'Previously the job description and extracted competencies were locked once saved. Now you can update them at any time without starting over.',
      },
    ],
  },
  {
    date: 'May 2026',
    changes: [
      {
        title: 'Install Starlog as an app',
        detail: 'You can now add Starlog to your home screen or desktop and launch it like any other app — no browser tab needed. It even works offline.',
      },
      {
        title: 'Export and import your data',
        detail: 'Back up all your stories and job profiles to a file with one click — and restore them just as easily. Your data, fully in your hands.',
      },
      {
        title: 'Choose your AI model',
        detail: 'If you have access to multiple Gemini models, you can now pick which one powers your story improvements in Settings.',
      },
      {
        title: 'See when AI is working',
        detail: 'A pulsing glow now appears around the screen while Gemini is processing, so you always know when the app is thinking and when it\'s ready.',
      },
    ],
  },
  {
    date: 'April 2026',
    changes: [
      {
        title: 'App redesigned around your target job',
        detail: 'Instead of a generic story list, the app now starts with your job description — paste it in, and Starlog maps your stories to what that specific employer is actually looking for.',
      },
      {
        title: 'Drag to reorder your action steps',
        detail: 'Telling your story in the right order matters. Now you can drag the steps in the Action section to get them exactly right without retyping.',
      },
      {
        title: 'Click any section to edit it in place',
        detail: 'No more separate edit screens — just click the part of your story you want to change and start typing. Coaching hints appear automatically to guide you.',
      },
      {
        title: 'Works on your phone',
        detail: 'The app is now fully usable on mobile — swipe between stories, navigate with the bottom bar, and practise on the go.',
      },
      {
        title: 'Download a full backup of your data',
        detail: 'All your stories and job profiles can be exported as a single file and imported back — useful before clearing your browser or switching devices.',
      },
      {
        title: 'AI questions to spark better stories',
        detail: 'When writing a new story, AI-generated questions help you remember the concrete details — the numbers, the names, the stakes — that make an answer land.',
      },
    ],
  },
];
