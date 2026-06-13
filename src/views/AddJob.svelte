<script lang="ts">
  import { settingsStore } from '../lib/stores/settings';
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { navigate, openJob } from '../lib/stores/view';
  import { dispatchExtractCompetencies, GeminiError } from '../lib/ai-dispatch';
  import AiWorking from '../lib/components/AiWorking.svelte';

  // Whether this is the first job (post-onboarding flow) or an additional job.
  // Inferred from the store so no prop is needed — avoids threading addJobMode through App.
  const isFirstJob = $derived($jobProfilesStore.length === 0);

  let step = $state<'job-entry' | 'job-review'>('job-entry');

  // ── Step 1: Job entry ──────────────────────────────────────────────
  let jobDescription = $state('');
  let jobTitle = $state('');
  let jobCompany = $state('');
  let extracting = $state(false);
  let extractError = $state('');
  let extractedComps = $state<string[]>([]);

  async function extractJob() {
    if (!jobDescription.trim()) return;
    extracting = true;
    extractError = '';
    try {
      const comps = await dispatchExtractCompetencies(jobDescription.trim());
      extractedComps = comps;
      step = 'job-review';
    } catch (err) {
      extractError = err instanceof GeminiError ? err.message : 'Extraction failed. Try again.';
    } finally {
      extracting = false;
    }
  }

  // ── Step 2: Review & save ──────────────────────────────────────────
  let editableComps = $state<string[]>([]);
  let newComp = $state('');

  $effect(() => {
    if (extractedComps.length > 0) editableComps = [...extractedComps];
  });

  function removeComp(c: string) {
    editableComps = editableComps.filter(x => x !== c);
  }

  function addComp() {
    const trimmed = newComp.trim();
    if (trimmed && !editableComps.includes(trimmed)) {
      editableComps = [...editableComps, trimmed];
    }
    newComp = '';
  }

  function saveJob() {
    const profile = jobProfilesStore.addJobProfile({
      company: jobCompany.trim() || 'Unknown company',
      role: jobTitle.trim() || 'Unknown role',
      jobDescription: jobDescription.trim(),
      extractedCompetencies: editableComps,
      competencyMap: {},
    });
    openJob(profile.id);
  }

  function skipOrCancel() {
    if ($jobProfilesStore.length > 0) {
      navigate('job-hub');
    } else {
      navigate('story-bank');
    }
  }
</script>

{#if step === 'job-entry'}

  <div class="min-h-full flex items-center justify-center p-6">
    <div class="w-full max-w-xl flex flex-col gap-6">

      {#if isFirstJob}
        <div class="flex items-center gap-2 text-sm text-base-content/50">
          <span class="w-5 h-5 rounded-full bg-success text-success-content text-xs flex items-center justify-center font-bold">✓</span>
          <span class="text-success text-xs">{$settingsStore.aiProvider === 'local' ? 'Local AI ready' : 'API key connected'}</span>
          <span class="text-base-content/20 mx-1">·</span>
          <span class="w-5 h-5 rounded-full bg-primary text-primary-content text-xs flex items-center justify-center font-bold">2</span>
          <span class="font-medium text-base-content">Add a job</span>
        </div>
      {/if}

      <div>
        <h1 class="text-2xl font-bold">What are you interviewing for?</h1>
        <p class="text-base-content/60 text-sm mt-1">
          Paste the job description — AI extracts the 5–7 competencies they'll interview you on.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="form-control">
          <label class="label py-0.5" for="job-role"><span class="label-text text-xs">Role title</span></label>
          <input
            id="job-role"
            class="input input-bordered input-sm"
            placeholder="Director of Engineering"
            bind:value={jobTitle}
            data-testid="profile-role"
          />
        </div>
        <div class="form-control">
          <label class="label py-0.5" for="job-company"><span class="label-text text-xs">Company</span></label>
          <input
            id="job-company"
            class="input input-bordered input-sm"
            placeholder="Acme Corp"
            bind:value={jobCompany}
            data-testid="profile-company"
          />
        </div>
      </div>

      <div class="form-control">
        <label class="label py-0.5" for="jd-text"><span class="label-text text-xs">Job description</span></label>
        <textarea
          id="jd-text"
          class="textarea textarea-bordered h-48 resize-y"
          placeholder="Paste the full job description here…"
          bind:value={jobDescription}
          data-testid="profile-jd"
        ></textarea>
      </div>

      {#if extractError}
        <div class="alert alert-error text-sm">{extractError}</div>
      {/if}

      <div class="flex gap-3">
        <AiWorking active={extracting} class="flex-1">
          <button
            class="btn btn-primary w-full"
            onclick={extractJob}
            disabled={!jobDescription.trim() || extracting}
            data-testid="profile-submit"
          >
            {extracting ? 'Extracting competencies…' : 'Extract competencies →'}
          </button>
        </AiWorking>
        <button class="btn btn-ghost" onclick={skipOrCancel}>
          {$jobProfilesStore.length > 0 ? 'Cancel' : 'Skip'}
        </button>
      </div>
      <span class="badge badge-sm badge-ghost text-base-content/40 self-end" data-testid="ai-mode-indicator">
        {$settingsStore.aiProvider === 'local' ? '🔒 Local AI' : '☁️ Cloud AI'}
      </span>

    </div>
  </div>

{:else if step === 'job-review'}

  <div class="min-h-full flex items-center justify-center p-6">
    <div class="w-full max-w-xl flex flex-col gap-6">

      <div class="flex items-center gap-2 text-sm text-base-content/50">
        <button class="hover:text-base-content transition-colors" onclick={() => step = 'job-entry'}>← Back</button>
      </div>

      <div>
        <h1 class="text-2xl font-bold">Review competencies</h1>
        <p class="text-base-content/60 text-sm mt-1">
          These are what {jobTitle || 'this role'} at {jobCompany || 'this company'} will likely interview you on.
          Edit before saving.
        </p>
      </div>

      <div class="flex flex-col gap-2">
        {#each editableComps as comp}
          <div class="flex items-center justify-between px-4 py-2.5 border border-base-300 rounded-lg bg-base-100">
            <div class="flex items-center gap-2">
              <span class="text-success text-sm">✓</span>
              <span class="font-medium text-sm">{comp}</span>
            </div>
            <button
              class="btn btn-xs btn-ghost text-base-content/40 hover:text-error"
              onclick={() => removeComp(comp)}
              aria-label="Remove {comp}"
            >✕</button>
          </div>
        {/each}

        <div class="flex gap-2">
          <input
            class="input input-bordered input-sm flex-1"
            placeholder="Add a competency I missed…"
            bind:value={newComp}
            onkeydown={(e) => e.key === 'Enter' && addComp()}
          />
          <button class="btn btn-sm btn-ghost" onclick={addComp} disabled={!newComp.trim()}>+ Add</button>
        </div>
      </div>

      <div class="flex gap-3">
        <button
          class="btn btn-primary flex-1"
          onclick={saveJob}
          disabled={editableComps.length === 0}
          data-testid="profile-save"
        >
          Save · open job hub →
        </button>
      </div>

    </div>
  </div>

{/if}
