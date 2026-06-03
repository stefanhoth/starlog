import { writable } from 'svelte/store';

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const deferredInstallPrompt = writable<BeforeInstallPromptEvent | null>(null);
