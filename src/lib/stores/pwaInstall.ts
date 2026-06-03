import { writable } from 'svelte/store';

// Holds the deferred `beforeinstallprompt` event so it can be triggered later.
// `null` means the event hasn't fired (e.g. iOS/Safari, already installed, or
// the prompt has already been used).
export const deferredInstallPrompt = writable<Event | null>(null);
