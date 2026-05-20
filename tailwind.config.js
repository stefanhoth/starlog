/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{svelte,ts}'],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        starlog: {
          'primary':           '#4f46e5',
          'primary-content':   '#ffffff',
          'secondary':         '#64748b',
          'secondary-content': '#ffffff',
          'accent':            '#f59e0b',
          'accent-content':    '#000000',
          'neutral':           '#1e293b',
          'neutral-content':   '#f1f5f9',
          'base-100':          '#ffffff',
          'base-200':          '#f8fafc',
          'base-300':          '#e2e8f0',
          'base-content':      '#0f172a',
          'info':              '#3b82f6',
          'info-content':      '#ffffff',
          'success':           '#10b981',
          'success-content':   '#ffffff',
          'warning':           '#f59e0b',
          'warning-content':   '#000000',
          'error':             '#ef4444',
          'error-content':     '#ffffff',
        },
      },
    ],
  },
}
