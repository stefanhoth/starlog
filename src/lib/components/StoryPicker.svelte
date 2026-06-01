<script lang="ts">
  import { storiesStore } from '../stores/stories';
  import type { Story } from '../types';

  let {
    selectedIds,
    onchange,
  }: {
    selectedIds: string[];
    onchange: (ids: string[]) => void;
  } = $props();

  function toggle(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];
    onchange(next);
  }
</script>

<div class="flex flex-col gap-2 max-h-64 overflow-y-auto" data-testid="story-picker">
  {#if $storiesStore.length === 0}
    <p class="text-sm text-base-content/40 p-2">No stories in library yet.</p>
  {:else}
    {#each $storiesStore as story (story.id)}
      <label class="flex items-center gap-3 p-2 rounded hover:bg-base-200 cursor-pointer">
        <input
          type="checkbox"
          class="checkbox checkbox-sm"
          checked={selectedIds.includes(story.id)}
          onchange={() => toggle(story.id)}
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2">
            <p class="text-sm font-medium truncate">{story.title}</p>
            {#if story.rank !== null}
              <span class="text-xs text-indigo-400 shrink-0">★ {story.rank}/5</span>
            {:else}
              <span class="text-xs text-base-content/25 shrink-0 italic">Not rated</span>
            {/if}
          </div>
          <div class="flex flex-wrap gap-1 mt-0.5">
            {#each story.competency_tags as tag}
              <span class="badge badge-xs badge-ghost">{tag}</span>
            {/each}
          </div>
        </div>
      </label>
    {/each}
  {/if}
</div>
