<script lang="ts">
  import { storiesStore } from '../lib/stores/stories';
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { navigate } from '../lib/stores/view';
  import { COMPETENCIES } from '../lib/competencies';
  import type { StoryDraft } from '../lib/types';
  import { get } from 'svelte/store';

  const QUALITY_ICON: Record<string, string> = { high: '🟢', medium: '🟡', low: '🔴' };

  // Load draft from sessionStorage
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

  let title = $state(initial.title);
  let situation = $state(initial.star.situation);
  let task = $state(initial.star.task);
  let actions = $state<string[]>([...initial.star.action]);
  let result = $state(initial.star.result);
  let tags = $state<string[]>([...initial.competency_tags]);
  let quality = $state({ ...initial.quality });
  let showTagPicker = $state(false);

  function addAction() { actions = [...actions, '']; }
  function removeAction(i: number) { actions = actions.filter((_, idx) => idx !== i); }
  function updateAction(i: number, val: string) {
    actions = actions.map((a, idx) => idx === i ? val : a);
  }

  function toggleTag(tag: string) {
    tags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
  }

  const gapProfile = sessionStorage.getItem('starlog_gap_profile') ?? '';
  const gapComp = sessionStorage.getItem('starlog_gap_competency') ?? '';

  function save() {
    const story = storiesStore.addStory({
      title: title.trim() || 'Untitled Story',
      original_language: initial.original_language,
      competency_tags: tags,
      star: { situation, task, action: actions.filter(a => a.trim()), result },
      quality,
    });
    sessionStorage.removeItem('starlog_draft');

    // If this came from a gap-fill, auto-map the story to that competency
    if (gapProfile && gapComp) {
      const p = get(jobProfilesStore).find(x => x.id === gapProfile);
      if (p) {
        const existing = p.competencyMap[gapComp] ?? [];
        if (!existing.includes(story.id)) {
          jobProfilesStore.updateJobProfile(gapProfile, {
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
    if (gapProfile) {
      sessionStorage.removeItem('starlog_gap_profile');
      sessionStorage.removeItem('starlog_gap_competency');
      navigate('gap-fill');
    } else {
      navigate('capture');
    }
  }
</script>

<div class="p-6 max-w-2xl mx-auto" data-testid="review-view">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold">Review Your Story</h1>
    <div class="flex gap-2">
      <button class="btn btn-ghost btn-sm" onclick={discard}>Discard</button>
      <button class="btn btn-primary btn-sm" onclick={save} data-testid="save-story">Save to Library</button>
    </div>
  </div>

  <!-- Title -->
  <div class="form-control mb-4">
    <label class="label" for="story-title"><span class="label-text font-semibold">Title</span></label>
    <input id="story-title" class="input input-bordered" bind:value={title} data-testid="story-title" />
  </div>

  <!-- Competency Tags -->
  <div class="form-control mb-4">
    <span class="label-text font-semibold mb-2 block">Competencies</span>
    <div class="flex flex-wrap gap-2 mb-2">
      {#each tags as tag}
        <span class="badge badge-primary gap-1">
          {tag}
          <button onclick={() => toggleTag(tag)} aria-label="Remove {tag}">✕</button>
        </span>
      {/each}
      <button class="badge badge-ghost gap-1" onclick={() => showTagPicker = !showTagPicker} data-testid="tag-picker-toggle">
        + Add
      </button>
    </div>
    {#if showTagPicker}
      <div class="flex flex-wrap gap-2 p-3 bg-base-200 rounded-lg" data-testid="tag-picker">
        {#each COMPETENCIES as c}
          <button
            class="badge {tags.includes(c) ? 'badge-primary' : 'badge-ghost'} cursor-pointer"
            onclick={() => toggleTag(c)}
          >{c}</button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- STAR Sections (S and T) -->
  {#each [
    { key: 'situation', label: 'Situation', value: situation, setter: (v: string) => situation = v },
    { key: 'task',      label: 'Task',      value: task,      setter: (v: string) => task = v },
  ] as section}
    <div class="form-control mb-4">
      <label class="label" for="section-{section.key}">
        <span class="label-text font-semibold">{section.label}</span>
        <span class="label-text-alt">{QUALITY_ICON[quality[section.key as keyof typeof quality] as string] ?? ''}</span>
      </label>
      <textarea
        id="section-{section.key}"
        class="textarea textarea-bordered h-24 resize-y"
        value={section.value}
        oninput={(e) => section.setter((e.target as HTMLTextAreaElement).value)}
        data-testid="section-{section.key}"
      ></textarea>
    </div>
  {/each}

  <!-- Action items (A) -->
  <div class="form-control mb-4">
    <div class="flex items-center justify-between mb-2">
      <span class="label-text font-semibold">Action Steps {QUALITY_ICON[quality.action]}</span>
      <button class="btn btn-xs btn-ghost" onclick={addAction}>+ Add step</button>
    </div>
    {#each actions as action, i}
      <div class="flex gap-2 mb-2">
        <input
          class="input input-bordered input-sm flex-1"
          value={action}
          oninput={(e) => updateAction(i, (e.target as HTMLInputElement).value)}
          placeholder="Action step {i + 1}"
          data-testid="action-item"
        />
        {#if actions.length > 1}
          <button class="btn btn-xs btn-ghost text-error" onclick={() => removeAction(i)}>✕</button>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Result (R) -->
  <div class="form-control mb-4">
    <label class="label" for="section-result">
      <span class="label-text font-semibold">Result</span>
      <span class="label-text-alt">{QUALITY_ICON[quality.result] ?? ''}</span>
    </label>
    <textarea
      id="section-result"
      class="textarea textarea-bordered h-24 resize-y"
      value={result}
      oninput={(e) => result = (e.target as HTMLTextAreaElement).value}
      data-testid="section-result"
    ></textarea>
  </div>

  <!-- Quality notes -->
  {#if quality.notes}
    <div class="alert alert-info text-sm mt-2">
      <span>💡 {quality.notes}</span>
    </div>
  {/if}
</div>
