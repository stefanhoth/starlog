<script lang="ts">
  import { storiesStore } from '../lib/stores/stories';
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { navigate, openStory } from '../lib/stores/view';
  import type { Story } from '../lib/types';

  let search = $state('');
  let sortByReadiness = $state(true); // default: least-ready first
  let popoverStoryId = $state<string | null>(null);

  // null rank sorts first (needs attention), then rank 1..5
  function readinessSortKey(s: Story): number {
    return s.rank === null ? -1 : s.rank;
  }

  const filtered = $derived(
    $storiesStore
      .filter(s => {
        if (search.length < 2) return true;
        const q = search.toLowerCase();
        return [s.title, ...s.competency_tags, s.star.situation, s.star.result]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => sortByReadiness ? readinessSortKey(a) - readinessSortKey(b) : 0)
  );

  function getJobMappings(story: Story) {
    return $jobProfilesStore.flatMap(profile =>
      Object.entries(profile.competencyMap).flatMap(([comp, ids]) => {
        const rank = ids.indexOf(story.id);
        if (rank === -1) return [];
        return [{ jobLabel: `${profile.role} · ${profile.company}`, competency: comp, rank }];
      })
    );
  }

  function startInterview() {
    sessionStorage.setItem('starlog_interview_mode', 'library');
    sessionStorage.setItem('starlog_interview_submode', 'read');
    navigate('interview');
  }

  function readinessLabel(rank: number | null): string {
    if (rank === null) return 'not rated';
    return `${rank}/5`;
  }
</script>

<div class="p-6" data-testid="story-bank-view">

  <div class="flex items-center justify-between mb-4">
    <div>
      <h1 class="text-2xl font-bold">Story bank</h1>
      <p class="text-sm text-base-content/50 mt-0.5">Your full library · {$storiesStore.length} stor{$storiesStore.length === 1 ? 'y' : 'ies'}</p>
    </div>
    <div class="flex gap-2">
      {#if $storiesStore.length > 0}
        <button class="btn btn-outline btn-sm" onclick={startInterview} data-testid="interview-btn">
          🎤 Review
        </button>
      {/if}
      <button class="btn btn-primary btn-sm" onclick={() => { sessionStorage.removeItem('starlog_gap_profile'); sessionStorage.removeItem('starlog_gap_competency'); navigate('capture'); }}>+ New Story</button>
    </div>
  </div>

  <div class="flex items-center gap-3 mb-4">
    <input
      type="search"
      class="input input-bordered input-sm w-full max-w-sm"
      placeholder="Search stories…"
      bind:value={search}
      data-testid="search-input"
    />
    <button
      class="btn btn-sm {sortByReadiness ? 'btn-outline btn-primary' : 'btn-ghost'} gap-1 shrink-0"
      onclick={() => sortByReadiness = !sortByReadiness}
      title="Sort least-ready first (unrated stories first, then rank 1→5)"
      data-testid="sort-readiness-btn"
    >
      ★ {sortByReadiness ? 'Least ready first' : 'Default order'}
    </button>
  </div>

  {#if $storiesStore.length === 0}
    <div class="flex flex-col items-center justify-center gap-4 py-24 text-base-content/40" data-testid="empty-state">
      <span class="text-5xl">📚</span>
      <p class="text-lg font-medium">No stories yet</p>
      <button class="btn btn-primary" onclick={() => { sessionStorage.removeItem('starlog_gap_profile'); sessionStorage.removeItem('starlog_gap_competency'); navigate('capture'); }}>Capture your first story</button>
    </div>
  {:else}
    <div class="border border-base-300 rounded-xl overflow-hidden bg-base-100">
      <div class="hidden sm:grid grid-cols-[2fr_1fr_1fr_1.6fr] px-4 py-2 bg-base-200 border-b border-base-300 text-xs font-semibold uppercase tracking-wide text-base-content/50">
        <span>Story</span>
        <span>Tags</span>
        <span>Readiness</span>
        <span>Used in</span>
      </div>

      {#each filtered as story (story.id)}
        {@const mappings = getJobMappings(story)}
        {@const goToCount = mappings.filter(m => m.rank === 0).length}
        {@const backupCount = mappings.length - goToCount}

        <div
          class="flex flex-col gap-1 px-4 py-3 border-b border-base-200 last:border-0 hover:bg-base-50 cursor-pointer transition-colors
            sm:grid sm:grid-cols-[2fr_1fr_1fr_1.6fr] sm:items-start sm:gap-0"
          onclick={() => openStory(story.id)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && openStory(story.id)}
          data-testid="story-row"
        >
          <div class="min-w-0">
            {#if goToCount > 0}<span class="text-primary text-xs mr-1">★</span>{/if}
            <span class="font-medium text-sm">{story.title}</span>
          </div>

          <div class="flex flex-wrap gap-1">
            {#each story.competency_tags.slice(0, 3) as tag}
              <span class="badge badge-ghost badge-xs">{tag}</span>
            {/each}
            {#if story.competency_tags.length > 3}
              <span class="badge badge-ghost badge-xs">+{story.competency_tags.length - 3}</span>
            {/if}
          </div>

          <div class="hidden sm:flex items-center gap-1">
            {#if story.rank !== null}
              <div class="flex gap-0.5">
                {#each Array(5) as _, i}
                  <span class="text-xs {i < story.rank ? 'text-indigo-400' : 'text-base-content/15'}">★</span>
                {/each}
              </div>
            {:else}
              <span class="text-xs text-base-content/30 italic">not rated</span>
            {/if}
          </div>

          <div class="hidden sm:block">
            {#if mappings.length === 0}
              <span class="text-xs text-base-content/30 italic">— unmapped</span>
            {:else}
              <button
                class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-dashed border-base-300 text-xs hover:bg-base-200 transition-colors"
                onclick={(e) => { e.stopPropagation(); popoverStoryId = popoverStoryId === story.id ? null : story.id; }}
              >
                {#if goToCount > 0}<span class="text-primary font-bold">★ {goToCount}</span>{/if}
                {#if goToCount > 0 && backupCount > 0}<span class="text-base-content/40">·</span>{/if}
                {#if backupCount > 0}<span class="text-base-content/50">{backupCount} backup{backupCount > 1 ? 's' : ''}</span>{/if}
                <span class="text-base-content/30">▾</span>
              </button>

              {#if popoverStoryId === story.id}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="absolute z-10 mt-1 bg-base-100 border border-base-300 rounded-xl shadow-lg p-3 min-w-52"
                  onclick={(e) => e.stopPropagation()}
                >
                  <p class="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-2">Used in</p>
                  {#each mappings as m}
                    <div class="flex justify-between items-center py-1 border-t border-base-200 first:border-0 gap-3">
                      <span class="text-xs truncate">{m.jobLabel}</span>
                      <span class="text-xs font-bold shrink-0 {m.rank === 0 ? 'text-primary' : 'text-base-content/40'}">
                        {m.rank === 0 ? '★ go-to' : `#${m.rank + 1} backup`}
                      </span>
                    </div>
                  {/each}
                </div>
              {/if}
            {/if}
          </div>
        </div>
      {/each}

      {#if filtered.length === 0 && $storiesStore.length > 0}
        <div class="py-10 text-center text-base-content/40 text-sm" data-testid="no-results">
          No stories match your search.
        </div>
      {/if}
    </div>
  {/if}
</div>
