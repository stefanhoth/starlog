<script lang="ts">
  import type { StoryQuality } from '../types';
  import { READINESS_STATES } from '../readiness';

  const COACHING: Record<string, string> = {
    situation: 'Set the scene: name the company/team, time period, and what was at stake.',
    task:      'Who set this goal? Naming the stakeholder makes the stakes obvious.',
    result:    'Quantify the outcome — numbers, percentages, timelines, or team size.',
  };

  interface Props {
    situation: string;
    task: string;
    actions: string[];
    result: string;
    rank: number | null;
    quality: StoryQuality;
    oncommit?: () => void;
    guardDirty?: boolean;
    testidSituation?: string;
    testidTask?: string;
    testidResult?: string;
    testidActionItem?: string;
  }

  let {
    situation = $bindable(),
    task = $bindable(),
    actions = $bindable(),
    result = $bindable(),
    rank = $bindable(),
    quality,
    oncommit,
    guardDirty = false,
    testidSituation = 'section-situation',
    testidTask = 'section-task',
    testidResult = 'section-result',
    testidActionItem = 'action-item',
  }: Props = $props();

  // ── autoFocus action ──────────────────────────────────────────────────
  let activeInputRef: HTMLElement | null = null;
  function autoFocus(node: HTMLElement) {
    activeInputRef = node;
    node.focus();
    return { destroy() { if (activeInputRef === node) activeInputRef = null; } };
  }

  // ── Click-to-edit (S, T, R) ───────────────────────────────────────────
  type EditableField = 'situation' | 'task' | 'result';
  let editingField  = $state<EditableField | null>(null);
  let fieldDraft    = $state('');
  let fieldOriginal = $state('');

  function startEdit(field: EditableField, value: string) {
    if (editingField && editingField !== field) commitEdit();
    editingField  = field;
    fieldDraft    = value;
    fieldOriginal = value;
  }

  function commitEdit() {
    if (!editingField) return;
    if (editingField === 'situation') situation = fieldDraft;
    else if (editingField === 'task') task      = fieldDraft;
    else if (editingField === 'result') result  = fieldDraft;
    editingField  = null;
    fieldOriginal = '';
    oncommit?.();
  }

  function cancelEdit() {
    if (guardDirty && fieldDraft !== fieldOriginal) {
      if (!window.confirm('Discard unsaved changes?')) { activeInputRef?.focus(); return; }
    }
    editingField  = null;
    fieldOriginal = '';
  }

  function fieldKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') cancelEdit();
  }

  // ── Actions (click-to-edit + drag-to-reorder) ─────────────────────────
  let editingActionIdx = $state<number | null>(null);
  let actionDraft      = $state('');
  let actionOriginal   = $state('');
  let dragFromIdx      = $state<number | null>(null);
  let dragOverIdx      = $state<number | null>(null);

  function startEditAction(i: number) {
    if (editingActionIdx !== null && editingActionIdx !== i) saveAction();
    editingActionIdx = i;
    actionDraft      = actions[i];
    actionOriginal   = actions[i];
  }

  function saveAction() {
    if (editingActionIdx === null) return;
    const idx = editingActionIdx;
    actions = actions.map((a, j) => j === idx ? actionDraft : a);
    editingActionIdx = null;
    actionOriginal   = '';
    oncommit?.();
  }

  function cancelAction() {
    if (guardDirty && actionDraft !== actionOriginal) {
      if (!window.confirm('Discard unsaved changes?')) { activeInputRef?.focus(); return; }
    }
    editingActionIdx = null;
    actionOriginal   = '';
  }

  function actionKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); saveAction(); }
    if (e.key === 'Escape') cancelAction();
  }

  function removeAction(i: number) {
    if (actions.length <= 1) return;
    actions = actions.filter((_, idx) => idx !== i);
    oncommit?.();
  }

  function addAction() {
    if (editingActionIdx !== null) saveAction();
    actions = [...actions, ''];
    editingActionIdx = actions.length - 1;
    actionDraft      = '';
    actionOriginal   = '';
  }

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
    dragFromIdx = null; dragOverIdx = null;
    oncommit?.();
  }
  function onDragEnd() { dragFromIdx = null; dragOverIdx = null; }

  export function commitPending() {
    if (editingField) commitEdit();
    if (editingActionIdx !== null) saveAction();
  }
</script>

<!-- AI verdict + readiness — before STAR so they're visible without scrolling -->
{#if quality.notes}
  <div class="alert alert-info text-sm mb-3">
    <span>💡 {quality.notes}</span>
  </div>
{/if}

<div class="mb-5 pb-4 border-b border-base-300" data-testid="readiness-section">
  <div class="flex items-center gap-3 flex-wrap">
    <span class="text-xs font-semibold uppercase tracking-wider text-base-content/50 shrink-0">Your readiness</span>
    <div class="flex gap-1">
      {#each READINESS_STATES as s}
        <button
          class="text-xl transition-colors {rank !== null && rank >= s.rank ? 'text-indigo-500' : 'text-base-content/20'} hover:text-indigo-400"
          onclick={() => { rank = rank === s.rank ? null : s.rank; oncommit?.(); }}
          aria-label="Readiness: {s.label}"
          data-testid="readiness-star"
        >★</button>
      {/each}
    </div>
    {#if rank !== null}
      <span class="text-sm font-medium text-indigo-600">{READINESS_STATES[rank - 1].label}</span>
      <button class="text-xs text-base-content/30 hover:text-base-content/60 transition-colors" onclick={() => { rank = null; oncommit?.(); }}>clear</button>
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
      <div class="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center font-bold text-sm shrink-0">S</div>
      <div class="w-px bg-base-300 flex-1 mt-1 min-h-8"></div>
    </div>
    <div class="flex-1 pb-5">
      <div class="mb-1">
        <span class="text-xs font-semibold uppercase tracking-wider text-base-content/50">Situation</span>
      </div>
      {#if editingField === 'situation'}
        <textarea
          class="textarea textarea-bordered w-full h-24 resize-y text-sm"
          bind:value={fieldDraft}
          onkeydown={fieldKeydown}
          data-testid={testidSituation}
          use:autoFocus
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
          data-testid={testidSituation}
        >
          {#if situation}{situation}{:else}<span class="text-base-content/30 italic">click to add…</span>{/if}
        </button>
      {/if}
    </div>
  </div>

  <!-- T — Task -->
  <div class="flex gap-4">
    <div class="flex flex-col items-center w-8 shrink-0">
      <div class="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center font-bold text-sm shrink-0">T</div>
      <div class="w-px bg-base-300 flex-1 mt-1 min-h-8"></div>
    </div>
    <div class="flex-1 pb-5">
      <div class="mb-1">
        <span class="text-xs font-semibold uppercase tracking-wider text-base-content/50">Task</span>
      </div>
      {#if editingField === 'task'}
        <textarea
          class="textarea textarea-bordered w-full h-24 resize-y text-sm"
          bind:value={fieldDraft}
          onkeydown={fieldKeydown}
          data-testid={testidTask}
          use:autoFocus
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
          data-testid={testidTask}
        >
          {#if task}{task}{:else}<span class="text-base-content/30 italic">click to add…</span>{/if}
        </button>
      {/if}
    </div>
  </div>

  <!-- A — Action -->
  <div class="flex gap-4">
    <div class="flex flex-col items-center w-8 shrink-0">
      <div class="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center font-bold text-sm shrink-0">A</div>
      <div class="w-px bg-base-300 flex-1 mt-1 min-h-8"></div>
    </div>
    <div class="flex-1 pb-5">
      <div class="mb-1">
        <span class="text-xs font-semibold uppercase tracking-wider text-base-content/50">Action</span>
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
              data-testid={testidActionItem}
              use:autoFocus
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
              data-testid={testidActionItem}
            >{#if action}{action}{:else}<span class="text-base-content/30 italic">click to add…</span>{/if}</button>
            <button class="btn btn-xs btn-ghost opacity-0 group-hover:opacity-100 transition-opacity" onclick={() => startEditAction(i)} aria-label="Edit step {i + 1}">✏</button>
            {#if actions.length > 1}
              <button class="btn btn-xs btn-ghost text-error opacity-0 group-hover:opacity-100 transition-opacity" onclick={() => removeAction(i)} data-testid="remove-action-btn">✕</button>
            {/if}
          {/if}
        </div>
      {/each}
      <button class="text-xs text-primary/70 hover:text-primary mt-1 transition-colors" onclick={addAction}>+ Add step</button>
    </div>
  </div>

  <!-- R — Result -->
  <div class="flex gap-4">
    <div class="flex flex-col items-center w-8 shrink-0">
      <div class="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center font-bold text-sm shrink-0">R</div>
    </div>
    <div class="flex-1">
      <div class="mb-1">
        <span class="text-xs font-semibold uppercase tracking-wider text-base-content/50">Result</span>
      </div>
      {#if editingField === 'result'}
        <textarea
          class="textarea textarea-bordered w-full h-24 resize-y text-sm"
          bind:value={fieldDraft}
          onkeydown={fieldKeydown}
          data-testid={testidResult}
          use:autoFocus
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
          data-testid={testidResult}
        >
          {#if result}{result}{:else}<span class="text-base-content/30 italic">click to add…</span>{/if}
        </button>
      {/if}
    </div>
  </div>

</div>
