<script lang="ts">
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { storiesStore } from '../lib/stores/stories';
  import { activeProfileId, navigate } from '../lib/stores/view';
  import StoryMapModal from '../lib/components/StoryMapModal.svelte';
  import type { Story } from '../lib/types';

  const profile = $derived(
    $jobProfilesStore.find(p => p.id === $activeProfileId) ?? $jobProfilesStore[0] ?? null
  );

  const competencies = $derived(profile?.extractedCompetencies ?? []);

  const coveredCount = $derived(
    competencies.filter(c => (profile?.competencyMap[c] ?? []).length > 0).length
  );

  function goToStory(id: string): Story | undefined {
    return $storiesStore.find(s => s.id === id);
  }

  function startDraft(comp: string) {
    if (!profile) return;
    sessionStorage.setItem('starlog_gap_profile', profile.id);
    sessionStorage.setItem('starlog_gap_competency', comp);
    navigate('gap-fill');
  }

  function startInterview() {
    if (!profile) return;
    sessionStorage.setItem('starlog_active_profile', profile.id);
    sessionStorage.setItem('starlog_interview_mode', 'profile');
    sessionStorage.setItem('starlog_interview_submode', 'launch');
    navigate('interview');
  }

  // Map existing story modal
  let mapComp = $state<string | null>(null);

  function openMapModal(comp: string) {
    if (!profile) return;
    mapComp = comp;
  }

  function saveMapping(ids: string[]) {
    if (!profile || !mapComp) return;
    jobProfilesStore.updateJobProfile(profile.id, {
      competencyMap: { ...profile.competencyMap, [mapComp]: ids },
    });
    mapComp = null;
  }

  function reorderMapping(comp: string, fromIndex: number, toIndex: number) {
    if (!profile) return;
    const ids = [...(profile.competencyMap[comp] ?? [])];
    const [moved] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, moved);
    jobProfilesStore.updateJobProfile(profile.id, {
      competencyMap: { ...profile.competencyMap, [comp]: ids },
    });
  }

  // Expandable ranked list per competency
  let expandedComp = $state<string | null>(null);

  const isArchived = $derived(profile?.archivedAt != null);

  // Archive undo toast
  let undoToast = $state<{ id: string; label: string } | null>(null);
  let undoTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  function archiveJob() {
    if (!profile) return;
    const label = `${profile.role} at ${profile.company}`;
    const id = profile.id;
    jobProfilesStore.archiveJobProfile(id);
    undoToast = { id, label };
    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = setTimeout(() => { undoToast = null; }, 5000);
  }

  function undoArchive() {
    if (!undoToast) return;
    jobProfilesStore.reviveJobProfile(undoToast.id);
    if (undoTimer) clearTimeout(undoTimer);
    undoToast = null;
  }

  // Edit job profile modal
  type EditComp = { original: string; current: string };

  let editOpen = $state(false);
  let editRole = $state('');
  let editCompany = $state('');
  let editComps = $state<EditComp[]>([]);
  let newCompName = $state('');

  function openEdit() {
    if (!profile) return;
    editRole = profile.role;
    editCompany = profile.company;
    editComps = profile.extractedCompetencies.map(c => ({ original: c, current: c }));
    newCompName = '';
    editOpen = true;
  }

  function removeEditComp(idx: number) {
    editComps = editComps.filter((_, i) => i !== idx);
  }

  function addEditComp() {
    const name = newCompName.trim();
    if (!name) return;
    editComps = [...editComps, { original: '', current: name }];
    newCompName = '';
  }

  function saveEdit() {
    if (!profile) return;
    const newMap: Record<string, string[]> = {};
    for (const comp of editComps) {
      const name = comp.current.trim();
      if (!name) continue;
      newMap[name] = profile.competencyMap[comp.original] ?? [];
    }
    jobProfilesStore.updateJobProfile(profile.id, {
      role: editRole.trim() || profile.role,
      company: editCompany.trim() || profile.company,
      extractedCompetencies: editComps.map(c => c.current.trim()).filter(Boolean),
      competencyMap: newMap,
    });
    editOpen = false;
  }
</script>

<div class="p-6 max-w-2xl mx-auto" data-testid="job-hub-view">

  <!-- Header -->
  <div class="flex items-start justify-between mb-6">
    <div>
      {#if profile}
        <h1 class="text-2xl font-bold">{profile.role}</h1>
        <p class="text-base-content/50 text-sm mt-0.5">{profile.company}</p>
      {:else}
        <h1 class="text-2xl font-bold">No job selected</h1>
        <p class="text-base-content/50 text-sm mt-0.5">Add a job from the sidebar to get started.</p>
      {/if}
    </div>
    <div class="flex items-start gap-2 shrink-0 ml-4">
      {#if profile && !isArchived}
        <button
          class="btn btn-ghost btn-sm"
          onclick={openEdit}
          data-testid="edit-job-btn"
        >
          ✎ Edit job
        </button>
        <button
          class="btn btn-ghost btn-sm text-base-content/40 hover:text-base-content"
          onclick={archiveJob}
          aria-label="Archive {profile.role} at {profile.company}"
          data-testid="archive-job-btn"
        >
          Archive
        </button>
      {/if}
      {#if profile && competencies.length > 0}
        <div class="text-right">
          <span class="text-3xl font-bold {coveredCount === competencies.length ? 'text-success' : coveredCount > 0 ? 'text-warning' : 'text-error'}">
            {coveredCount}/{competencies.length}
          </span>
          <p class="text-xs text-base-content/40 mt-0.5">competencies covered</p>
        </div>
      {/if}
    </div>
  </div>

  {#if !profile}
    <div class="flex flex-col items-center justify-center gap-4 py-24 text-base-content/40" data-testid="profiles-empty">
      <span class="text-5xl">💼</span>
      <button class="btn btn-primary" onclick={() => navigate('add-job')}>Add your first job</button>
    </div>
  {:else if isArchived}
    <div class="rounded-xl border border-base-300 bg-base-200/60 px-5 py-6 flex flex-col gap-3" data-testid="archived-banner">
      <p class="text-base-content/50 text-sm">This job profile is archived. The competency mappings are preserved.</p>
      <button
        class="btn btn-sm btn-outline w-fit"
        onclick={() => jobProfilesStore.reviveJobProfile(profile!.id)}
        data-testid="revive-job-btn"
      >
        ↩ Revive job
      </button>
    </div>
  {:else if competencies.length === 0}
    <div class="alert alert-info text-sm">
      <span>No competencies extracted yet. Try re-adding the job with a full job description.</span>
    </div>
  {:else}

    <!-- Competency list -->
    <div class="flex flex-col gap-2 mb-6">
      {#each competencies as comp}
        {@const mappedIds = profile.competencyMap[comp] ?? []}
        {@const isCovered = mappedIds.length > 0}
        {@const goToStoryObj = isCovered ? goToStory(mappedIds[0]) : null}
        {@const backupCount = mappedIds.length - 1}

        <div
          class="rounded-xl border px-4 py-3 transition-colors
            {isCovered
              ? 'border-base-300 bg-base-100'
              : 'border-warning/40 bg-warning/5 border-dashed'}"
          data-testid="competency-row"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              {#if isCovered}
                <span class="text-success font-bold shrink-0">✓</span>
              {:else}
                <span class="w-4 h-4 rounded-full border-2 border-warning/50 shrink-0 inline-block"></span>
              {/if}

              <div class="min-w-0">
                <span class="font-medium text-sm">{comp}</span>
                {#if isCovered && goToStoryObj}
                  <div class="flex items-center gap-1 mt-0.5">
                    <span class="text-primary text-xs">★</span>
                    <span class="text-xs text-base-content/60 truncate">{goToStoryObj.title}</span>
                    {#if backupCount > 0}
                      <span class="text-xs text-base-content/30">· {backupCount} backup{backupCount > 1 ? 's' : ''}</span>
                    {/if}
                  </div>
                {:else if !isCovered}
                  <p class="text-xs text-warning/70 mt-0.5">no story yet</p>
                {/if}
              </div>
            </div>

            <div class="flex gap-1.5 shrink-0">
              {#if isCovered}
                <button
                  class="btn btn-xs btn-ghost text-base-content/40"
                  onclick={() => expandedComp = expandedComp === comp ? null : comp}
                >
                  {expandedComp === comp ? '▲' : '▼'}
                </button>
                <button
                  class="btn btn-xs btn-ghost"
                  onclick={() => openMapModal(comp)}
                  data-testid="edit-mapping-btn"
                >
                  edit
                </button>
              {:else}
                <button
                  class="btn btn-xs btn-warning btn-outline"
                  onclick={() => startDraft(comp)}
                  data-testid="draft-btn"
                >
                  + draft
                </button>
                <button
                  class="btn btn-xs btn-ghost"
                  onclick={() => openMapModal(comp)}
                  data-testid="map-existing-btn"
                >
                  map existing
                </button>
              {/if}
            </div>
          </div>

          <!-- Expanded ranked list -->
          {#if expandedComp === comp && mappedIds.length > 0}
            <div class="mt-3 pt-3 border-t border-base-200 flex flex-col gap-1.5">
              {#each mappedIds as id, i}
                {@const s = goToStory(id)}
                {#if s}
                  <div class="flex items-center justify-between text-xs">
                    <span class="flex items-center gap-1.5">
                      {#if i === 0}
                        <span class="text-primary">★</span>
                        <span class="font-medium">{s.title}</span>
                      {:else}
                        <span class="text-base-content/30">#{i + 1}</span>
                        <span class="text-base-content/60">{s.title}</span>
                      {/if}
                    </span>
                    {#if mappedIds.length > 1}
                      <div class="flex gap-0.5 shrink-0">
                        {#if i > 0}
                          <button class="btn btn-ghost btn-xs px-1 h-5 min-h-0" onclick={() => reorderMapping(comp, i, i - 1)} title="Move up">↑</button>
                        {/if}
                        {#if i < mappedIds.length - 1}
                          <button class="btn btn-ghost btn-xs px-1 h-5 min-h-0" onclick={() => reorderMapping(comp, i, i + 1)} title="Move down">↓</button>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- CTA -->
    {#if coveredCount > 0}
      <div class="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-center justify-between">
        <div>
          <p class="font-medium text-sm">Ready to rehearse?</p>
          <p class="text-xs text-base-content/50 mt-0.5">{coveredCount} of {competencies.length} competencies have a story</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick={startInterview} data-testid="start-interview-btn">
          Start interview prep →
        </button>
      </div>
    {/if}

  {/if}
</div>

<!-- Undo archive toast -->
{#if undoToast}
  <div
    class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-base-content text-base-100 rounded-xl px-4 py-3 shadow-xl text-sm"
    role="status"
    data-testid="undo-toast"
  >
    <span>"{undoToast.label}" archived</span>
    <button class="btn btn-xs btn-ghost text-base-100 hover:bg-base-100/20" onclick={undoArchive} data-testid="undo-btn">
      Undo
    </button>
  </div>
{/if}

<!-- Edit job profile modal -->
{#if editOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-job-title"
    tabindex="-1"
    onkeydown={(e) => e.key === 'Escape' && (editOpen = false)}
    onclick={(e) => e.target === e.currentTarget && (editOpen = false)}
  >
    <div class="bg-base-100 rounded-2xl shadow-xl w-full max-w-md p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
      <h3 id="edit-job-title" class="font-semibold text-base">Edit job profile</h3>

      <!-- Role + Company -->
      <div class="flex flex-col gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-xs font-medium text-base-content/60">Role title</span>
          <input
            class="input input-bordered input-sm w-full"
            type="text"
            bind:value={editRole}
            data-testid="edit-role-input"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs font-medium text-base-content/60">Company</span>
          <input
            class="input input-bordered input-sm w-full"
            type="text"
            bind:value={editCompany}
            data-testid="edit-company-input"
          />
        </label>
      </div>

      <!-- Competencies -->
      <div class="flex flex-col gap-2">
        <span class="text-xs font-medium text-base-content/60">Competencies</span>
        <div class="flex flex-col gap-1.5" data-testid="edit-competency-list">
          {#each editComps as comp, idx}
            <div class="flex items-center gap-2">
              <input
                class="input input-bordered input-sm flex-1 min-w-0"
                type="text"
                bind:value={comp.current}
                data-testid="edit-comp-input"
              />
              <button
                class="btn btn-ghost btn-sm btn-square text-error/60 hover:text-error"
                onclick={() => removeEditComp(idx)}
                aria-label="Remove competency"
                data-testid="remove-comp-btn"
              >
                ✕
              </button>
            </div>
          {/each}
        </div>

        <!-- Add competency -->
        <div class="flex items-center gap-2 mt-1">
          <input
            class="input input-bordered input-sm flex-1 min-w-0"
            type="text"
            placeholder="Add competency…"
            bind:value={newCompName}
            onkeydown={(e) => e.key === 'Enter' && addEditComp()}
            data-testid="add-comp-input"
          />
          <button
            class="btn btn-ghost btn-sm"
            onclick={addEditComp}
            data-testid="add-comp-btn"
          >
            + Add
          </button>
        </div>
      </div>

      <div class="flex gap-2 pt-1">
        <button class="btn btn-primary flex-1 btn-sm" onclick={saveEdit} data-testid="save-edit-btn">Save</button>
        <button class="btn btn-ghost btn-sm" onclick={() => editOpen = false} data-testid="cancel-edit-btn">Cancel</button>
      </div>
    </div>
  </div>
{/if}

<!-- Story map modal -->
{#if mapComp !== null && profile}
  <StoryMapModal
    comp={mapComp}
    initialIds={profile.competencyMap[mapComp] ?? []}
    onSave={saveMapping}
    onCancel={() => mapComp = null}
  />
{/if}
