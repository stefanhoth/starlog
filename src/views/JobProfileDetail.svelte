<script lang="ts">
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { storiesStore } from '../lib/stores/stories';
  import { navigate } from '../lib/stores/view';
  import { extractCompetencies, GeminiError } from '../lib/gemini';
  import StoryPicker from '../lib/components/StoryPicker.svelte';

  const profileId = sessionStorage.getItem('starlog_active_profile') ?? '';
  let profile = $derived($jobProfilesStore.find(p => p.id === profileId));

  $effect(() => { if (!profile) navigate('job-profiles'); });

  let expandedCompetency = $state<string | null>(null);
  let reextracting = $state(false);
  let reextractError = $state('');
  let showReconcile = $state(false);
  let orphanedCompetencies = $state<string[]>([]);

  function coverageIcon(competency: string): string {
    const ids = profile?.competencyMap[competency] ?? [];
    return ids.length > 0 ? '🟢' : '🔴';
  }

  function togglePicker(competency: string) {
    expandedCompetency = expandedCompetency === competency ? null : competency;
  }

  function updateMap(competency: string, ids: string[]) {
    if (!profile) return;
    const newMap = { ...profile.competencyMap, [competency]: ids };
    jobProfilesStore.updateJobProfile(profileId, { competencyMap: newMap });
  }

  async function reextract() {
    if (!profile) return;
    reextracting = true;
    reextractError = '';
    try {
      const newCompetencies = await extractCompetencies(profile.jobDescription);
      // Find orphaned mappings
      const orphans = Object.keys(profile.competencyMap).filter(
        c => profile!.competencyMap[c].length > 0 && !newCompetencies.includes(c)
      );
      jobProfilesStore.updateJobProfile(profileId, { extractedCompetencies: newCompetencies });
      if (orphans.length > 0) {
        orphanedCompetencies = orphans;
        showReconcile = true;
      }
    } catch (err) {
      reextractError = err instanceof GeminiError ? err.message : 'Re-extraction failed.';
    } finally {
      reextracting = false;
    }
  }

  function removeOrphanMapping(competency: string) {
    if (!profile) return;
    const newMap = { ...profile.competencyMap };
    delete newMap[competency];
    jobProfilesStore.updateJobProfile(profileId, { competencyMap: newMap });
    orphanedCompetencies = orphanedCompetencies.filter(c => c !== competency);
    if (orphanedCompetencies.length === 0) showReconcile = false;
  }

  function dismissReconcile() {
    orphanedCompetencies = [];
    showReconcile = false;
  }

  function startInterview() {
    sessionStorage.setItem('starlog_interview_mode', 'profile');
    // starlog_active_profile is already set
    navigate('interview');
  }

  const hasMappedStories = $derived(
    profile ? Object.values(profile.competencyMap).some(ids => ids.length > 0) : false
  );
</script>

<div class="p-6 max-w-2xl mx-auto" data-testid="job-profile-detail-view">
  <div class="flex items-center gap-2 mb-4">
    <button class="btn btn-ghost btn-sm" onclick={() => navigate('job-profiles')}>← Back</button>
  </div>

  {#if profile}
    <h1 class="text-2xl font-bold">{profile.company}</h1>
    <p class="text-base-content/60 mb-6">{profile.role}</p>

    <!-- Re-extract -->
    <div class="flex items-center gap-2 mb-6">
      <button
        class="btn btn-sm btn-outline"
        onclick={reextract}
        disabled={reextracting}
        data-testid="reextract-btn"
      >
        {reextracting ? 'Re-extracting…' : '↺ Re-extract competencies'}
      </button>
      <button class="btn btn-sm btn-ghost" onclick={() => window.print()} data-testid="print-btn">
        🖨️ Print cheat sheet
      </button>
      {#if hasMappedStories}
        <button class="btn btn-sm btn-outline" onclick={startInterview} data-testid="profile-interview-btn">
          🎤 Interview
        </button>
      {/if}
    </div>

    {#if reextractError}
      <div class="alert alert-error text-sm mb-4">{reextractError}</div>
    {/if}

    <!-- Reconciliation modal -->
    {#if showReconcile}
      <div class="modal modal-open" data-testid="reconcile-modal">
        <div class="modal-box">
          <h3 class="font-bold">Competencies removed</h3>
          <p class="text-sm text-base-content/60 mt-1">These competencies are no longer in the extracted list but have stories mapped:</p>
          <ul class="mt-3 space-y-2">
            {#each orphanedCompetencies as c}
              <li class="flex items-center justify-between">
                <span class="badge badge-warning">{c}</span>
                <button class="btn btn-xs btn-error btn-outline" onclick={() => removeOrphanMapping(c)} data-testid="orphan-remove">Remove mapping</button>
              </li>
            {/each}
          </ul>
          <div class="modal-action">
            <button class="btn btn-ghost btn-sm" onclick={dismissReconcile}>Keep anyway</button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Coverage matrix -->
    <div class="space-y-2" data-testid="coverage-matrix">
      {#each profile.extractedCompetencies as competency}
        {@const mappedIds = profile.competencyMap[competency] ?? []}
        <div class="border border-base-300 rounded-lg overflow-hidden" data-testid="coverage-row">
          <button
            class="w-full flex items-center justify-between p-3 hover:bg-base-200 text-left"
            onclick={() => togglePicker(competency)}
            data-testid="coverage-competency-btn"
          >
            <span class="font-medium text-sm">{competency}</span>
            <div class="flex items-center gap-2">
              <span class="text-xs text-base-content/50">{mappedIds.length} stor{mappedIds.length === 1 ? 'y' : 'ies'}</span>
              <span>{coverageIcon(competency)}</span>
            </div>
          </button>

          {#if expandedCompetency === competency}
            <div class="border-t border-base-300 p-3 bg-base-50">
              <StoryPicker
                selectedIds={mappedIds}
                onchange={(ids) => updateMap(competency, ids)}
              />
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Print view -->
    <div class="print-only hidden">
      <h1>{profile.company} — {profile.role}</h1>
      {#each profile.extractedCompetencies as competency}
        {@const ids = profile.competencyMap[competency] ?? []}
        {#if ids.length > 0}
          <section class="page-break-before">
            <h2>{competency}</h2>
            {#each ids as storyId}
              {@const story = $storiesStore.find(s => s.id === storyId)}
              {#if story}
                <h3>{story.title}</h3>
                <p><strong>S:</strong> {story.star.situation}</p>
                <p><strong>T:</strong> {story.star.task}</p>
                <ul>{#each story.star.action as a}<li>{a}</li>{/each}</ul>
                <p><strong>R:</strong> {story.star.result}</p>
              {/if}
            {/each}
          </section>
        {/if}
      {/each}
    </div>
  {/if}
</div>
