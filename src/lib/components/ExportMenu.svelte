<script lang="ts">
  import { flushSync } from 'svelte';
  import { downloadMarkdown } from '../markdown';

  interface Props {
    /** Lazily builds the Markdown to export. Called at click time so the caller
     *  can snapshot edited/uncommitted state (e.g. the Story Detail editor). */
    getContent: () => string;
    /** Download filename, e.g. `my-story-star.md`. */
    filename: string;
    /** Disables the trigger — e.g. nothing to export yet. */
    disabled?: boolean;
    /** Tooltip shown on the disabled trigger. */
    disabledTitle?: string;
    /** Trigger button classes (lets callers pick ghost vs outline etc.). */
    triggerClass?: string;
    /** Summary label shown briefly after a successful copy. */
    copiedLabel?: string;
    /** Screen-reader announcement on successful copy. */
    copyOkMessage?: string;
    /** Screen-reader announcement on failed copy. */
    copyErrorMessage?: string;
    /** Prefix for data-testid hooks: `${prefix}-dropdown|btn|copy-btn|download-btn`. */
    testidPrefix?: string;
  }

  let {
    getContent,
    filename,
    disabled = false,
    disabledTitle,
    triggerClass = 'btn btn-ghost btn-sm',
    copiedLabel = 'Copied ✓',
    copyOkMessage = 'Copied to clipboard',
    copyErrorMessage = 'Copy failed — try Download .md instead',
    testidPrefix = 'export',
  }: Props = $props();

  let open       = $state(false);
  let copyStatus = $state<'idle' | 'ok' | 'error'>('idle');
  let copyTimer: ReturnType<typeof setTimeout>;
  let summary: HTMLElement | undefined = $state();

  // While open: outside-click and Escape both close the menu and return focus to
  // the trigger. Native <details> does neither on its own.
  $effect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const details = summary?.closest('details');
      if (details && !details.contains(e.target as Node)) open = false;
    }
    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') { flushSync(() => { open = false; }); summary?.focus(); }
    }
    document.addEventListener('click', onDocClick, { capture: true });
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('click', onDocClick, { capture: true });
      document.removeEventListener('keydown', onKeydown);
    };
  });

  // Clear the status-reset timer on unmount to avoid a stale $state write.
  $effect(() => () => clearTimeout(copyTimer));

  async function handleCopy() {
    open = false;
    summary?.focus();
    clearTimeout(copyTimer);
    try {
      await navigator.clipboard.writeText(getContent());
      copyStatus = 'ok';
    } catch {
      copyStatus = 'error';
    }
    copyTimer = setTimeout(() => { copyStatus = 'idle'; }, 2000);
  }

  function handleDownload() {
    open = false;
    summary?.focus();
    downloadMarkdown(filename, getContent());
  }
</script>

{#if disabled}
  <button class="{triggerClass} shrink-0" disabled title={disabledTitle} data-testid="{testidPrefix}-btn">Export ▾</button>
{:else}
  <details bind:open class="relative shrink-0" data-testid="{testidPrefix}-dropdown">
    <summary bind:this={summary} class="{triggerClass} list-none cursor-pointer" data-testid="{testidPrefix}-btn">
      {#if copyStatus === 'ok'}{copiedLabel}{:else if copyStatus === 'error'}Copy failed{:else}Export ▾{/if}
    </summary>
    <div class="absolute right-0 top-full mt-1 z-10 bg-base-100 border border-base-300 rounded-lg shadow-lg w-48 py-1">
      <button
        class="w-full text-left px-3 py-2.5 text-sm hover:bg-base-200 transition-colors flex items-center gap-2"
        onclick={handleCopy}
        data-testid="{testidPrefix}-copy-btn"
      ><span aria-hidden="true">📋</span> Copy to clipboard</button>
      <button
        class="w-full text-left px-3 py-2.5 text-sm hover:bg-base-200 transition-colors flex items-center gap-2"
        onclick={handleDownload}
        data-testid="{testidPrefix}-download-btn"
      ><span aria-hidden="true">⬇️</span> Download .md</button>
    </div>
  </details>
  <!-- Announces BOTH outcomes to screen readers (the bulk view previously announced success only). -->
  <div aria-live="polite" aria-atomic="true" class="sr-only">
    {#if copyStatus === 'ok'}{copyOkMessage}{:else if copyStatus === 'error'}{copyErrorMessage}{/if}
  </div>
{/if}
