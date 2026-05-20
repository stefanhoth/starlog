<script lang="ts">
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { navigate } from '../lib/stores/view';
  import { extractCompetencies, GeminiError } from '../lib/gemini';
  import JobProfileCard from '../lib/components/JobProfileCard.svelte';

  let showForm = $state(false);
  let company = $state('');
  let role = $state('');
  let jobDescription = $state('');
  let loading = $state(false);
  let errorMsg = $state('');

  async function createProfile() {
    if (!company.trim() || !role.trim() || !jobDescription.trim()) {
      errorMsg = 'Please fill in all fields.';
      return;
    }
    loading = true;
    errorMsg = '';
    try {
      const competencies = await extractCompetencies(jobDescription.trim());
      jobProfilesStore.addJobProfile({
        company: company.trim(),
        role: role.trim(),
        jobDescription: jobDescription.trim(),
        extractedCompetencies: competencies,
        competencyMap: {},
      });
      // Reset form
      company = ''; role = ''; jobDescription = '';
      showForm = false;
    } catch (err) {
      errorMsg = err instanceof GeminiError ? err.message : 'Something went wrong.';
    } finally {
      loading = false;
    }
  }

  function openProfile(id: string) {
    sessionStorage.setItem('starlog_active_profile', id);
    navigate('job-profile-detail');
  }
</script>

<div class="p-6" data-testid="job-profiles-view">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold">Job Profiles</h1>
    <button class="btn btn-primary btn-sm" onclick={() => showForm = !showForm} data-testid="new-profile-btn">
      + New Profile
    </button>
  </div>

  {#if showForm}
    <div class="card bg-base-200 p-6 mb-6" data-testid="profile-form">
      <div class="form-control gap-3">
        <input class="input input-bordered" placeholder="Company" bind:value={company} data-testid="profile-company" />
        <input class="input input-bordered" placeholder="Role title" bind:value={role} data-testid="profile-role" />
        <textarea
          class="textarea textarea-bordered h-40 resize-y"
          placeholder="Paste the job description here…"
          bind:value={jobDescription}
          data-testid="profile-jd"
        ></textarea>
        {#if errorMsg}
          <p class="text-error text-sm">{errorMsg}</p>
        {/if}
        <div class="flex gap-2">
          <button class="btn btn-primary flex-1" onclick={createProfile} disabled={loading} data-testid="profile-submit">
            {loading ? 'Extracting…' : 'Extract & Save'}
          </button>
          <button class="btn btn-ghost" onclick={() => showForm = false}>Cancel</button>
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center gap-3 text-base-content/60" data-testid="profile-loading">
      <span class="loading loading-spinner"></span>
      <span>Analysing job description…</span>
    </div>
  {/if}

  {#if $jobProfilesStore.length === 0 && !showForm}
    <div class="text-center py-16 text-base-content/40" data-testid="profiles-empty">
      <p class="text-lg font-medium">No job profiles yet</p>
      <p class="text-sm mt-1">Create one to track competency coverage for an application.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="profile-grid">
      {#each $jobProfilesStore as profile (profile.id)}
        <JobProfileCard {profile} onclick={() => openProfile(profile.id)} />
      {/each}
    </div>
  {/if}
</div>
