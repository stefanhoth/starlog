import type { LocalLlmState } from './types';

/**
 * Detects local LLM support via runtime capability probes.
 * Never reads navigator.userAgent — browsers auto-upgrade as they ship the required APIs.
 *
 * 'ready'       — WebGPU + JSPI both available; local mode fully functional.
 * 'needs-flag'  — WebGPU present but JSPI absent; Chrome/Edge may have it behind a flag.
 * 'unsupported' — WebGPU absent; local mode not possible in this browser.
 */
export function canUseLocalLlm(): LocalLlmState {
  const webGpuAvailable = typeof navigator !== 'undefined' && navigator.gpu != null;
  const jspiAvailable =
    typeof WebAssembly !== 'undefined' &&
    typeof (WebAssembly as Record<string, unknown>).Suspending === 'function';

  if (webGpuAvailable && jspiAvailable) return 'ready';
  if (webGpuAvailable) return 'needs-flag';
  return 'unsupported';
}
