<script lang="ts">
  import type { JobProfile } from '../types';
  let { profile, onclick }: { profile: JobProfile; onclick: () => void } = $props();
</script>

<div
  class="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow cursor-pointer"
  onclick={onclick}
  role="button"
  tabindex="0"
  onkeydown={(e) => e.key === 'Enter' && onclick()}
  data-testid="job-profile-card"
>
  <div class="card-body p-4 gap-2">
    <h3 class="font-semibold">{profile.company}</h3>
    <p class="text-sm text-base-content/60">{profile.role}</p>
    <div class="flex flex-wrap gap-1 mt-1">
      {#each profile.extractedCompetencies as c}
        <span class="badge badge-sm badge-outline">{c}</span>
      {/each}
    </div>
  </div>
</div>
