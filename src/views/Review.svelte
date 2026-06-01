<script lang="ts">
  import { storiesStore } from '../lib/stores/stories';
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { navigate } from '../lib/stores/view';
  import { COMPETENCIES } from '../lib/competencies';
  import StarEditor from '../lib/components/StarEditor.svelte';
  import type { StoryDraft } from '../lib/types';
  import { get } from 'svelte/store';

  const rawDraft = sessionStorage.getItem('starlog_draft');
  const initial: StoryDraft = rawDraft
    ? JSON.parse(rawDraft)
    : {
        title: '',
        original_language: 'en',
        competency_tags: [],
        star: { situation: '', task: '', action: [''], result: '' },
        quality: { situation: 'medium', task: 'medium', action: 'medium', result: 'medium', notes: '' },
      };

  let title     = $state(initial.title);
  let situation = $state(initial.star.situation);
  let task      = $state(initial.star.task);
  let actions   = $state<string[]>([...initial.star.action]);
  let result    = $state(initial.star.result);
  let tags      = $state<string[]>([...initial.competency_tags]);
  let quality   = $state({ ...initial.quality });
  let rank      = $state<number | null>(null);
  let showTagPicker = $state(false);
  let showAIBanner  = $state(true);
  let starEditor: { commitPending: () => void } | undefined = $state();

  // ── Title click-to-edit ───────────────────────────────────────────────
  let editingTitle = $state(false);
  let titleDraft   = $state('');

  function startEditTitle() { editingTitle = true; titleDraft = title; }
  function commitTitle() { title = titleDraft; editingTitle = false; }
  function cancelTitle() { editingTitle = false; }

  // ── Gap-fill wiring ───────────────────────────────────────────────────
  const gapProfileId = sessionStorage.getItem('starlog_gap_profile') ?? '';
  const gapComp      = sessionStorage.getItem('starlog_gap_competency') ?? '';
  const gapProfile   = $derived(
    gapProfileId ? ($jobProfilesStore.find(p => p.id === gapProfileId) ?? null) : null
  );

  function toggleTag(tag: string) {
    tags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
  }

  function save() {
    starEditor?.commitPending();
    if (editingTitle) commitTitle();
    const story = storiesStore.addStory({
      title: title.trim() || 'Untitled Story',
      original_language: initial.original_language,
      competency_tags: tags,
      star: { situation, task, action: actions.filter(a => a.trim()), result },
      quality,
    }, rank);
    sessionStorage.removeItem('starlog_draft');

    if (gapProfileId && gapComp) {
      const p = get(jobProfilesStore).find(x => x.id === gapProfileId);
      if (p) {
        const existing = p.competencyMap[gapComp] ?? [];
        if (!existing.includes(story.id)) {
          jobProfilesStore.updateJobProfile(gapProfileId, {
            competencyMap: { ...p.competencyMap, [gapComp]: [story.id, ...existing] },
          });
        }
      }
      sessionStorage.removeItem('starlog_gap_profile');
      sessionStorage.removeItem('starlog_gap_competency');
      navigate('job-hub');
    } else {
      navigate('story-bank');
    }
  }

  function discard() {
    sessionStorage.removeItem('starlog_draft');
    if (gapProfileId) {
      sessionStorage.removeItem('starlog_gap_profile');
      sessionStorage.removeItem('starlog_gap_competency');
      navigate('gap-fill');
    } else {
      navigate('capture');
    }
  }
</script>

<div class="p-6 max-w-2xl mx-auto" data-testid="review-view">

  <!-- Breadcrumb + buttons -->
  <div class="flex items-start justify-between mb-4 gap-2">
    <div class="flex items-center gap-1.5 text-sm text-base-content/50 flex-wrap">
      {#if gapProfile}
        <button class="hover:text-base-content transition-colors" onclick={discard}>← {gapProfile.role} · {gapProfile.company}</button>
        <span>›</span><span>{gapComp}</span>
      {:else}
        <button class="hover:text-base-content transition-colors" onclick={discard}>← Capture</button>
      {/if}
      <span>›</span><span>review</span>
    </div>
    <div class="flex gap-2 shrink-0">
      <button class="btn btn-ghost btn-sm" onclick={discard}>Discard</button>
      <button class="btn btn-primary btn-sm" onclick={save} data-testid="save-story">Save to Library</button>
    </div>
  </div>

  <!-- Title -->
  {#if editingTitle}
    <div class="mb-4">
      <input
        class="input input-bordered w-full text-2xl font-bold"
        bind:value={titleDraft}
        onkeydown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') cancelTitle(); }}
        data-testid="story-title"
      />
      <div class="flex justify-end gap-1 mt-1">
        <button class="btn btn-xs btn-ghost" onclick={cancelTitle}>esc</button>
        <button class="btn btn-xs btn-primary" onclick={commitTitle}>✓ save</button>
      </div>
    </div>
  {:else}
    <div class="flex items-baseline gap-2 mb-1">
      <h2 class="text-2xl font-bold" data-testid="story-title">{title || 'Untitled Story'}</h2>
      <button class="text-xs text-base-content/40 hover:text-base-content transition-colors" onclick={startEditTitle}>✏ edit</button>
    </div>
  {/if}

  <!-- Fresh-from-AI banner -->
  {#if showAIBanner}
    <div class="flex items-center justify-between bg-indigo-50 text-indigo-700 rounded-full px-4 py-1.5 text-sm mb-4">
      <span>✨ fresh from AI · read it through · click anything to fix</span>
      <button class="ml-2 text-indigo-400 hover:text-indigo-700 transition-colors" onclick={() => showAIBanner = false}>✕</button>
    </div>
  {/if}

  <!-- Tags -->
  <div class="flex flex-wrap items-center gap-3 mb-5">
    <div class="flex flex-wrap items-center gap-1.5">
      {#each tags as tag, i}
        <span class="badge {i === 0 ? 'badge-primary' : 'badge-ghost'} gap-1">
          {#if i === 0}<span class="text-primary-content">★</span> {/if}{tag}
          <button onclick={() => toggleTag(tag)} aria-label="Remove {tag}">✕</button>
        </span>
      {/each}
      <button
        class="w-7 h-7 rounded-full border-2 border-dashed border-base-300 flex items-center justify-center text-base-content/40 hover:border-primary hover:text-primary transition-colors"
        onclick={() => showTagPicker = !showTagPicker}
        data-testid="tag-picker-toggle"
        aria-label="Add tag"
      >+</button>
    </div>
  </div>

  {#if showTagPicker}
    <div class="flex flex-wrap gap-2 p-3 bg-base-200 rounded-lg mb-4" data-testid="tag-picker">
      {#each COMPETENCIES as c}
        <button class="badge {tags.includes(c) ? 'badge-primary' : 'badge-ghost'} cursor-pointer" onclick={() => toggleTag(c)}>{c}</button>
      {/each}
    </div>
  {/if}

  <StarEditor
    bind:this={starEditor}
    bind:situation
    bind:task
    bind:actions
    bind:result
    bind:rank
    {quality}
    guardDirty
  />

  <!-- Your Readiness — user-owned rating, visually separated from AI quality above -->
  <div class="mt-5 pt-4 border-t border-base-300" data-testid="readiness-section">
    <p class="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-2">Your readiness</p>
    <p class="text-xs text-base-content/40 mb-3">How confident are you telling this story out loud?</p>
    <div class="flex items-center gap-3 flex-wrap">
      <div class="flex gap-1">
        {#each READINESS_STATES as s}
          <button
            class="text-xl transition-colors {rank !== null && rank >= s.rank ? 'text-indigo-500' : 'text-base-content/20'} hover:text-indigo-400"
            onclick={() => rank = rank === s.rank && s.rank === rank ? null : s.rank}
            aria-label="Readiness: {s.label}"
            data-testid="readiness-star"
          >★</button>
        {/each}
      </div>
      {#if rank !== null}
        <span class="text-sm font-medium text-indigo-600">{READINESS_STATES[rank - 1].label}</span>
        <button class="text-xs text-base-content/30 hover:text-base-content/60 transition-colors" onclick={() => rank = null}>clear</button>
      {:else}
        <span class="text-sm text-base-content/30 italic">not yet rated</span>
      {/if}
    </div>
  </div>

</div>
