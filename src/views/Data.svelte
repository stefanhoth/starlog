<script lang="ts">
  import { storiesStore } from '../lib/stores/stories';
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { settingsStore } from '../lib/stores/settings';
  import { navigate } from '../lib/stores/view';

  const storyCount = $derived($storiesStore.length);
  const profileCount = $derived($jobProfilesStore.length);

  let showClearConfirm = $state(false);

  function clearAllData() {
    storiesStore.reset();
    jobProfilesStore.reset();
    settingsStore.reset();
    showClearConfirm = false;
    navigate('onboarding');
  }
</script>

<div class="min-h-full flex items-center justify-center p-6">
  <div class="bg-base-100 border border-base-300 rounded-2xl shadow-sm w-full max-w-sm p-6 flex flex-col gap-5">
    <div>
      <h2 class="font-semibold text-base">Data</h2>
      <p class="text-sm text-base-content/50 mt-0.5">Manage your stored data</p>
    </div>

    <!-- Storage section -->
    <div class="border-t border-base-300 pt-5 flex flex-col gap-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-base-content/50">Storage</p>
      <p class="text-sm text-base-content">{storyCount} {storyCount === 1 ? 'story' : 'stories'}</p>
      <p class="text-sm text-base-content">{profileCount} job {profileCount === 1 ? 'profile' : 'profiles'}</p>
      <p class="text-xs text-base-content/50">Stored in browser localStorage · no server, no account</p>
    </div>

    <!-- Export & Import stub -->
    <div class="border-t border-base-300 pt-5 flex flex-col gap-2">
      <p class="text-xs font-semibold uppercase tracking-widest text-base-content/50">Export &amp; Import</p>
      <p class="text-sm font-medium text-base-content/60">Export / Import</p>
      <p class="text-xs text-base-content/40">Download a backup or restore from a file. Coming soon.</p>
    </div>

    <!-- Danger Zone -->
    <div class="border-t border-error/30 pt-5 flex flex-col gap-3" data-testid="danger-zone">
      <p class="text-xs font-semibold uppercase tracking-widest text-error">Danger Zone</p>
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-medium">Clear all data</p>
          <p class="text-xs text-base-content/50 mt-0.5">Permanently deletes all stories, job profiles, and your API key. This cannot be undone.</p>
        </div>
        <button
          class="btn btn-outline btn-error btn-sm shrink-0"
          onclick={() => showClearConfirm = true}
          data-testid="clear-all-data-btn"
        >
          Clear all data
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Confirmation modal -->
{#if showClearConfirm}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-heading"
    tabindex="-1"
    onkeydown={(e) => e.key === 'Escape' && (showClearConfirm = false)}
  >
    <div class="bg-base-100 rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
      <h3 id="confirm-heading" class="font-semibold text-lg">Are you absolutely sure?</h3>
      <p class="text-sm text-base-content/50">
        This will permanently delete
        <strong class="text-base-content">{storyCount} {storyCount === 1 ? 'story' : 'stories'}</strong>
        and
        <strong class="text-base-content">{profileCount} job {profileCount === 1 ? 'profile' : 'profiles'}</strong>,
        and clear your API key. You cannot undo this.
      </p>
      <div class="flex flex-col gap-2 mt-1">
        <button
          class="btn btn-error w-full"
          onclick={clearAllData}
          data-testid="confirm-clear-btn"
        >
          Yes, delete everything
        </button>
        <button
          class="btn btn-ghost w-full"
          onclick={() => showClearConfirm = false}
          data-testid="cancel-clear-btn"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
