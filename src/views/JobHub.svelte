<script lang="ts">
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { storiesStore } from '../lib/stores/stories';
  import { activeProfileId, navigate } from '../lib/stores/view';
  import StoryPicker from '../lib/components/StoryPicker.svelte';
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
  let mapSelected = $state<string[]>([]);

  function openMapModal(comp: string) {
    if (!profile) return;
    mapComp = comp;
    mapSelected = [...(profile.competencyMap[comp] ?? [])];
  }

  function saveMapping() {
    if (!profile || !mapComp) return;
    jobProfilesStore.updateJobProfile(profile.id, {
      competencyMap: { ...profile.competencyMap, [mapComp]: mapSelected },
    });
    mapComp = null;
  }

  // Expandable ranked list per competency
  let expandedComp = $state<string | null>(null);
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
    {#if profile && competencies.length > 0}
      <div class="text-right shrink-0 ml-4">
        <span class="text-3xl font-bold {coveredCount === competencies.length ? 'text-success' : coveredCount > 0 ? 'text-warning' : 'text-error'}">
          {coveredCount}/{competencies.length}
        </span>
        <p class="text-xs text-base-content/40 mt-0.5">competencies covered</p>
      </div>
    {/if}
  </div>

  {#if !profile}
    <div class="flex flex-col items-center justify-center gap-4 py-24 text-base-content/40">
      <span class="text-5xl">💼</span>
      <button class="btn btn-primary" onclick={() => navigate('add-job')}>Add your first job</button>
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

<!-- Map existing modal -->
{#if mapComp !== null}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onkeydown={(e) => e.key === 'Escape' && (mapComp = null)}
  >
    <div class="bg-base-100 rounded-2xl shadow-xl w-full max-w-sm p-5 flex flex-col gap-4">
      <div>
        <h3 class="font-semibold text-base">Map stories to <em class="not-italic text-primary">{mapComp}</em></h3>
        <p class="text-xs text-base-content/50 mt-0.5">First selected = go-to answer. Others = backups.</p>
      </div>
      <StoryPicker selectedIds={mapSelected} onchange={(ids) => mapSelected = ids} />
      <div class="flex gap-2">
        <button class="btn btn-primary flex-1 btn-sm" onclick={saveMapping}>Save</button>
        <button class="btn btn-ghost btn-sm" onclick={() => mapComp = null}>Cancel</button>
      </div>
    </div>
  </div>
{/if}
