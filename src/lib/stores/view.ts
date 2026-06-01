import { writable, get } from 'svelte/store';

export type View =
  | 'onboarding'
  | 'add-job'
  | 'job-hub'
  | 'gap-fill'
  | 'story-bank'
  | 'capture'
  | 'review'
  | 'story-detail'
  | 'interview'
  | 'data';

export const currentView = writable<View>('onboarding');
export const activeProfileId = writable<string>('');

interface RouteState {
  view: View;
  profileId?: string;
  storyId?: string;
}

function parseHash(hash: string): RouteState {
  const path = hash.replace(/^#\//, '').replace(/\/$/, '');

  if (!path) return { view: 'onboarding' };
  if (path === 'settings') return { view: 'onboarding' };
  if (path === 'job/new') return { view: 'add-job' };
  if (path === 'stories/capture') return { view: 'capture' };
  if (path === 'stories/review') return { view: 'review' };
  if (path === 'interview') return { view: 'interview' };
  if (path === 'data') return { view: 'data' };
  if (path === 'stories') return { view: 'story-bank' };

  const gapsMatch = path.match(/^job\/([^/]+)\/gaps$/);
  if (gapsMatch) return { view: 'gap-fill', profileId: gapsMatch[1] };

  const jobMatch = path.match(/^job\/([^/]+)$/);
  if (jobMatch) return { view: 'job-hub', profileId: jobMatch[1] };

  const storyMatch = path.match(/^stories\/([^/]+)$/);
  if (storyMatch) return { view: 'story-detail', storyId: storyMatch[1] };

  return { view: 'onboarding' };
}

function viewToHash(view: View, profileId?: string, storyId?: string): string {
  switch (view) {
    case 'onboarding':        return '#/settings';
    case 'add-job':           return '#/job/new';
    case 'job-hub':            return profileId ? `#/job/${profileId}` : '#/';
    case 'gap-fill':          return profileId ? `#/job/${profileId}/gaps` : '#/';
    case 'story-bank':        return '#/stories';
    case 'capture':           return '#/stories/capture';
    case 'review':            return '#/stories/review';
    case 'story-detail':      return storyId ? `#/stories/${storyId}` : '#/stories';
    case 'interview':         return '#/interview';
    case 'data':              return '#/data';
    default:                  return '#/';
  }
}

function applyRoute(state: RouteState) {
  if (state.profileId) {
    sessionStorage.setItem('starlog_active_profile', state.profileId);
    activeProfileId.set(state.profileId);
  }
  if (state.storyId) {
    sessionStorage.setItem('starlog_active_story', state.storyId);
  }
  currentView.set(state.view);
}

// Initialise from current URL on module load
applyRoute(parseHash(window.location.hash));

// Sync browser back / forward to store
window.addEventListener('popstate', () => {
  applyRoute(parseHash(window.location.hash));
});

/** Navigate to a view, updating the browser URL. */
export function navigate(view: View) {
  const pid = get(activeProfileId) || undefined;
  const hash = viewToHash(view, pid);
  // review and interview are transient — don't pollute the back stack
  const replace = view === 'review' || view === 'interview';
  if (replace) {
    history.replaceState(null, '', hash);
  } else {
    history.pushState(null, '', hash);
  }
  currentView.set(view);
}

/** Navigate to a job hub view, encoding the profile ID in the URL. */
export function openJob(id: string) {
  sessionStorage.setItem('starlog_active_profile', id);
  activeProfileId.set(id);
  history.pushState(null, '', `#/job/${id}`);
  currentView.set('job-hub');
}

/** Navigate to a story detail view, encoding the story ID in the URL. */
export function openStory(id: string) {
  sessionStorage.setItem('starlog_active_story', id);
  history.pushState(null, '', `#/stories/${id}`);
  currentView.set('story-detail');
}
