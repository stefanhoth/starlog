<script lang="ts">
  import { currentView, navigate, openJob, activeProfileId } from './lib/stores/view';
  import { settingsStore } from './lib/stores/settings';
  import { jobProfilesStore } from './lib/stores/jobProfiles';
  import { storageError } from './lib/stores/storageError';
  import type { JobProfile } from './lib/types';
  import Onboarding from './views/Onboarding.svelte';
  import Brand from './lib/components/Brand.svelte';
  import Capture from './views/Capture.svelte';
  import Review from './views/Review.svelte';
  import StoryDetail from './views/StoryDetail.svelte';
  import JobHub from './views/JobHub.svelte';
  import StoryBank from './views/StoryBank.svelte';
  import InterviewMode from './views/InterviewMode.svelte';
  import Data from './views/Data.svelte';
  import WhatsNewPanel from './lib/components/WhatsNewPanel.svelte';
  import { lastSeenDate, initWhatsNew } from './lib/stores/whatsNew';
  import { CHANGELOG } from './lib/changelog';
  import { onMount } from 'svelte';

  // Redirect to onboarding if not yet configured; existing users go to job hub.
  // Guard against pushing a redundant history entry when URL already resolved correctly.
  if (!$settingsStore.consentGiven) {
    if ($currentView !== 'onboarding') navigate('onboarding');
  } else if ($currentView === 'onboarding') {
    navigate('job-hub');
  }

  const activeProfiles = $derived($jobProfilesStore.filter((p: JobProfile) => !p.archivedAt));

  // Auto-select first active profile if none is active yet
  $effect(() => {
    const profiles = activeProfiles;
    const current = $activeProfileId;
    if (!current && profiles.length > 0) {
      openJob(profiles[0].id);
    }
  });

  function coveragePct(profile: JobProfile): number {
    const total = profile.extractedCompetencies.length;
    if (total === 0) return 0;
    const covered = profile.extractedCompetencies.filter(
      c => (profile.competencyMap[c] ?? []).length > 0
    ).length;
    return Math.round((covered / total) * 100);
  }

  function startRehearse() {
    sessionStorage.setItem('starlog_interview_submode', 'launch');
    navigate('interview');
  }

  const isFullScreen = $derived(
    $currentView === 'interview' ||
    ($currentView === 'onboarding' && !$settingsStore.consentGiven)
  );

  let showWhatsNew = $state(false);
  let sidebarArchivedOpen = $state(false);
  const hasUnseen = $derived($lastSeenDate !== CHANGELOG[0]?.date);

  onMount(() => {
    initWhatsNew();
  });
</script>

{#if $storageError}
  <div role="alert" class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 bg-error text-error-content px-4 py-3 text-sm shadow-lg">
    <span>⚠️ {$storageError}</span>
    <button class="btn btn-xs btn-ghost text-error-content" onclick={() => storageError.set(null)}>Dismiss</button>
  </div>
{/if}

{#if isFullScreen}
  {#if $currentView === 'interview'}
    <InterviewMode />
  {:else}
    <Onboarding />
  {/if}

{:else}
  <div class="flex h-screen bg-base-100" data-testid="app-shell">

    <!-- ── Sidebar (desktop only) ───────────────────────────────────── -->
    <aside
      class="hidden md:flex w-56 bg-base-100 border-r border-base-300 flex-col shrink-0"
      data-testid="nav"
    >
      <div class="px-5 py-4 border-b border-base-300">
        <Brand size="sm" />
      </div>

      <nav class="flex-1 py-3 px-2 flex flex-col overflow-y-auto">

        <!-- JOBS section -->
        <div class="px-2 py-1 text-xs font-semibold text-base-content/40 tracking-widest uppercase mb-1">
          Jobs
        </div>

        {#each activeProfiles as profile (profile.id)}
          {@const pct = coveragePct(profile)}
          <button
            class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors
              {profile.id === $activeProfileId && $currentView === 'job-hub'
                ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                : 'text-base-content hover:bg-base-200'}"
            onclick={() => openJob(profile.id)}
            data-testid="nav-job-{profile.id}"
          >
            <span class="truncate leading-tight min-w-0">
              <span class="block font-medium truncate">{profile.role}</span>
              <span class="block text-xs text-base-content/50 truncate">{profile.company}</span>
            </span>
            <span class="ml-2 text-xs font-mono shrink-0
              {pct >= 70 ? 'text-success' : pct >= 40 ? 'text-warning' : 'text-error'}">
              {pct}%
            </span>
          </button>
        {/each}

        {#if activeProfiles.length === 0}
          <p class="px-3 py-2 text-xs text-base-content/40 italic">No jobs yet</p>
        {/if}

        <button
          class="w-full flex items-center px-3 py-1.5 mt-0.5 rounded-lg text-sm text-primary/70 hover:text-primary hover:bg-base-200 transition-colors"
          onclick={() => navigate('add-job')}
          data-testid="nav-add-job"
        >
          + add job
        </button>

        <!-- Archived jobs collapsible -->
        {#if $jobProfilesStore.filter((p: JobProfile) => p.archivedAt).length > 0}
          {@const archivedProfiles = $jobProfilesStore.filter((p: JobProfile) => p.archivedAt)}
          <div class="mt-1" data-testid="sidebar-archived-section">
            <button
              class="w-full flex items-center gap-1 px-3 py-1 text-xs text-base-content/30 hover:text-base-content/50 transition-colors"
              onclick={() => sidebarArchivedOpen = !sidebarArchivedOpen}
              aria-expanded={sidebarArchivedOpen}
              data-testid="sidebar-toggle-archived"
            >
              <span class="transition-transform {sidebarArchivedOpen ? 'rotate-90' : ''} inline-block text-[10px]">▶</span>
              Archived ({archivedProfiles.length})
            </button>
            {#if sidebarArchivedOpen}
              {#each archivedProfiles as profile (profile.id)}
                <div class="flex items-center justify-between px-3 py-1.5 opacity-50 text-sm" data-testid="nav-archived-job-{profile.id}">
                  <span class="truncate leading-tight min-w-0">
                    <span class="block text-xs text-base-content/50 truncate">{profile.role}</span>
                  </span>
                  <button
                    class="ml-1 text-xs text-primary/60 hover:text-primary shrink-0"
                    onclick={() => jobProfilesStore.reviveJobProfile(profile.id)}
                    data-testid="sidebar-revive-btn"
                  >
                    ↩
                  </button>
                </div>
              {/each}
            {/if}
          </div>
        {/if}

        <div class="my-2 border-t border-base-200"></div>

        <!-- ALSO section -->
        <div class="px-2 py-1 text-xs font-semibold text-base-content/40 tracking-widest uppercase mb-1">
          Also
        </div>

        <button
          class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors
            {$currentView === 'story-bank'
              ? 'bg-base-200 text-base-content font-medium'
              : 'text-base-content/60 hover:bg-base-200 hover:text-base-content'}"
          onclick={() => navigate('story-bank')}
          data-testid="nav-story-bank"
        >
          📚 Story bank
        </button>

        <button
          class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors
            text-base-content/60 hover:bg-base-200 hover:text-base-content"
          onclick={startRehearse}
          data-testid="nav-rehearse"
        >
          🎤 Rehearse
        </button>

      </nav>

      <div class="px-2 py-3 border-t border-base-200">
        <button
          class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors
            {$currentView === 'data'
              ? 'bg-base-200 text-base-content font-medium'
              : 'text-base-content/50 hover:text-base-content hover:bg-base-200'}"
          onclick={() => navigate('data')}
          data-testid="nav-data"
        >
          🗄 Data
        </button>
        <button
          class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-base-content/50 hover:text-base-content hover:bg-base-200 transition-colors"
          onclick={() => navigate('onboarding')}
          data-testid="settings-cog"
        >
          ⚙ Settings
        </button>
        <button
          data-testid="whats-new-btn"
          class="btn btn-ghost btn-sm justify-start gap-2 relative w-full"
          onclick={() => showWhatsNew = true}
        >
          What's New
          {#if hasUnseen}
            <span data-testid="whats-new-badge" class="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary"></span>
          {/if}
        </button>
        <div class="px-1 pt-1">
          <a
            href="https://github.com/stefanhoth/starlog/releases/tag/{__APP_VERSION__}"
            rel="nofollow noreferrer noopener"
            target="_blank"
            class="flex items-center gap-1 text-xs text-base-content/30 hover:text-base-content/60 transition-colors px-2"
            data-testid="version-link"
          >
            {__APP_VERSION__}
            <span class="text-xs">↗</span>
          </a>
        </div>
      </div>
    </aside>

    <!-- ── Main ───────────────────────────────────────────────────── -->
    <main class="flex-1 overflow-y-auto bg-base-200 pb-16 md:pb-0" data-testid="main-content">
      {#if $currentView === 'job-hub'}
        <JobHub />
      {:else if $currentView === 'gap-fill'}
        <Capture />
      {:else if $currentView === 'story-bank'}
        <StoryBank />
      {:else if $currentView === 'capture'}
        <Capture />
      {:else if $currentView === 'review'}
        <Review />
      {:else if $currentView === 'story-detail'}
        <StoryDetail />
      {:else if $currentView === 'data'}
        <Data />
      {:else if $currentView === 'onboarding'}
        <Onboarding />
      {:else if $currentView === 'add-job'}
        <Onboarding addJobMode />
      {:else}
        {#if $jobProfilesStore.length > 0}
          <JobHub />
        {:else}
          <div class="flex flex-col items-center justify-center h-full gap-4 text-base-content/40">
            <span class="text-5xl">💼</span>
            <p class="text-lg font-medium">No jobs yet</p>
            <button class="btn btn-primary" onclick={() => navigate('add-job')}>Add your first job</button>
          </div>
        {/if}
      {/if}
    </main>

    {#if showWhatsNew}
      <WhatsNewPanel onClose={() => showWhatsNew = false} />
    {/if}

    <!-- ── Mobile bottom nav (mobile only) ──────────────────────────── -->
    <nav
      class="fixed bottom-0 left-0 right-0 h-14 bg-base-100 border-t border-base-300 flex md:hidden z-30"
      data-testid="mobile-nav"
    >
      <button
        class="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors
          {$currentView === 'job-hub' || $currentView === 'gap-fill'
            ? 'text-primary'
            : 'text-base-content/40'}"
        onclick={() => $activeProfileId ? openJob($activeProfileId) : navigate('add-job')}
        data-testid="mobile-nav-jobs"
      >
        <span class="text-base leading-none">💼</span>
        <span>Jobs</span>
      </button>
      <button
        class="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors
          {$currentView === 'story-bank' || $currentView === 'story-detail'
            ? 'text-primary'
            : 'text-base-content/40'}"
        onclick={() => navigate('story-bank')}
        data-testid="mobile-nav-stories"
      >
        <span class="text-base leading-none">📚</span>
        <span>Stories</span>
      </button>
      <button
        class="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors
          {$currentView === 'capture' || $currentView === 'review'
            ? 'text-primary'
            : 'text-base-content/40'}"
        onclick={() => navigate('capture')}
        data-testid="mobile-nav-capture"
      >
        <span class="text-base leading-none">✏️</span>
        <span>Capture</span>
      </button>
      <button
        class="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors
          {$currentView === 'onboarding' && $settingsStore.consentGiven
            ? 'text-primary'
            : 'text-base-content/40'}"
        onclick={() => navigate('onboarding')}
        data-testid="mobile-nav-settings"
      >
        <span class="text-base leading-none">⚙️</span>
        <span>Settings</span>
      </button>
    </nav>

  </div>
{/if}
