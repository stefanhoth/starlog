<script lang="ts">
  import { storiesStore } from '../lib/stores/stories';
  import { navigate } from '../lib/stores/view';
  import { COMPETENCIES } from '../lib/competencies';
  import type { Story } from '../lib/types';

  const QUALITY_ICON: Record<string, string> = { high: '🟢', medium: '🟡', low: '🔴' };

  const STRENGTH_STATES = [
    { rank: 1, label: 'thin',  dot: 'bg-red-400    border-red-400'    },
    { rank: 3, label: 'ok',    dot: 'bg-amber-400  border-amber-400'  },
    { rank: 5, label: 'great', dot: 'bg-emerald-400 border-emerald-400' },
  ];

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
  let rank      = $state(original?.rank ?? 3);
  let quality   = $state({ ...(original?.quality ?? { situation: 'medium', task: 'medium', action: 'medium', result: 'medium', notes: '' }) });
  let showTagPicker    = $state(false);
  let showDeleteConfirm = $state(false);
  let editingField     = $state<string | null>(null);
  let editingActionIdx = $state<number | null>(null);

  const activeStrengthIdx = $derived(rank <= 2 ? 0 : rank <= 4 ? 1 : 2);

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

  <!-- Breadcrumb + actions row -->
  <div class="flex items-start justify-between mb-4 gap-2">
    <div class="flex items-center gap-1.5 text-sm text-base-content/50 flex-wrap min-w-0">
      <button class="hover:text-base-content transition-colors shrink-0" onclick={() => navigate('story-bank')}>← Story bank</button>
      <span>›</span>
      <span class="truncate min-w-0">{title.length > 32 ? title.slice(0, 32) + '…' : title}</span>
    </div>
    <div class="flex gap-2 shrink-0">
      <button class="btn btn-error btn-sm btn-outline" onclick={() => showDeleteConfirm = true} data-testid="delete-btn">Delete</button>
      <button class="btn btn-primary btn-sm" onclick={save} data-testid="save-btn">Save</button>
    </div>
  </div>

  <!-- Title -->
  <h2 class="text-2xl font-bold mb-1" data-testid="detail-title">{title || 'Untitled Story'}</h2>
  <p class="text-sm text-base-content/40 mb-4">
    <button class="hover:text-base-content transition-colors">✏ edit</button>
  </p>

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
        <textarea
          class="w-full resize-none rounded leading-relaxed transition-colors duration-100
                 {editingField === 'situation'
                   ? 'textarea textarea-bordered h-24 resize-y'
                   : 'border-0 bg-transparent cursor-text hover:bg-base-200/60 p-1 outline-none text-base'}"
          style={editingField !== 'situation' ? 'field-sizing: content' : ''}
          value={situation}
          oninput={(e) => situation = (e.target as HTMLTextAreaElement).value}
          onfocus={() => editingField = 'situation'}
          onblur={() => { editingField = null; save(); }}
          onkeydown={(e) => { if (e.key === 'Escape') (e.target as HTMLElement).blur(); }}
          data-testid="detail-situation"
        ></textarea>
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
        <textarea
          class="w-full resize-none rounded leading-relaxed transition-colors duration-100
                 {editingField === 'task'
                   ? 'textarea textarea-bordered h-24 resize-y'
                   : 'border-0 bg-transparent cursor-text hover:bg-base-200/60 p-1 outline-none text-base'}"
          style={editingField !== 'task' ? 'field-sizing: content' : ''}
          value={task}
          oninput={(e) => task = (e.target as HTMLTextAreaElement).value}
          onfocus={() => editingField = 'task'}
          onblur={() => { editingField = null; save(); }}
          onkeydown={(e) => { if (e.key === 'Escape') (e.target as HTMLElement).blur(); }}
          data-testid="detail-task"
        ></textarea>
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
    </div>

    <!-- R — Result (last — no line below) -->
    <div class="flex gap-4">
      <div class="flex flex-col items-center w-8 shrink-0">
        <div class="w-8 h-8 rounded-full bg-base-200 text-base-content flex items-center justify-center font-bold text-sm shrink-0">R</div>
      </div>
      <div class="flex-1">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-semibold uppercase tracking-wider text-base-content/50">Result</span>
          <span class="text-xs">{QUALITY_ICON[quality.result]}</span>
        </div>
        <textarea
          class="w-full resize-none rounded leading-relaxed transition-colors duration-100
                 {editingField === 'result'
                   ? 'textarea textarea-bordered h-24 resize-y'
                   : 'border-0 bg-transparent cursor-text hover:bg-base-200/60 p-1 outline-none text-base'}"
          style={editingField !== 'result' ? 'field-sizing: content' : ''}
          value={result}
          oninput={(e) => result = (e.target as HTMLTextAreaElement).value}
          onfocus={() => editingField = 'result'}
          onblur={() => { editingField = null; save(); }}
          onkeydown={(e) => { if (e.key === 'Escape') (e.target as HTMLElement).blur(); }}
          data-testid="detail-result"
        ></textarea>
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

  {#if quality.notes}
    <div class="alert alert-info text-sm mb-4"><span>💡 {quality.notes}</span></div>
  {/if}

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
