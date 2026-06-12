import { describe, it, expect, vi, afterEach } from 'vitest';
import { canUseLocalLlm } from './ai-capabilities';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canUseLocalLlm', () => {
  it('returns ready when WebGPU and JSPI are both available', () => {
    vi.stubGlobal('navigator', { gpu: {} });
    vi.stubGlobal('WebAssembly', { Suspending: function () {} });
    expect(canUseLocalLlm()).toBe('ready');
  });

  it('returns needs-flag when WebGPU is available but JSPI is absent on a Chromium browser', () => {
    vi.stubGlobal('navigator', { gpu: {}, userAgentData: {} });
    vi.stubGlobal('WebAssembly', {});
    expect(canUseLocalLlm()).toBe('needs-flag');
  });

  it('returns needs-flag when JSPI exists but is not a function on a Chromium browser', () => {
    vi.stubGlobal('navigator', { gpu: {}, userAgentData: {} });
    vi.stubGlobal('WebAssembly', { Suspending: 42 });
    expect(canUseLocalLlm()).toBe('needs-flag');
  });

  it('returns unsupported when WebGPU is present but JSPI is absent on a non-Chromium browser (e.g. Safari)', () => {
    vi.stubGlobal('navigator', { gpu: {} }); // no userAgentData
    vi.stubGlobal('WebAssembly', {});
    expect(canUseLocalLlm()).toBe('unsupported');
  });

  it('returns unsupported when WebGPU is absent', () => {
    vi.stubGlobal('navigator', { userAgentData: {} });
    vi.stubGlobal('WebAssembly', { Suspending: function () {} });
    expect(canUseLocalLlm()).toBe('unsupported');
  });

  it('returns unsupported when both WebGPU and JSPI are absent', () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('WebAssembly', {});
    expect(canUseLocalLlm()).toBe('unsupported');
  });

  it('returns unsupported when navigator is undefined', () => {
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('WebAssembly', { Suspending: function () {} });
    expect(canUseLocalLlm()).toBe('unsupported');
  });

  it('returns needs-flag on Chromium when WebAssembly is undefined (JSPI not available)', () => {
    vi.stubGlobal('navigator', { gpu: {}, userAgentData: {} });
    vi.stubGlobal('WebAssembly', undefined);
    expect(canUseLocalLlm()).toBe('needs-flag');
  });
});
