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
  <!-- Full-screen interview mode: no chrome at all -->
  <InterviewMode />

{:else if $currentView === 'onboarding' && !$settingsStore.consentGiven}
  <!-- New user: landing page fills the full viewport, no sidebar -->
  <Onboarding />

{:else}
  <div class="flex h-screen bg-base-100" data-testid="app-shell">

    <!-- ── Sidebar ─────────────────────────────────────────────────── -->
    <aside
      class="w-56 bg-base-100 border-r border-base-300 flex flex-col shrink-0"
      data-testid="nav"
    >
      <div class="px-5 py-4 border-b border-base-300 flex items-center gap-2">
        <span class="text-primary font-bold text-lg leading-none">★</span>
        <span class="font-bold text-sm tracking-tight text-base-content">StarLog</span>
      </div>

      {#if $currentView !== 'onboarding'}
        <nav class="flex-1 py-2 px-2 flex flex-col gap-0.5">
          {#each navItems as item}
            <button
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-left transition-colors
                {$currentView === item.view
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}"
              onclick={() => navigate(item.view)}
              data-testid="nav-{item.view}"
            >
              <span class="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          {/each}
        </nav>

        <div class="px-2 py-2 border-t border-base-300">
          <button
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-left
              text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            onclick={() => navigate('onboarding')}
            data-testid="settings-cog"
          >
            <span class="text-base leading-none">⚙️</span>
            <span>Settings</span>
          </button>
        </div>
      {/if}
    </aside>

    <!-- ── Main content ────────────────────────────────────────────── -->
    <main class="flex-1 overflow-y-auto bg-base-200">
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
