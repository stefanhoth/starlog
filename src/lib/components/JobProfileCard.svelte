<script lang="ts">
  import type { JobProfile } from '../types';
  let {
    profile,
    onclick,
    onrevive,
  }: {
    profile: JobProfile;
    onclick: () => void;
    onrevive?: () => void;
  } = $props();

  const archived = $derived(profile.archivedAt != null);
</script>

<div
  class="card bg-base-100 border border-base-300 transition-shadow {archived ? 'opacity-60' : 'hover:shadow-md cursor-pointer'}"
  onclick={!archived ? onclick : undefined}
  role={!archived ? 'button' : undefined}
  tabindex={!archived ? 0 : undefined}
  onkeydown={!archived ? (e) => e.key === 'Enter' && onclick() : undefined}
  data-testid="job-profile-card"
>
  <div class="card-body p-4 gap-2">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h3 class="font-semibold">{profile.company}</h3>
        <p class="text-sm text-base-content/60">{profile.role}</p>
      </div>
      {#if archived}
        <span class="badge badge-neutral badge-sm shrink-0">Archived</span>
      {/if}
    </div>
    <div class="flex flex-wrap gap-1 mt-1">
      {#each profile.extractedCompetencies as c}
        <span class="badge badge-sm badge-outline">{c}</span>
      {/each}
    </div>
    {#if archived && onrevive}
      <div class="mt-2">
        <button
          class="btn btn-sm btn-ghost w-full"
          onclick={(e) => { e.stopPropagation(); onrevive!(); }}
          data-testid="revive-btn"
        >
          ↩ Revive
        </button>
      </div>
    {/if}
  </div>
</div>
