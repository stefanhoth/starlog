<script lang="ts">
  import { currentView, navigate } from './lib/stores/view';
  import { settingsStore } from './lib/stores/settings';
  import Onboarding from './views/Onboarding.svelte';
  import Library from './views/Library.svelte';
  import Capture from './views/Capture.svelte';
  import Review from './views/Review.svelte';
  import StoryDetail from './views/StoryDetail.svelte';
  import JobProfiles from './views/JobProfiles.svelte';
  import JobProfileDetail from './views/JobProfileDetail.svelte';
  import InterviewMode from './views/InterviewMode.svelte';

  // Redirect to onboarding if not yet configured
  if (!$settingsStore.consentGiven) {
    navigate('onboarding');
  } else if ($currentView === 'onboarding') {
    navigate('library');
  }

  const navItems = [
    { view: 'library' as const,      label: 'Stories',      icon: '📚' },
    { view: 'capture' as const,      label: 'New Story',    icon: '🎙️' },
    { view: 'job-profiles' as const, label: 'Job Profiles', icon: '💼' },
  ];
</script>

{#if $currentView === 'interview'}
  <InterviewMode />
{:else}
  <div class="flex h-screen bg-base-100" data-testid="app-shell">

    <aside class="w-56 bg-base-200 flex flex-col shrink-0" data-testid="nav">
      <div class="p-4 border-b border-base-300">
        <span class="font-bold text-lg tracking-tight">StarLog</span>
      </div>

      {#if $currentView !== 'onboarding'}
        <nav class="flex-1 p-2 flex flex-col gap-1">
          {#each navItems as item}
            <button
              class="btn btn-ghost justify-start gap-2 {$currentView === item.view ? 'btn-active' : ''}"
              onclick={() => navigate(item.view)}
              data-testid="nav-{item.view}"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          {/each}
        </nav>

        <div class="p-2 border-t border-base-300">
          <button
            class="btn btn-ghost btn-sm w-full justify-start gap-2"
            onclick={() => navigate('onboarding')}
            data-testid="settings-cog"
          >
            ⚙️ Settings
          </button>
        </div>
      {/if}
    </aside>

    <main class="flex-1 overflow-y-auto">
      {#if $currentView === 'onboarding'}
        <Onboarding />
      {:else if $currentView === 'library'}
        <Library />
      {:else if $currentView === 'capture'}
        <Capture />
      {:else if $currentView === 'review'}
        <Review />
      {:else if $currentView === 'story-detail'}
        <StoryDetail />
      {:else if $currentView === 'job-profiles'}
        <JobProfiles />
      {:else if $currentView === 'job-profile-detail'}
        <JobProfileDetail />
      {/if}
    </main>

  </div>
{/if}
