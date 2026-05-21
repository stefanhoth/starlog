import { writable } from 'svelte/store';

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
  // legacy — kept for backward compat with tests
  | 'library'
  | 'job-profiles'
  | 'job-profile-detail';

export const currentView = writable<View>('onboarding');

export const activeProfileId = writable<string>(
  typeof sessionStorage !== 'undefined'
    ? (sessionStorage.getItem('starlog_active_profile') ?? '')
    : ''
);

export function navigate(view: View) {
  currentView.set(view);
}

export function openJob(id: string) {
  sessionStorage.setItem('starlog_active_profile', id);
  activeProfileId.set(id);
  currentView.set('job-hub');
}
