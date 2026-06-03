import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { initStores } from './lib/stores/init'
import { deferredInstallPrompt, type BeforeInstallPromptEvent } from './lib/stores/pwaInstall'

// Request durable storage so the OS doesn't evict the IndexedDB database
// under memory pressure (critical for installed PWAs on iOS/Android).
navigator.storage?.persist?.();

// Capture the install prompt before the browser fires it — must happen synchronously.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt.set(e as BeforeInstallPromptEvent);
});

initStores().then(() => {
  mount(App, {
    target: document.getElementById('app')!,
  });
});
