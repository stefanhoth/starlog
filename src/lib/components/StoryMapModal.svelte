<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { storiesStore } from '../stores/stories';
  import type { Story } from '../types';
  import StarReadView from './StarReadView.svelte';

  let {
    comp,
    initialIds,
    onSave,
    onCancel,
    triggerEl = null,
  }: {
    comp: string;
    initialIds: string[];
    onSave: (ids: string[]) => void;
    onCancel: () => void;
    triggerEl?: HTMLElement | null;
  } = $props();

  let search = $state('');
  let selected = $state<string[]>(untrack(() => [...initialIds]));
  let expandedStoryId = $state<string | null>(null);
  let searchInputEl = $state<HTMLInputElement | null>(null);

  onMount(() => {
    searchInputEl?.focus();
  });

  const filtered = $derived(
    $storiesStore.filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.competency_tags.some(t => t.toLowerCase().includes(q))
      );
    })
  );

  function add(id: string) {
    if (!selected.includes(id)) selected = [...selected, id];
  }

  function remove(index: number) {
    selected = selected.filter((_, i) => i !== index);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...selected];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    selected = next;
  }

  function storyById(id: string): Story | undefined {
    return $storiesStore.find(s => s.id === id);
  }

  function excerpt(text: string, max = 80): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  function rankDots(rank: number | null): string {
    if (rank === null) return '○○○○○';
    return '●'.repeat(rank) + '○'.repeat(5 - rank);
  }

  function handleCancel() {
    triggerEl?.focus();
    onCancel();
  }

  function handleSave(ids: string[]) {
    triggerEl?.focus();
    onSave(ids);
  }

  $effect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
  role="dialog"
  aria-modal="true"
  aria-label="Map stories to competency"
  tabindex="-1"
  data-testid="story-map-modal"
  onclick={(e) => e.target === e.currentTarget && handleCancel()}
  onkeydown={(e) => e.target === e.currentTarget && e.key === 'Escape' && handleCancel()}
>
  <div class="bg-base-100 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">

    <!-- Header -->
    <div class="px-6 pt-5 pb-4 border-b border-base-200 shrink-0">
      <h3 class="font-semibold text-base">
        Map stories to <em class="not-italic text-primary">{comp}</em>
      </h3>
    </div>

    <!-- Body: two columns -->
    <div class="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">

      <!-- Left: Story Library -->
      <div
        class="flex flex-col flex-1 min-h-0 border-b lg:border-b-0 lg:border-r border-base-200"
        data-testid="story-library-panel"
      >
        <div class="px-4 pt-4 pb-3 shrink-0">
          <p class="text-xs font-semibold uppercase tracking-wider text-base-content/40 mb-2">
            Story Library
          </p>
          <input
            type="text"
            class="input input-sm input-bordered w-full"
            placeholder="Search by title or tag…"
            bind:value={search}
            bind:this={searchInputEl}
            data-testid="story-search"
          />
        </div>

        <div class="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
          {#if $storiesStore.length === 0}
            <p class="text-sm text-base-content/40 py-8 text-center">No stories in library yet.</p>
          {:else if filtered.length === 0}
            <p class="text-sm text-base-content/40 py-8 text-center">No stories match your search.</p>
          {:else}
            {#each filtered as story (story.id)}
              {@const isAdded = selected.includes(story.id)}
              {@const isExpanded = expandedStoryId === story.id}
              <div
                class="rounded-xl border p-3 transition-colors
                  {isAdded
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-base-200 bg-base-100 hover:bg-base-200/50'}"
                data-testid="library-story-card"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <button
                        class="text-base-content/40 hover:text-base-content/70 transition-colors text-xs shrink-0"
                        aria-expanded={isExpanded}
                        aria-controls="star-expand-{story.id}"
                        data-testid="expand-story-{story.id}"
                        onclick={() => expandedStoryId = isExpanded ? null : story.id}
                        title={isExpanded ? 'Collapse' : 'Expand STAR'}
                      >{isExpanded ? '▾' : '▸'}</button>
                      <p class="text-sm font-medium leading-snug">{story.title}</p>
                    </div>
                    {#if story.star.situation && !isExpanded}
                      <p class="text-xs text-base-content/50 mt-1 leading-relaxed">
                        {excerpt(story.star.situation)}
                      </p>
                    {/if}
                    <div class="flex items-center gap-2 mt-2 flex-wrap">
                      <span class="text-xs text-warning/70 tracking-tight font-mono" title="Readiness {story.rank ?? '–'}/5">
                        {rankDots(story.rank)}
                      </span>
                      {#each story.competency_tags as tag}
                        <span class="badge badge-xs badge-ghost">{tag}</span>
                      {/each}
                    </div>
                  </div>
                  {#if isAdded}
                    <span class="text-xs text-primary/60 shrink-0 pt-0.5 font-medium whitespace-nowrap">
                      ✓ added
                    </span>
                  {:else}
                    <button
                      class="btn btn-xs btn-primary btn-outline shrink-0"
                      onclick={() => add(story.id)}
                      data-testid="story-add-btn"
                    >
                      + add
                    </button>
                  {/if}
                </div>
                {#if isExpanded}
                  <div id="star-expand-{story.id}" class="mt-3 pt-3 border-t border-base-300">
                    <StarReadView star={story.star} />
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Right: Selected / ranking panel -->
      <div
        class="flex flex-col w-full lg:w-72 shrink-0 min-h-0"
        data-testid="story-selection-panel"
      >
        <div class="px-4 pt-4 pb-3 shrink-0">
          <p class="text-xs font-semibold uppercase tracking-wider text-base-content/40">
            Selected · {selected.length}
          </p>
        </div>

        <div class="flex flex-col gap-2 overflow-y-auto px-4 pb-4 flex-1">
          {#if selected.length === 0}
            <div class="flex flex-col items-center justify-center gap-2 py-8 text-base-content/30 text-center">
              <span class="text-4xl">←</span>
              <p class="text-xs leading-relaxed px-4">
                Add stories from the library.<br/>
                The first one becomes your <strong>primary answer</strong>.
              </p>
            </div>
          {:else}
            {#each selected as id, i}
              {@const story = storyById(id)}
              {#if story}
                <div
                  class="rounded-xl border p-3
                    {i === 0
                      ? 'border-primary bg-primary/5'
                      : 'border-base-200'}"
                  data-testid="selected-story-card"
                >
                  <div class="flex items-center justify-between gap-1 mb-1.5">
                    {#if i === 0}
                      <span class="text-xs font-bold text-primary uppercase tracking-wide">
                        ★ Primary
                      </span>
                    {:else}
                      <span class="text-xs text-base-content/40 font-medium">
                        #{i + 1} Backup
                      </span>
                    {/if}
                    <div class="flex items-center gap-0.5">
                      {#if i > 0}
                        <button
                          class="btn btn-ghost btn-xs px-1 h-6 min-h-0 text-base leading-none"
                          onclick={() => moveUp(i)}
                          title="Promote to primary"
                          data-testid="story-move-up-btn"
                        >
                          ↑
                        </button>
                      {/if}
                      <button
                        class="btn btn-ghost btn-xs px-1 h-6 min-h-0 text-error/50 leading-none"
                        onclick={() => remove(i)}
                        title="Remove"
                        data-testid="story-remove-btn"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p class="text-xs font-medium leading-snug">{story.title}</p>
                </div>
              {/if}
            {/each}
          {/if}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="px-6 py-4 border-t border-base-200 shrink-0 flex justify-end gap-2">
      <button class="btn btn-ghost btn-sm" onclick={handleCancel}>Cancel</button>
      <button
        class="btn btn-primary btn-sm"
        onclick={() => handleSave(selected)}
        data-testid="story-map-save-btn"
      >
        Save →
      </button>
    </div>
  </div>
</div>
