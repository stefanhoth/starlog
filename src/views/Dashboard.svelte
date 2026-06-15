<script lang="ts">
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { navigate, openJob } from '../lib/stores/view';
  import { coverageCounts, coveragePct } from '../lib/coverage';
  import { relativeTime, absoluteDate } from '../lib/relativeTime';
  import type { JobProfile } from '../lib/types';

  // Active (non-archived) jobs, most-recently-edited first.
  const jobs = $derived(
    $jobProfilesStore
      .filter((p: JobProfile) => !p.archivedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );
</script>

<div class="p-6 max-w-2xl mx-auto" data-testid="dashboard-view">
  <div class="mb-6">
    <h1 class="text-2xl font-bold">Jobs overview</h1>
    <p class="text-base-content/50 text-sm mt-0.5">
      {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
    </p>
  </div>

  {#if jobs.length === 0}
    <div class="flex flex-col items-center justify-center gap-4 py-24 text-base-content/40" data-testid="dashboard-empty">
      <span class="text-5xl">💼</span>
      <p class="text-lg font-medium">No jobs yet</p>
      <button class="btn btn-primary" onclick={() => navigate('add-job')} data-testid="dashboard-add-job">Add your first job</button>
    </div>
  {:else}
    <div class="flex flex-col gap-3">
      {#each jobs as job (job.id)}
        {@const pct = coveragePct(job)}
        {@const counts = coverageCounts(job)}
        <div class="card bg-base-100 border border-base-300" data-testid="dashboard-job-card">
          <div class="card-body p-4 gap-3">
            <!-- Title + last edited -->
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-semibold truncate" data-testid="dashboard-job-role">{job.role}</p>
                <p class="text-xs text-base-content/50 truncate">{job.company}</p>
              </div>
              <time
                class="text-xs text-base-content/50 shrink-0 whitespace-nowrap"
                datetime={job.updatedAt}
                title={absoluteDate(job.updatedAt)}
                data-testid="dashboard-job-edited"
              >{relativeTime(job.updatedAt)}</time>
            </div>

            <!-- Coverage -->
            <div class="flex items-center gap-3">
<!-- Native <progress> already exposes the progressbar role + value to AT. -->
              <progress
                class="progress progress-primary flex-1"
                value={pct}
                max="100"
                aria-label="{job.role} at {job.company}: {pct}% covered"
              ></progress>
              <span class="text-xs text-base-content/60 shrink-0 whitespace-nowrap" data-testid="dashboard-job-coverage">
                {counts.covered} / {counts.total} covered ({pct}%)
              </span>
            </div>

            <!-- Quick action -->
            {#if pct < 100}
              <div class="flex justify-end">
                <button
                  class="btn btn-sm btn-primary btn-outline"
                  onclick={() => openJob(job.id)}
                  data-testid="dashboard-continue-mapping"
                >Continue mapping →</button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
