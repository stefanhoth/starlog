import { writable } from 'svelte/store';

export const storageError = writable<string | null>(null);
