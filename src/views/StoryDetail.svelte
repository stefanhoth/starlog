<script lang="ts">
  import { storiesStore } from '../lib/stores/stories';
  import { navigate } from '../lib/stores/view';
  import { COMPETENCIES } from '../lib/competencies';
  import type { Story } from '../lib/types';

  const QUALITY_ICON: Record<string, string> = { high: '🟢', medium: '🟡', low: '🔴' };

  const storyId = sessionStorage.getItem('starlog_active_story') ?? '';
  const original = $storiesStore.find(s => s.id === storyId);

  $effect(() => { if (!original) navigate('story-bank'); });

  let title = $state(original?.title ?? '');
  let situation = $state(original?.star.situation ?? '');
  let task = $state(original?.star.task ?? '');
  let actions = $state<string[]>([...(original?.star.action ?? [])]);
  let result = $state(original?.star.result ?? '');
  let tags = $state<string[]>([...(original?.competency_tags ?? [])]);
  let notes = $state(original?.notes ?? '');
  let rank = $state(original?.rank ?? 3);
  let quality = $state({ ...(original?.quality ?? { situation: 'medium', task: 'medium', action: 'medium', result: 'medium', notes: '' }) });
  let showTagPicker = $state(false);
  let showDeleteConfirm = $state(false);
  let editingField = $state<string | null>(null);
  let editingActionIdx = $state<number | null>(null);

  function save() {
    storiesStore.updateStory(storyId, {
      title: title.trim() || 'Untitled Story',
      competency_tags: tags,
      notes,
      rank,
      star: { situation, task, action: actions.filter(a => a.trim()), result },
    });
  }

  function deleteStory() {
    storiesStore.deleteStory(storyId);
    sessionStorage.removeItem('starlog_active_story');
    navigate('story-bank');
  }

  function addAction() { actions = [...actions, '']; }
  function removeAction(i: number) { actions = actions.filter((_, idx) => idx !== i); }
  function updateAction(i: number, val: string) {
    actions = actions.map((a, idx) => idx === i ? val : a);
  }
  function toggleTag(tag: string) {
    tags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
  }
</script>

<div class="p-6 max-w-2xl mx-auto" data-testid="story-detail-view">
  <div class="flex items-center gap-2 mb-6">
    <button class="btn btn-ghost btn-sm" onclick={() => navigate('story-bank')}>← Back</button>
    <div class="flex-1"></div>
    <button class="btn btn-error btn-sm btn-outline" onclick={() => showDeleteConfirm = true} data-testid="delete-btn">Delete</button>
    <button class="btn btn-primary btn-sm" onclick={save} data-testid="save-btn">Save</button>
  </div>

  <!-- Title -->
  <input
    class="w-full text-xl font-bold mb-4 rounded transition-colors duration-100
           {editingField === 'title'
             ? 'input input-bordered'
             : 'border-0 bg-transparent cursor-text hover:bg-base-200/60 p-1 outline-none'}"
    bind:value={title}
    onfocus={() => editingField = 'title'}
    onblur={() => { editingField = null; save(); }}
    onkeydown={(e) => { if (e.key === 'Escape') (e.target as HTMLElement).blur(); }}
    data-testid="detail-title"
  />

  <!-- Strength -->
  <div class="flex items-center gap-2 mb-4">
    <span class="text-sm font-medium text-base-content/60" title="Your confidence rating for this story (1–5)">Strength:</span>
    {#each Array(5) as _, i}
      <button
        class="text-xl {i < rank ? 'text-warning' : 'text-base-300'}"
        onclick={() => rank = i + 1}
        aria-label="Set strength to {i + 1}"
        data-testid="rank-star"
      >★</button>
    {/each}
  </div>

  <!-- Tags -->
  <div class="mb-4">
    <span class="label-text font-semibold mb-2 block">Competencies</span>
    <div class="flex flex-wrap gap-2 mb-2">
      {#each tags as tag}
        <span class="badge badge-primary gap-1">{tag}
          <button onclick={() => toggleTag(tag)} aria-label="Remove {tag}">✕</button>
        </span>
      {/each}
      <button class="badge badge-ghost" onclick={() => showTagPicker = !showTagPicker}>+ Add</button>
    </div>
    {#if showTagPicker}
      <div class="flex flex-wrap gap-2 p-3 bg-base-200 rounded-lg">
        {#each COMPETENCIES as c}
          <button class="badge {tags.includes(c) ? 'badge-primary' : 'badge-ghost'} cursor-pointer" onclick={() => toggleTag(c)}>{c}</button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- STAR sections -->
  {#each [
    { key: 'situation', label: 'Situation', value: situation, setter: (v: string) => situation = v },
    { key: 'task',      label: 'Task',      value: task,      setter: (v: string) => task = v },
    { key: 'result',    label: 'Result',    value: result,    setter: (v: string) => result = v },
  ] as section}
    <div class="form-control mb-4">
      <label class="label cursor-text" for="detail-{section.key}">
        <span class="label-text font-semibold">{section.label}</span>
        <span class="text-xs text-base-content/30 {editingField === section.key ? 'hidden' : ''}">click to edit</span>
        <span>{QUALITY_ICON[quality[section.key as keyof typeof quality] as string] ?? ''}</span>
      </label>
      <textarea
        id="detail-{section.key}"
        class="w-full resize-none rounded leading-relaxed transition-colors duration-100
               {editingField === section.key
                 ? 'textarea textarea-bordered h-24 resize-y'
                 : 'border-0 bg-transparent cursor-text hover:bg-base-200/60 p-1 outline-none text-base'}"
        style={editingField !== section.key ? 'field-sizing: content' : ''}
        value={section.value}
        oninput={(e) => section.setter((e.target as HTMLTextAreaElement).value)}
        onfocus={() => editingField = section.key}
        onblur={() => { editingField = null; save(); }}
        onkeydown={(e) => { if (e.key === 'Escape') (e.target as HTMLElement).blur(); }}
        data-testid="detail-{section.key}"
      ></textarea>
    </div>
  {/each}

  <!-- Actions -->
  <div class="mb-4">
    <div class="flex items-center justify-between mb-2">
      <span class="label-text font-semibold">Action Steps {QUALITY_ICON[quality.action]}</span>
      {#if editingActionIdx !== null}
        <button class="btn btn-xs btn-ghost" onclick={addAction}>+ Add step</button>
      {/if}
    </div>
    {#each actions as action, i}
      <div class="flex gap-2 mb-1.5 items-center">
        <input
          class="flex-1 rounded transition-colors duration-100
                 {editingActionIdx === i
                   ? 'input input-bordered input-sm'
                   : 'border-0 bg-transparent cursor-text hover:bg-base-200/60 p-1 text-sm outline-none'}"
          value={action}
          oninput={(e) => updateAction(i, (e.target as HTMLInputElement).value)}
          onfocus={() => editingActionIdx = i}
          onblur={() => { editingActionIdx = null; save(); }}
          onkeydown={(e) => { if (e.key === 'Escape') (e.target as HTMLElement).blur(); }}
          data-testid="detail-action-item"
        />
        {#if editingActionIdx === i && actions.length > 1}
          <button class="btn btn-xs btn-ghost text-error" onmousedown={() => removeAction(i)} data-testid="remove-action-btn">✕</button>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Notes -->
  <div class="form-control mb-4">
    <label class="label" for="detail-notes"><span class="label-text font-semibold">Personal Notes</span></label>
    <textarea
      id="detail-notes"
      class="textarea textarea-bordered h-20 resize-y"
      bind:value={notes}
      onblur={save}
      data-testid="detail-notes"
      placeholder="Any private notes for yourself…"
    ></textarea>
  </div>

  {#if quality.notes}
    <div class="alert alert-info text-sm mb-4"><span>💡 {quality.notes}</span></div>
  {/if}

  <!-- Delete confirmation -->
  {#if showDeleteConfirm}
    <div class="modal modal-open" data-testid="delete-confirm-modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Delete this story?</h3>
        <p class="py-2 text-base-content/60">This cannot be undone.</p>
        <div class="modal-action">
          <button class="btn btn-ghost" onclick={() => showDeleteConfirm = false} data-testid="delete-cancel">Cancel</button>
          <button class="btn btn-error" onclick={deleteStory} data-testid="delete-confirm">Delete</button>
        </div>
      </div>
    </div>
  {/if}
</div>
