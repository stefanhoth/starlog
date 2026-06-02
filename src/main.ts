import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { initStores } from './lib/stores/init'
import { storageNotPersisted } from './lib/stores/storageWarning'

// Request durable storage so the OS doesn't evict the IndexedDB database
// under memory pressure (critical for installed PWAs on iOS/Android).
navigator.storage?.persist?.();
navigator.storage?.persisted?.().then(persisted => {
  if (!persisted) storageNotPersisted.set(true);
});

initStores().then(() => {
  mount(App, {
    target: document.getElementById('app')!,
  });
});
