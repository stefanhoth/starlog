<script lang="ts">
  import { storiesStore } from '../lib/stores/stories';
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { navigate } from '../lib/stores/view';
  import { COMPETENCIES } from '../lib/competencies';
  import type { StoryDraft } from '../lib/types';
  import { get } from 'svelte/store';

  const QUALITY_ICON: Record<string, string> = { high: '🟢', medium: '🟡', low: '🔴' };

  const STRENGTH_STATES = [
    { rank: 1, label: 'thin',  dot: 'bg-red-400    border-red-400'    },
    { rank: 3, label: 'ok',    dot: 'bg-amber-400  border-amber-400'  },
    { rank: 5, label: 'great', dot: 'bg-emerald-400 border-emerald-400' },
  ];

  const COACHING: Record<string, string> = {
    situation: 'Set the scene: name the company/team, time period, and what was at stake.',
    task:      'Who set this goal? Naming the stakeholder makes the stakes obvious.',
    result:    'Quantify the outcome — numbers, percentages, timelines, or team size.',
  };

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
  let rank      = $state(3);
  let showTagPicker = $state(false);
  let showAIBanner  = $state(true);

  const gapProfileId = sessionStorage.getItem('starlog_gap_profile') ?? '';
  const gapComp      = sessionStorage.getItem('starlog_gap_competency') ?? '';
  const gapProfile   = $derived(
    gapProfileId ? ($jobProfilesStore.find(p => p.id === gapProfileId) ?? null) : null
  );

  const activeStrengthIdx = $derived(rank <= 2 ? 0 : rank <= 4 ? 1 : 2);

  // ── Click-to-edit ────────────────────────────────────────────────────
  type EditableField = 'situation' | 'task' | 'result' | 'title';
  let editingField = $state<EditableField | null>(null);
  let fieldDraft   = $state('');

  function startEdit(field: EditableField, value: string) {
    if (editingField && editingField !== field) commitEdit();
    editingField = field;
    fieldDraft   = value;
  }

  function commitEdit() {
    if (!editingField) return;
    if (editingField === 'situation') situation = fieldDraft;
    else if (editingField === 'task')   task      = fieldDraft;
    else if (editingField === 'result') result    = fieldDraft;
    else if (editingField === 'title')  title     = fieldDraft;
    editingField = null;
  }

  function cancelEdit() { editingField = null; }

  function fieldKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') cancelEdit();
  }

  // ── Actions ──────────────────────────────────────────────────────────
  function removeAction(i: number) { if (actions.length > 1) actions = actions.filter((_, idx) => idx !== i); }
  function updateAction(i: number, val: string) {
    actions = actions.map((a, idx) => idx === i ? val : a);
  }
  function addAction() { actions = [...actions, '']; }

  function toggleTag(tag: string) {
    tags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
  }

  function save() {
    commitEdit();
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
  {#if editingField === 'title'}
    <div class="mb-4">
      <input
        class="input input-bordered w-full text-2xl font-bold"
        bind:value={fieldDraft}
        onkeydown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
        data-testid="story-title"
      />
      <div class="flex justify-end gap-1 mt-1">
        <button class="btn btn-xs btn-ghost" onclick={cancelEdit}>esc</button>
        <button class="btn btn-xs btn-primary" onclick={commitEdit}>✓ save</button>
      </div>
    </div>
  {:else}
    <div class="flex items-baseline gap-2 mb-1">
      <h2 class="text-2xl font-bold" data-testid="story-title">{title || 'Untitled Story'}</h2>
      <button class="text-xs text-base-content/40 hover:text-base-content transition-colors" onclick={() => startEdit('title', title)}>✏ edit</button>
    </div>
  {/if}

  <!-- Fresh-from-AI banner -->
  {#if showAIBanner}
    <div class="flex items-center justify-between bg-indigo-50 text-indigo-700 rounded-full px-4 py-1.5 text-sm mb-4">
      <span>✨ fresh from AI · read it through · click anything to fix</span>
      <button class="ml-2 text-indigo-400 hover:text-indigo-700 transition-colors" onclick={() => showAIBanner = false}>✕</button>
    </div>
  {/if}

  <!-- Strength + Tags -->
  <div class="flex flex-wrap items-center gap-3 mb-5">
    <div class="flex items-center gap-2">
      <span class="text-xs text-base-content/50">strength</span>
      <div class="flex items-center gap-1.5 bg-base-200 rounded-full px-2.5 py-1">
        {#each STRENGTH_STATES as s, i}
          <button
            class="w-3.5 h-3.5 rounded-full border-2 transition-colors {activeStrengthIdx === i ? s.dot : 'border-base-300 bg-transparent'}"
            onclick={() => rank = s.rank}
            aria-label="Strength: {s.label}"
            data-testid="strength-dot"
          ></button>
        {/each}
      </div>
      <span class="text-xs font-medium">{STRENGTH_STATES[activeStrengthIdx].label}</span>
    </div>
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

  <!-- STAR Timeline -->
  <div class="mb-4">

    <!-- S — Situation -->
    <div class="flex gap-4">
      <div class="flex flex-col items-center w-8 shrink-0">
        <div class="w-8 h-8 rounded-full bg-base-200 text-base-content flex items-center justify-center font-bold text-sm shrink-0">S</div>
        <div class="w-px bg-base-300 flex-1 mt-1 min-h-8"></div>
      </div>
      <div class="flex-1 pb-5">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-semibold uppercase tracking-wider text-base-content/50">Situation</span>
          <span class="text-xs">{QUALITY_ICON[quality.situation]}</span>
        </div>
        {#if editingField === 'situation'}
          <textarea
            class="textarea textarea-bordered w-full h-24 resize-y text-sm"
            bind:value={fieldDraft}
            onkeydown={fieldKeydown}
            data-testid="section-situation"
          ></textarea>
          <div class="flex items-start justify-between mt-1 gap-2">
            <span class="text-xs text-base-content/50 italic">↪ {COACHING.situation}</span>
            <div class="flex gap-1 shrink-0">
              <button class="btn btn-xs btn-ghost" onclick={cancelEdit}>esc</button>
              <button class="btn btn-xs btn-primary" onclick={commitEdit}>✓ save</button>
            </div>
          </div>
          <p class="text-xs text-base-content/30 mt-0.5">↵ to save</p>
        {:else}
          <button
            class="w-full text-left text-sm hover:bg-base-200/60 rounded px-1 py-0.5 transition-colors min-h-8"
            onclick={() => startEdit('situation', situation)}
            data-testid="section-situation"
          >
            {#if situation}{situation}{:else}<span class="text-base-content/30 italic">click to add…</span>{/if}
          </button>
        {/if}
      </div>
    </div>

    <!-- T — Task -->
    <div class="flex gap-4">
      <div class="flex flex-col items-center w-8 shrink-0">
        <div class="w-8 h-8 rounded-full bg-base-200 text-base-content flex items-center justify-center font-bold text-sm shrink-0">T</div>
        <div class="w-px bg-base-300 flex-1 mt-1 min-h-8"></div>
      </div>
      <div class="flex-1 pb-5">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-semibold uppercase tracking-wider text-base-content/50">Task</span>
          <span class="text-xs">{QUALITY_ICON[quality.task]}</span>
        </div>
        {#if editingField === 'task'}
          <textarea
            class="textarea textarea-bordered w-full h-24 resize-y text-sm"
            bind:value={fieldDraft}
            onkeydown={fieldKeydown}
            data-testid="section-task"
          ></textarea>
          <div class="flex items-start justify-between mt-1 gap-2">
            <span class="text-xs text-base-content/50 italic">↪ {COACHING.task}</span>
            <div class="flex gap-1 shrink-0">
              <button class="btn btn-xs btn-ghost" onclick={cancelEdit}>esc</button>
              <button class="btn btn-xs btn-primary" onclick={commitEdit}>✓ save</button>
            </div>
          </div>
          <p class="text-xs text-base-content/30 mt-0.5">↵ to save</p>
        {:else}
          <button
            class="w-full text-left text-sm hover:bg-base-200/60 rounded px-1 py-0.5 transition-colors min-h-8"
            onclick={() => startEdit('task', task)}
            data-testid="section-task"
          >
            {#if task}{task}{:else}<span class="text-base-content/30 italic">click to add…</span>{/if}
          </button>
        {/if}
      </div>
    </div>

    <!-- A — Action (primary badge) -->
    <div class="flex gap-4">
      <div class="flex flex-col items-center w-8 shrink-0">
        <div class="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center font-bold text-sm shrink-0">A</div>
        <div class="w-px bg-base-300 flex-1 mt-1 min-h-8"></div>
      </div>
      <div class="flex-1 pb-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider text-base-content/50">Action {QUALITY_ICON[quality.action]}</span>
          <button class="btn btn-xs btn-ghost" onclick={addAction}>+ Add step</button>
        </div>
        {#each actions as action, i}
          <div class="flex gap-2 mb-2">
            <input
              class="input input-bordered input-sm flex-1 text-sm"
              value={action}
              oninput={(e) => updateAction(i, (e.target as HTMLInputElement).value)}
              placeholder="Step {i + 1}"
              data-testid="action-item"
            />
            {#if actions.length > 1}
              <button class="btn btn-xs btn-ghost text-error" onclick={() => removeAction(i)}>✕</button>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- R — Result (no line below) -->
    <div class="flex gap-4">
      <div class="flex flex-col items-center w-8 shrink-0">
        <div class="w-8 h-8 rounded-full bg-base-200 text-base-content flex items-center justify-center font-bold text-sm shrink-0">R</div>
      </div>
      <div class="flex-1">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-semibold uppercase tracking-wider text-base-content/50">Result</span>
          <span class="text-xs">{QUALITY_ICON[quality.result]}</span>
        </div>
        {#if editingField === 'result'}
          <textarea
            class="textarea textarea-bordered w-full h-24 resize-y text-sm"
            bind:value={fieldDraft}
            onkeydown={fieldKeydown}
            data-testid="section-result"
          ></textarea>
          <div class="flex items-start justify-between mt-1 gap-2">
            <span class="text-xs text-base-content/50 italic">↪ {COACHING.result}</span>
            <div class="flex gap-1 shrink-0">
              <button class="btn btn-xs btn-ghost" onclick={cancelEdit}>esc</button>
              <button class="btn btn-xs btn-primary" onclick={commitEdit}>✓ save</button>
            </div>
          </div>
          <p class="text-xs text-base-content/30 mt-0.5">↵ to save</p>
        {:else}
          <button
            class="w-full text-left text-sm hover:bg-base-200/60 rounded px-1 py-0.5 transition-colors min-h-8"
            onclick={() => startEdit('result', result)}
            data-testid="section-result"
          >
            {#if result}{result}{:else}<span class="text-base-content/30 italic">click to add…</span>{/if}
          </button>
        {/if}
      </div>
    </div>

  </div>

  {#if quality.notes}
    <div class="alert alert-info text-sm mt-2">
      <span>💡 {quality.notes}</span>
    </div>
  {/if}

</div>
