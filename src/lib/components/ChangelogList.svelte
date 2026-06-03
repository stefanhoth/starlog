<script lang="ts">
  import { untrack } from 'svelte';
  import type { ChangelogEntry } from '../changelog';

  let {
    entries,
    initialVisible = 1,
  }: {
    entries: ChangelogEntry[];
    initialVisible?: number;
  } = $props();

  let visibleCount = $state(untrack(() => initialVisible));

  const visibleEntries = $derived(entries.slice(0, visibleCount));
  const hasMore = $derived(visibleCount < entries.length);
</script>

<div class="space-y-8">
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
