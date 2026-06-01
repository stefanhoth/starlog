import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// Request durable storage so the OS doesn't evict localStorage under memory
// pressure (critical for installed PWAs on iOS/Android).
navigator.storage?.persist?.();

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
