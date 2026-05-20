import { writable } from 'svelte/store';

export type View = 'onboarding' | 'library' | 'capture' | 'review' | 'story-detail' | 'job-profiles' | 'job-profile-detail' | 'interview';

export const currentView = writable<View>('onboarding');

export function navigate(view: View) {
  currentView.set(view);
}
