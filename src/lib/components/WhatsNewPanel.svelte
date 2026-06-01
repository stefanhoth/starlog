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

<div data-testid="whats-new-panel" class="fixed inset-y-0 right-0 z-50 w-80 bg-base-100 shadow-xl flex flex-col">
  <div class="flex items-center justify-between p-4 border-b border-base-300">
    <h2 class="font-semibold text-lg">What's New</h2>
    <button class="btn btn-sm btn-ghost" onclick={onClose}>✕</button>
  </div>
  <div class="flex-1 overflow-y-auto p-4 space-y-6">
    {#each visibleEntries as entry}
      <div>
        <h3 class="font-medium text-base-content/60 text-sm mb-2">{entry.date}</h3>
        <ul class="space-y-1">
          {#each entry.changes as change}
            <li class="text-sm flex gap-2"><span class="mt-0.5 text-primary">•</span><span>{change}</span></li>
          {/each}
        </ul>
      </div>
    {/each}
    {#if hasMore}
      <button class="btn btn-sm btn-ghost w-full" onclick={() => visibleCount += 3}>Show more</button>
    {/if}
  </div>
</div>
<div class="fixed inset-0 z-40 bg-black/20" onclick={onClose}></div>
