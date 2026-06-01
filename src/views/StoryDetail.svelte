<script lang="ts">
  import { storiesStore } from '../lib/stores/stories';
  import { navigate } from '../lib/stores/view';
  import { COMPETENCIES } from '../lib/competencies';

  const QUALITY_ICON: Record<string, string> = { high: '🟢', medium: '🟡', low: '🔴' };

  const READINESS_STATES = [
    { rank: 1, label: 'not ready'  },
    { rank: 2, label: 'shaky'      },
    { rank: 3, label: 'ok'         },
    { rank: 4, label: 'confident'  },
    { rank: 5, label: 'nailed it'  },
  ];

  const COACHING: Record<string, string> = {
    situation: 'Set the scene: name the company/team, time period, and what was at stake.',
    task:      'Who set this goal? Naming the stakeholder makes the stakes obvious.',
    result:    'Quantify the outcome — numbers, percentages, timelines, or team size.',
  };

  const storyId = sessionStorage.getItem('starlog_active_story') ?? '';
  const original = $storiesStore.find(s => s.id === storyId);

  $effect(() => { if (!original) navigate('story-bank'); });

  let title     = $state(original?.title ?? '');
  let situation = $state(original?.star.situation ?? '');
  let task      = $state(original?.star.task ?? '');
  let actions   = $state<string[]>([...(original?.star.action ?? [])]);
  let result    = $state(original?.star.result ?? '');
  let tags      = $state<string[]>([...(original?.competency_tags ?? [])]);
  let notes     = $state(original?.notes ?? '');
  let rank      = $state<number | null>(original?.rank ?? null);
  let quality   = $state({ ...(original?.quality ?? { situation: 'medium', task: 'medium', action: 'medium', result: 'medium', notes: '' }) });
  let showTagPicker     = $state(false);
  let showDeleteConfirm = $state(false);

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
    save();
  }

  function cancelEdit() { editingField = null; }

  function fieldKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') cancelEdit();
  }

  // ── Action items (click-to-edit, one at a time) ───────────────────────
  let editingActionIdx = $state<number | null>(null);
  let actionDraft      = $state('');

  function startEditAction(i: number) {
    if (editingActionIdx !== null && editingActionIdx !== i) saveAction();
    editingActionIdx = i;
    actionDraft = actions[i];
  }

  function saveAction() {
    if (editingActionIdx === null) return;
    const idx = editingActionIdx;
    actions = actions.map((a, i) => i === idx ? actionDraft : a);
    editingActionIdx = null;
    save();
  }

  function cancelAction() { editingActionIdx = null; }

  function actionKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); saveAction(); }
    if (e.key === 'Escape') cancelAction();
  }

  function removeAction(i: number) {
    if (actions.length <= 1) return;
    actions = actions.filter((_, idx) => idx !== i);
    save();
  }

  function addAction() {
    if (editingActionIdx !== null) saveAction();
    actions = [...actions, ''];
    editingActionIdx = actions.length - 1;
    actionDraft = '';
  }

  // ── Drag-to-reorder ──────────────────────────────────────────────────
  let dragFromIdx = $state<number | null>(null);
  let dragOverIdx = $state<number | null>(null);

  function reorder<T>(arr: T[], from: number, to: number): T[] {
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }
  function onDragStart(i: number) { dragFromIdx = i; }
  function onDragOver(e: DragEvent, i: number) { e.preventDefault(); dragOverIdx = i; }
  function onDrop(e: DragEvent, i: number) {
    e.preventDefault();
    if (dragFromIdx === null || dragFromIdx === i) { dragFromIdx = null; dragOverIdx = null; return; }
    actions = reorder(actions, dragFromIdx, i);
    dragFromIdx = null;
    dragOverIdx = null;
    save();
  }
  function onDragEnd() { dragFromIdx = null; dragOverIdx = null; }

  function toggleTag(tag: string) {
    tags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
  }

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
</script>

<div class="p-6 max-w-2xl mx-auto" data-testid="story-detail-view">

  <!-- Breadcrumb + actions -->
  <div class="flex items-start justify-between mb-4 gap-2">
    <div class="flex items-center gap-1.5 text-sm text-base-content/50 flex-wrap min-w-0">
      <button class="hover:text-base-content transition-colors shrink-0" onclick={() => navigate('story-bank')}>← Story bank</button>
      <span>›</span>
      <span class="truncate min-w-0">{title.length > 32 ? title.slice(0, 32) + '…' : title}</span>
    </div>
    <div class="flex gap-2 shrink-0">
      <button class="btn btn-error btn-sm btn-outline" onclick={() => showDeleteConfirm = true} data-testid="delete-btn">Delete</button>
      <button class="btn btn-primary btn-sm" onclick={() => { if (editingField) commitEdit(); else save(); }} data-testid="save-btn">Save</button>
    </div>
  </div>

  <!-- Title -->
  {#if editingField === 'title'}
    <div class="mb-4">
      <input
        class="input input-bordered w-full text-2xl font-bold"
        bind:value={fieldDraft}
        onkeydown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
        data-testid="detail-title-input"
      />
      <div class="flex justify-end gap-1 mt-1">
        <button class="btn btn-xs btn-ghost" onclick={cancelEdit}>esc</button>
        <button class="btn btn-xs btn-primary" onclick={commitEdit}>✓ save</button>
      </div>
    </div>
  {:else}
    <div class="flex items-baseline gap-2 mb-4">
      <h2 class="text-2xl font-bold" data-testid="detail-title">{title || 'Untitled Story'}</h2>
      <button class="text-xs text-base-content/40 hover:text-base-content transition-colors" onclick={() => startEdit('title', title)}>✏ edit</button>
    </div>
  {/if}

  <!-- Tags -->
  <div class="flex flex-wrap items-center gap-3 mb-5">
    <div class="flex flex-wrap items-center gap-1.5">
      {#each tags as tag, i}
        <span class="badge {i === 0 ? 'badge-primary' : 'badge-ghost'} gap-1">
          {#if i === 0}<span>★</span> {/if}{tag}
          <button onclick={() => toggleTag(tag)} aria-label="Remove {tag}">✕</button>
        </span>
      {/each}
      <button
        class="w-7 h-7 rounded-full border-2 border-dashed border-base-300 flex items-center justify-center text-base-content/40 hover:border-primary hover:text-primary transition-colors"
        onclick={() => showTagPicker = !showTagPicker}
        aria-label="Add tag"
      >+</button>
    </div>
  </div>

  {#if showTagPicker}
    <div class="flex flex-wrap gap-2 p-3 bg-base-200 rounded-lg mb-4">
      {#each COMPETENCIES as c}
        <button class="badge {tags.includes(c) ? 'badge-primary' : 'badge-ghost'} cursor-pointer" onclick={() => toggleTag(c)}>{c}</button>
      {/each}
    </div>
  {/if}

  <!-- AI Verdict + Your Readiness — shown before STAR so they're visible without scrolling -->
  {#if quality.notes}
    <div class="alert alert-info text-sm mb-3"><span>💡 {quality.notes}</span></div>
  {/if}

  <div class="mb-5 pb-4 border-b border-base-300" data-testid="readiness-section">
    <div class="flex items-center gap-3 flex-wrap">
      <span class="text-xs font-semibold uppercase tracking-wider text-base-content/50 shrink-0">Your readiness</span>
      <div class="flex gap-1">
        {#each READINESS_STATES as s}
          <button
            class="text-xl transition-colors {rank !== null && rank >= s.rank ? 'text-indigo-500' : 'text-base-content/20'} hover:text-indigo-400"
            onclick={() => { rank = s.rank; save(); }}
            aria-label="Readiness: {s.label}"
            data-testid="readiness-star"
          >★</button>
        {/each}
      </div>
      {#if rank !== null}
        <span class="text-sm font-medium text-indigo-600">{READINESS_STATES[rank - 1].label}</span>
        <button class="text-xs text-base-content/30 hover:text-base-content/60 transition-colors" onclick={() => { rank = null; save(); }}>clear</button>
      {:else}
        <span class="text-sm text-base-content/30 italic">not yet rated</span>
      {/if}
    </div>
  </div>

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
            data-testid="detail-situation"
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
            class="w-full text-left text-sm hover:bg-base-200/60 rounded px-1 py-0.5 transition-colors min-h-8 section-situation"
            onclick={() => startEdit('situation', situation)}
            data-testid="detail-situation"
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
            data-testid="detail-task"
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
            data-testid="detail-task"
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
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-semibold uppercase tracking-wider text-base-content/50">Action {QUALITY_ICON[quality.action]}</span>
        </div>
        <p class="text-xs text-base-content/30 mb-2">drag ⋮⋮ to reorder · hover to edit or remove</p>
        {#each actions as action, i}
          <div
            role="listitem"
            class="flex gap-2 mb-1.5 items-center group {dragOverIdx === i && dragFromIdx !== i ? 'bg-primary/5 rounded ring-1 ring-primary/20' : ''}"
            draggable={editingActionIdx !== i}
            ondragstart={() => onDragStart(i)}
            ondragover={(e) => onDragOver(e, i)}
            ondrop={(e) => onDrop(e, i)}
            ondragend={onDragEnd}
          >
            <span class="cursor-grab text-base-content/20 hover:text-base-content/50 select-none shrink-0 text-sm" title="drag to reorder">⋮⋮</span>
            <span class="text-xs text-base-content/40 w-4 shrink-0 text-right">{i + 1}.</span>
            {#if editingActionIdx === i}
              <input
                class="input input-bordered input-sm flex-1 text-sm"
                bind:value={actionDraft}
                onkeydown={actionKeydown}
                data-testid="detail-action-item"
              />
              <button class="btn btn-xs btn-ghost" onclick={cancelAction}>esc</button>
              <button class="btn btn-xs btn-primary" onclick={saveAction}>✓</button>
              {#if actions.length > 1}
                <button class="btn btn-xs btn-ghost text-error" onclick={() => removeAction(i)} data-testid="remove-action-btn">✕</button>
              {/if}
            {:else}
              <button
                class="flex-1 text-left text-sm hover:bg-base-200/60 rounded px-1 py-0.5 transition-colors"
                onclick={() => startEditAction(i)}
                data-testid="detail-action-item"
              >{#if action}{action}{:else}<span class="text-base-content/30 italic">empty step</span>{/if}</button>
              <button class="btn btn-xs btn-ghost opacity-0 group-hover:opacity-100 transition-opacity" onclick={() => startEditAction(i)} aria-label="Edit step {i + 1}">✏</button>
              {#if actions.length > 1}
                <button class="btn btn-xs btn-ghost text-error opacity-0 group-hover:opacity-100 transition-opacity" onclick={() => removeAction(i)} data-testid="remove-action-btn">✕</button>
              {/if}
            {/if}
          </div>
        {/each}
        <button class="text-xs text-primary/70 hover:text-primary mt-1 transition-colors" onclick={addAction}>+ add step</button>
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
            data-testid="detail-result"
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
            data-testid="detail-result"
          >
            {#if result}{result}{:else}<span class="text-base-content/30 italic">click to add…</span>{/if}
          </button>
        {/if}
      </div>
    </div>

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


  <!-- Delete confirmation modal -->
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
