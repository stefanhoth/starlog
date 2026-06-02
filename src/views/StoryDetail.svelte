<script lang="ts">
  import { storiesStore } from '../lib/stores/stories';
  import { navigate } from '../lib/stores/view';
  import { COMPETENCIES } from '../lib/competencies';
  import StarEditor from '../lib/components/StarEditor.svelte';
  import type { StoryQuality } from '../lib/types';

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
  const DEFAULT_QUALITY: StoryQuality = { situation: 'medium', task: 'medium', action: 'medium', result: 'medium', notes: '' };
  let quality   = $state<StoryQuality>({ ...(original?.quality ?? DEFAULT_QUALITY) });
  let showTagPicker     = $state(false);
  let showDeleteConfirm = $state(false);
  let starEditor: { commitPending: () => void } | undefined = $state();

  // ── Title click-to-edit ───────────────────────────────────────────────
  let editingTitle = $state(false);
  let titleDraft   = $state('');

  function startEditTitle() { editingTitle = true; titleDraft = title; }
  function commitTitle() { title = titleDraft; editingTitle = false; save(); }
  function cancelTitle() { editingTitle = false; }

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
      <button class="btn btn-primary btn-sm" onclick={() => { if (editingTitle) commitTitle(); else { starEditor?.commitPending(); save(); navigate('story-bank'); } }} data-testid="save-btn">Save</button>
    </div>
  </div>

  <!-- Title -->
  {#if editingTitle}
    <div class="mb-4">
      <input
        class="input input-bordered w-full text-2xl font-bold"
        bind:value={titleDraft}
        onkeydown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') cancelTitle(); }}
        data-testid="detail-title-input"
      />
      <div class="flex justify-end gap-1 mt-1">
        <button class="btn btn-xs btn-ghost" onclick={cancelTitle}>esc</button>
        <button class="btn btn-xs btn-primary" onclick={commitTitle}>✓ save</button>
      </div>
    </div>
  {:else}
    <div class="flex items-baseline gap-2 mb-4">
      <h2 class="text-2xl font-bold" data-testid="detail-title">{title || 'Untitled Story'}</h2>
      <button class="text-xs text-base-content/40 hover:text-base-content transition-colors" onclick={startEditTitle}>✏ edit</button>
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

  <StarEditor
    bind:this={starEditor}
    bind:situation
    bind:task
    bind:actions
    bind:result
    bind:rank
    {quality}
    oncommit={save}
    testidSituation="detail-situation"
    testidTask="detail-task"
    testidResult="detail-result"
    testidActionItem="detail-action-item"
  />

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
