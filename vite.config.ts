import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [svelte()],
  base: command === 'build' ? '/starlog/' : '/',
}))
