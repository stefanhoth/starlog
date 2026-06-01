<script lang="ts">
  import { CHANGELOG } from '../changelog';
  import { markSeen } from '../stores/whatsNew';
  import { onMount } from 'svelte';

  let { onClose }: { onClose: () => void } = $props();

  let visibleCount = $state(3);

  onMount(async () => {
    if (CHANGELOG.length > 0) {
      await markSeen(CHANGELOG[0].date);
    }
  });

  const visibleEntries = $derived(CHANGELOG.slice(0, visibleCount));
  const hasMore = $derived(visibleCount < CHANGELOG.length);
</script>

<div data-testid="whats-new-panel" class="fixed inset-y-0 right-0 z-50 w-96 bg-base-100 shadow-xl flex flex-col">
  <div class="flex items-center justify-between p-4 border-b border-base-300">
    <h2 class="font-semibold text-lg">What's New</h2>
    <button class="btn btn-sm btn-ghost" onclick={onClose}>✕</button>
  </div>
  <div class="flex-1 overflow-y-auto p-4 space-y-8">
    {#each visibleEntries as entry}
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wider text-base-content/40 mb-3">{entry.date}</h3>
        <ul class="space-y-4">
          {#each entry.changes as item}
            <li class="flex gap-3">
              <span class="text-sm text-primary shrink-0 leading-none mt-[3px]">•</span>
              <div>
                <p class="text-sm font-medium text-base-content leading-snug">{item.title}</p>
                <p class="text-xs text-base-content/55 mt-0.5 leading-relaxed">{item.detail}</p>
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
    {#if hasMore}
      <button class="btn btn-sm btn-ghost w-full" onclick={() => visibleCount += 3}>Show older</button>
    {/if}
  </div>
</div>
<div class="fixed inset-0 z-40 bg-black/20" onclick={onClose}></div>
