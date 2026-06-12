import type { LocalLlmState } from './types';

/**
 * Detects local LLM support via runtime capability probes.
 * Never reads navigator.userAgent — browsers auto-upgrade as they ship the required APIs.
 *
 * 'ready'       — WebGPU + JSPI both available; local mode fully functional.
 * 'needs-flag'  — WebGPU present, JSPI absent, Chromium-based browser (flag is actionable).
 * 'unsupported' — WebGPU absent, or non-Chromium browser where JSPI is not flag-gatable.
 */
export function canUseLocalLlm(): LocalLlmState {
  const webGpuAvailable = typeof navigator !== 'undefined' && navigator.gpu != null;
  const jspiAvailable =
    typeof WebAssembly !== 'undefined' &&
    typeof (WebAssembly as Record<string, unknown>).Suspending === 'function';

  if (webGpuAvailable && jspiAvailable) return 'ready';

  // JSPI is only flag-gatable in Chromium-based browsers (Chrome, Edge, Opera).
  // Safari ships WebGPU but doesn't support JSPI and has no flag for it.
  // navigator.userAgentData (UA Client Hints) is a Chromium-only structured API —
  // checking its presence distinguishes Chromium from Safari/Firefox without reading UA strings.
  const isChromiumLike =
    typeof navigator !== 'undefined' &&
    (navigator as unknown as Record<string, unknown>).userAgentData != null;
  if (webGpuAvailable && isChromiumLike) return 'needs-flag';
  return 'unsupported';
}
