import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { initStores } from './lib/stores/init'
// Request durable storage so the OS doesn't evict the IndexedDB database
// under memory pressure (critical for installed PWAs on iOS/Android).
navigator.storage?.persist?.();

initStores().then(() => {
  mount(App, {
    target: document.getElementById('app')!,
  });
});
