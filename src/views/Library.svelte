<script lang="ts">
  import { storiesStore } from '../lib/stores/stories';
  import { navigate } from '../lib/stores/view';
  import StoryCard from '../lib/components/StoryCard.svelte';
  import { COMPETENCIES } from '../lib/competencies';

  let search = $state('');
  let selectedTags = $state<string[]>([]);
  let activeStoryId = $state<string | null>(null);

  const filtered = $derived(
    $storiesStore.filter(s => {
      if (selectedTags.length > 0 && !selectedTags.some(t => s.competency_tags.includes(t))) return false;
      if (search.length >= 2) {
        const q = search.toLowerCase();
        const hay = [s.title, s.star.situation, s.star.task, s.star.result, ...s.star.action].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
  );

  function toggleTag(tag: string) {
    selectedTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
  }

  function openStory(id: string) {
    activeStoryId = id;
    navigate('story-detail');
    // Store selected id for detail view
    sessionStorage.setItem('starlog_active_story', id);
  }

  function startInterview() {
    sessionStorage.setItem('starlog_interview_mode', 'library');
    navigate('interview');
  }
</script>

<div class="p-6" data-testid="library-view">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-2xl font-bold">Stories</h1>
    <div class="flex gap-2">
      {#if $storiesStore.length > 0}
        <button class="btn btn-outline btn-sm" onclick={startInterview} data-testid="interview-btn">🎤 Interview</button>
      {/if}
      <button class="btn btn-primary btn-sm" onclick={() => navigate('capture')}>+ New Story</button>
    </div>
  </div>

  <!-- Search + Filter -->
  <div class="flex flex-wrap gap-2 mb-4">
    <input
      type="search"
      class="input input-bordered input-sm flex-1 min-w-48"
      placeholder="Search stories…"
      bind:value={search}
      data-testid="search-input"
    />
  </div>
  <div class="flex flex-wrap gap-1 mb-4" data-testid="tag-filter">
    {#each COMPETENCIES as tag}
      <button
        class="badge badge-sm cursor-pointer {selectedTags.includes(tag) ? 'badge-primary' : 'badge-ghost'}"
        onclick={() => toggleTag(tag)}
        data-testid="filter-tag-{tag.toLowerCase().replace(/\W+/g, '-')}"
      >{tag}</button>
    {/each}
    {#if selectedTags.length > 0}
      <button class="badge badge-sm badge-ghost text-error" onclick={() => selectedTags = []}>
        Clear
      </button>
    {/if}
  </div>

  <!-- Quality legend -->
  {#if $storiesStore.length > 0}
    <p class="text-xs text-slate-400 mb-3">
      AI quality:
      <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 mx-1 align-middle"></span>Strong&ensp;
      <span class="inline-block w-2 h-2 rounded-full bg-amber-400 mx-1 align-middle"></span>Room to improve&ensp;
      <span class="inline-block w-2 h-2 rounded-full bg-red-400 mx-1 align-middle"></span>Needs work
    </p>
  {/if}

  <!-- Card Grid -->
  {#if $storiesStore.length === 0}
    <div class="flex flex-col items-center justify-center gap-4 py-24 text-base-content/40" data-testid="empty-state">
      <span class="text-5xl">📚</span>
      <p class="text-lg font-medium">No stories yet</p>
      <button class="btn btn-primary" onclick={() => navigate('capture')}>Capture your first story</button>
    </div>
  {:else if filtered.length === 0}
    <div class="text-center py-16 text-base-content/40" data-testid="no-results">
      No stories match your filter.
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="story-grid">
      {#each filtered as story (story.id)}
        <StoryCard {story} onclick={() => openStory(story.id)} />
      {/each}
    </div>
  {/if}
</div>
