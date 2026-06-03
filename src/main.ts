import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { initStores } from './lib/stores/init'
import { storageNotPersisted } from './lib/stores/storageWarning'
import { deferredInstallPrompt } from './lib/stores/pwaInstall'

// Capture the PWA install prompt so the app can surface it at the right time.
window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  deferredInstallPrompt.set(e);
});

// Request durable storage so the OS doesn't evict the IndexedDB database
// under memory pressure (critical for installed PWAs on iOS/Android).
navigator.storage?.persist?.();
navigator.storage?.persisted?.().then(persisted => {
  if (!persisted && !navigator.webdriver) storageNotPersisted.set(true);
});

initStores().then(() => {
  mount(App, {
    target: document.getElementById('app')!,
  });
});
