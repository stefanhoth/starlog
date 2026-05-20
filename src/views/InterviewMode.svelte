<script lang="ts">
  import { storiesStore } from '../lib/stores/stories';
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { navigate } from '../lib/stores/view';
  import type { Story } from '../lib/types';

  const mode = (sessionStorage.getItem('starlog_interview_mode') ?? 'library') as 'library' | 'profile';
  const profileId = sessionStorage.getItem('starlog_active_profile') ?? '';

  type Group = { competency: string | null; stories: Story[] };

  const groups = $derived.by<Group[]>(() => {
    const stories = $storiesStore;
    const profiles = $jobProfilesStore;
    if (mode === 'library') {
      return [{ competency: null, stories }];
    }
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return [];
    return profile.extractedCompetencies
      .map(c => ({
        competency: c,
        stories: (profile.competencyMap[c] ?? [])
          .map(id => stories.find(s => s.id === id))
          .filter((s): s is Story => !!s),
      }))
      .filter(g => g.stories.length > 0);
  });

  let groupIdx = $state(0);
  let storyIdx = $state(0);
  let expanded = $state(false);

  const currentGroup = $derived(groups[Math.min(groupIdx, groups.length - 1)] ?? null);
  const currentStory = $derived(
    currentGroup?.stories[Math.min(storyIdx, (currentGroup?.stories.length ?? 1) - 1)] ?? null
  );

  function exit() {
    navigate(mode === 'profile' ? 'job-profile-detail' : 'library');
  }

  function nextStory() {
    if (!currentGroup) return;
    storyIdx = storyIdx < currentGroup.stories.length - 1 ? storyIdx + 1 : 0;
    expanded = false;
  }

  function prevStory() {
    if (!currentGroup) return;
    storyIdx = storyIdx > 0 ? storyIdx - 1 : currentGroup.stories.length - 1;
    expanded = false;
  }

  function nextGroup() {
    if (groupIdx < groups.length - 1) {
      groupIdx++;
      storyIdx = 0;
      expanded = false;
    }
  }

  function prevGroup() {
    if (groupIdx > 0) {
      groupIdx--;
      storyIdx = 0;
      expanded = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'Escape':     exit();       break;
      case 'ArrowRight': nextStory();  break;
      case 'ArrowLeft':  prevStory();  break;
      case 'ArrowDown':  nextGroup();  break;
      case 'ArrowUp':    prevGroup();  break;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="min-h-screen bg-base-100 flex flex-col p-8" data-testid="interview-view">
  <!-- Top bar -->
  <div class="flex items-center justify-between mb-6">
    {#if currentGroup?.competency}
      <span class="badge badge-primary badge-lg text-sm px-4 py-3" data-testid="competency-header">
        {currentGroup.competency}
      </span>
    {:else}
      <span></span>
    {/if}

    <div class="flex items-center gap-4">
      {#if currentGroup}
        <span class="text-sm text-base-content/50" data-testid="story-position">
          {Math.min(storyIdx, currentGroup.stories.length - 1) + 1} / {currentGroup.stories.length}
        </span>
      {/if}
      <button class="btn btn-ghost btn-sm" onclick={exit} data-testid="exit-btn">✕ Exit</button>
    </div>
  </div>

  {#if !currentStory}
    <p class="text-base-content/40 text-center mt-16">No stories to show.</p>
  {:else}
    <!-- Story card — click toggles expand -->
    <button
      class="flex-1 w-full text-left bg-base-200 rounded-2xl p-8 cursor-pointer hover:bg-base-300 transition-colors"
      onclick={() => (expanded = !expanded)}
      data-testid="story-card-interview"
    >
      <h2 class="text-3xl font-bold mb-4" data-testid="interview-story-title">
        {currentStory.title}
      </h2>

      {#if mode === 'library'}
        <div class="flex flex-wrap gap-2 mb-4">
          {#each currentStory.competency_tags as tag}
            <span class="badge badge-ghost">{tag}</span>
          {/each}
        </div>
      {/if}

      {#if !expanded}
        <!-- 2-line action crib -->
        <ul class="space-y-1" data-testid="action-crib">
          {#each currentStory.star.action.slice(0, 2) as action}
            <li class="text-base-content/70 flex gap-2 items-start">
              <span class="text-primary shrink-0">▸</span>
              <span>{action}</span>
            </li>
          {/each}
          {#if currentStory.star.action.length > 2}
            <li class="text-xs text-base-content/40 mt-1">
              +{currentStory.star.action.length - 2} more — click to expand
            </li>
          {/if}
        </ul>
        <p class="text-xs text-base-content/30 mt-4">Click to reveal full STAR</p>
      {:else}
        <!-- Full STAR -->
        <div class="space-y-4 text-sm" data-testid="full-star">
          <div>
            <span class="font-semibold uppercase text-xs tracking-wider text-base-content/50">Situation</span>
            <p class="mt-1">{currentStory.star.situation}</p>
          </div>
          <div>
            <span class="font-semibold uppercase text-xs tracking-wider text-base-content/50">Task</span>
            <p class="mt-1">{currentStory.star.task}</p>
          </div>
          <div>
            <span class="font-semibold uppercase text-xs tracking-wider text-base-content/50">Action</span>
            <ul class="mt-1 space-y-1">
              {#each currentStory.star.action as a}
                <li class="flex gap-2 items-start">
                  <span class="text-primary shrink-0">▸</span>
                  <span>{a}</span>
                </li>
              {/each}
            </ul>
          </div>
          <div>
            <span class="font-semibold uppercase text-xs tracking-wider text-base-content/50">Result</span>
            <p class="mt-1">{currentStory.star.result}</p>
          </div>
        </div>
        <p class="text-xs text-base-content/30 mt-4">Click to collapse</p>
      {/if}
    </button>

    <!-- Navigation row -->
    <div class="flex items-center justify-between mt-6 text-sm text-base-content/50">
      <button
        class="flex items-center gap-1 hover:text-base-content transition-colors"
        onclick={prevStory}
        data-testid="prev-story-btn"
      >
        ← Prev
      </button>

      {#if mode === 'profile' && groups.length > 1}
        <div class="flex flex-col items-center gap-1 text-xs">
          <button
            class="hover:text-base-content transition-colors disabled:opacity-30"
            onclick={prevGroup}
            disabled={groupIdx === 0}
            data-testid="prev-group-btn"
          >
            ↑ {groupIdx > 0 ? groups[groupIdx - 1].competency : '—'}
          </button>
          <span>{groupIdx + 1} / {groups.length} topics</span>
          <button
            class="hover:text-base-content transition-colors disabled:opacity-30"
            onclick={nextGroup}
            disabled={groupIdx === groups.length - 1}
            data-testid="next-group-btn"
          >
            ↓ {groupIdx < groups.length - 1 ? groups[groupIdx + 1].competency : '—'}
          </button>
        </div>
      {/if}

      <button
        class="flex items-center gap-1 hover:text-base-content transition-colors"
        onclick={nextStory}
        data-testid="next-story-btn"
      >
        Next →
      </button>
    </div>
  {/if}
</div>
