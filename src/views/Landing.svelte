<script lang="ts">
  import { settingsStore } from '../lib/stores/settings';
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { navigate } from '../lib/stores/view';
  import { isEngineReady } from '../lib/local';
  import { GEMINI_MODELS, type GeminiModel, type AiProvider } from '../lib/types';
  import { parseBackup, applyImport, type BackupBundle } from '../lib/backup';
  import { buildSettingsPatch } from '../lib/ai-settings';
  import AiProviderField from '../lib/components/AiProviderField.svelte';
  import Brand from '../lib/components/Brand.svelte';
  import WhatsNewPanel from '../lib/components/WhatsNewPanel.svelte';
  import { CHANGELOG } from '../lib/changelog';

  const recentChanges = CHANGELOG.flatMap(e => e.changes).slice(0, 3);

  let apiKey = $state($settingsStore.apiKey ?? '');
  let selectedModel = $state<GeminiModel>($settingsStore.geminiModel ?? 'gemini-2.5-flash');
  let selectedProvider = $state<AiProvider>($settingsStore.aiProvider ?? 'cloud');
  let localModelReady = $state(isEngineReady());
  let valid = $state(false);

  async function submitKey() {
    if (!valid) return;
    await settingsStore.set(buildSettingsPatch(selectedProvider, apiKey, $settingsStore.apiKey, selectedModel));
    if ($jobProfilesStore.length === 0) {
      navigate('add-job');
    } else {
      navigate('job-hub');
    }
  }

  // ── Backup import ──────────────────────────────────────────────────
  let importBundle = $state<BackupBundle | null>(null);
  let importError = $state('');
  let importPending = $state(false);
  let restoreNote = $state('');

  async function handleImportFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    importError = '';
    importBundle = null;
    importPending = false;
    try {
      importBundle = await parseBackup(file);
      importPending = true;
    } catch (err) {
      importError = err instanceof Error ? err.message : 'Could not read file.';
    }
    (e.target as HTMLInputElement).value = '';
  }

  function confirmRestore() {
    if (!importBundle) return;
    const storyCount = importBundle.stories.length;
    const jobCount = importBundle.jobProfiles.length;
    applyImport(importBundle);
    restoreNote = `Restored ${storyCount} ${storyCount === 1 ? 'story' : 'stories'} and ${jobCount} job ${jobCount === 1 ? 'profile' : 'profiles'}. One last thing — reconnect your Gemini key to finish.`;
    importBundle = null;
    importPending = false;
  }

  function cancelRestore() {
    importBundle = null;
    importPending = false;
    importError = '';
  }

  // ── Popovers ───────────────────────────────────────────────────────
  let showSecurityPopover = $state(false);
  let showPrivacyPopover = $state(false);
  let showHowItWorks = $state(false);
  let showChangelog = $state(false);
</script>

<div class="min-h-screen bg-base-100 flex flex-col">

  <div class="flex-1 grid lg:grid-cols-[1fr_400px]">

    <!-- Left: pitch -->
    <div class="flex flex-col px-8 lg:px-16 xl:px-24">

      <!-- Hero: tagline + 3-step flow -->
      <div class="flex flex-col justify-center py-14 lg:min-h-screen">
        <div class="mb-10">
          <Brand size="lg" />
        </div>
        <h1 class="text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] max-w-xl">
          Your experience, shaped into
          <span class="text-primary">powerful stories.</span>
        </h1>

        <div class="mt-10 flex items-start gap-2 max-w-xl">
          {#each [
            { e: '📝', l: 'Log your experiences' },
            { e: '⭐', l: 'Structure each story' },
            { e: '🎯', l: 'Nail your next interview' },
          ] as step, i}
            <div class="flex-1 flex flex-col items-center text-center gap-2">
              <div class="text-4xl leading-none">{step.e}</div>
              <div class="text-sm font-semibold leading-snug">{step.l}</div>
            </div>
            {#if i < 2}
              <div class="self-start pt-3 text-2xl text-base-content/25" aria-hidden="true">→</div>
            {/if}
          {/each}
        </div>

        <!-- Feature strip: trust signals -->
        <div class="mt-8 flex flex-wrap gap-x-5 gap-y-1.5">
          {#each [
            'Free to use',
            'No account needed',
            'Backup & restore',
            'Export as Markdown',
          ] as feat}
            <span class="text-xs text-base-content/50 flex items-center gap-1">
              <span class="text-success font-bold">✓</span>{feat}
            </span>
          {/each}
        </div>

        <div class="mt-8 flex flex-wrap items-center gap-4">
          <button
            class="text-xs text-base-content/40 hover:text-base-content/70 transition-colors text-left"
            onclick={() => showPrivacyPopover = true}
          >
            🔒 Your data stays in your browser — what does that mean?
          </button>
          <button
            class="text-xs text-primary/70 hover:text-primary transition-colors"
            onclick={() => showHowItWorks = true}
          >
            How it works →
          </button>
        </div>
      </div>

      <!-- Below the fold: STAR explainer -->
      <div class="pb-14 lg:pb-20 max-w-md">
        <h2 class="text-lg font-semibold">What is a STAR story?</h2>
        <p class="text-sm text-base-content/50 mt-1 mb-4">A simple structure that turns any experience into a clear, compelling answer.</p>
        <div class="grid grid-cols-4 gap-3">
          {#each [
            { l: 'S', w: 'Situation', d: 'set the scene' },
            { l: 'T', w: 'Task',      d: 'your job' },
            { l: 'A', w: 'Action',    d: 'what YOU did' },
            { l: 'R', w: 'Result',    d: 'what changed' },
          ] as item}
            <div class="text-center">
              <div class="w-8 h-8 mx-auto rounded-lg bg-primary text-primary-content font-bold text-sm flex items-center justify-center mb-1">
                {item.l}
              </div>
              <div class="text-xs font-semibold">{item.w}</div>
              <div class="text-xs text-base-content/40">{item.d}</div>
            </div>
          {/each}
        </div>
      </div>

    </div>

    <!-- Right: AI setup form + changelog teaser -->
    <div class="bg-base-200 border-l border-base-300 flex flex-col items-center justify-center gap-8 p-8 lg:p-10 lg:sticky lg:top-0 lg:h-screen">
      <div class="w-full max-w-sm flex flex-col gap-5">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-semibold">
              {selectedProvider === 'local' ? 'Set up Local AI' : 'Connect Gemini AI'}
            </h2>
            {#if selectedProvider === 'cloud'}
              <button
                class="text-xs text-base-content/40 hover:text-primary transition-colors"
                onclick={() => showSecurityPopover = true}
                aria-label="Why your own key?"
              >ⓘ more info</button>
            {/if}
          </div>
          <p class="text-sm text-base-content/50 mt-1 leading-relaxed">
            {#if selectedProvider === 'local'}
              AI runs entirely in your browser — nothing leaves your device. No key required.
            {:else}
              STARlog uses your own Gemini API key — your calls go directly to Google, never through STARlog.
            {/if}
          </p>
        </div>

        <AiProviderField
          bind:apiKey
          bind:selectedProvider
          bind:localModelReady
          bind:valid
          showGetKeyLink={true}
          onSubmit={submitKey}
        />

        <button
          class="btn btn-primary w-full"
          onclick={submitKey}
          disabled={!valid}
          data-testid="onboarding-submit"
        >
          Get Started →
        </button>

        {#if restoreNote}
          <div class="alert alert-success text-sm py-3" data-testid="restore-note">
            <span>✓ {restoreNote}</span>
          </div>
        {/if}

        {#if importError}
          <p class="text-error text-xs mt-1" data-testid="onboarding-import-error">{importError}</p>
        {/if}

        {#if importPending && importBundle}
          <div class="bg-base-100 border border-base-300 rounded-xl p-4 flex flex-col gap-3" data-testid="onboarding-import-confirm">
            <p class="text-sm text-base-content">
              This backup contains <strong>{importBundle.stories.length} {importBundle.stories.length === 1 ? 'story' : 'stories'}</strong>
              and <strong>{importBundle.jobProfiles.length} job {importBundle.jobProfiles.length === 1 ? 'profile' : 'profiles'}</strong>,
              exported on {new Date(importBundle.exportedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.
            </p>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-primary" onclick={confirmRestore} data-testid="onboarding-import-confirm-btn">Restore data</button>
              <button class="btn btn-ghost btn-sm" onclick={cancelRestore} data-testid="onboarding-import-cancel-btn">Cancel</button>
            </div>
          </div>
        {/if}

        {#if !importPending && !restoreNote}
          <div class="flex justify-center pt-1">
            <label class="btn btn-ghost btn-sm text-base-content/50 cursor-pointer" data-testid="onboarding-import-label">
              Already have a backup? Restore it →
              <input
                type="file"
                accept=".json,.starlog.json"
                class="hidden"
                onchange={handleImportFile}
                data-testid="onboarding-import-input"
              />
            </label>
          </div>
        {/if}
      </div>

      <!-- Changelog teaser — desktop only -->
      {#if recentChanges.length > 0}
        <div class="hidden lg:block w-full max-w-sm border-t border-base-300 pt-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold uppercase tracking-wider text-base-content/40">What's new</span>
            <button class="text-xs text-primary/70 hover:text-primary transition-colors" onclick={() => showChangelog = true}>See all →</button>
          </div>
          <ul class="flex flex-col gap-3">
            {#each recentChanges as item}
              <li>
                <p class="text-xs font-medium text-base-content leading-snug">{item.title}</p>
                <p class="text-xs text-base-content/50 leading-relaxed line-clamp-1 mt-0.5">{item.detail}</p>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </div>

</div>

<!-- What's New slide-over -->
{#if showChangelog}
  <WhatsNewPanel onClose={() => showChangelog = false} suppressMarkSeen />
{/if}

<!-- Security popover -->
{#if showSecurityPopover}
  <div
    class="fixed inset-0 z-50 flex items-start justify-end p-6"
    role="dialog"
    aria-modal="true"
    aria-labelledby="security-heading"
    onkeydown={(e) => e.key === 'Escape' && (showSecurityPopover = false)}
    onclick={(e) => e.target === e.currentTarget && (showSecurityPopover = false)}
    tabindex="-1"
  >
    <div class="bg-base-100 border border-base-300 rounded-xl shadow-md p-5 text-sm max-w-xs w-full mt-16 mr-4 flex flex-col gap-3">
      <div class="flex items-start justify-between gap-2">
        <h3 id="security-heading" class="font-semibold text-base">Why your own key?</h3>
        <button class="btn btn-xs btn-ghost shrink-0 -mt-1 -mr-1" onclick={() => showSecurityPopover = false} aria-label="Close">✕</button>
      </div>
      <p class="text-base-content/60 leading-relaxed">When you use a shared AI service, your prompts go through someone else's account and billing. With your own Gemini key:</p>
      <ul class="space-y-1.5 text-base-content/70">
        <li class="flex gap-2"><span class="text-primary shrink-0">·</span><span>Your API calls go directly from your browser to Google — STARlog never sees them</span></li>
        <li class="flex gap-2"><span class="text-primary shrink-0">·</span><span>You control usage and can revoke the key any time from Google AI Studio</span></li>
        <li class="flex gap-2"><span class="text-primary shrink-0">·</span><span>No STARlog account means no STARlog database that could be breached</span></li>
      </ul>
      <p class="text-base-content/50 text-xs">The free tier (Gemini Flash) handles hundreds of stories before you'd ever hit a limit.</p>
    </div>
  </div>
{/if}

<!-- Data privacy popover -->
{#if showPrivacyPopover}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="privacy-heading"
    onkeydown={(e) => e.key === 'Escape' && (showPrivacyPopover = false)}
    onclick={(e) => e.target === e.currentTarget && (showPrivacyPopover = false)}
    tabindex="-1"
  >
    <div class="bg-base-100 border border-base-300 rounded-xl shadow-md p-5 text-sm max-w-sm w-full flex flex-col gap-3">
      <div class="flex items-start justify-between gap-2">
        <h3 id="privacy-heading" class="font-semibold text-base">Your data never leaves your device</h3>
        <button class="btn btn-xs btn-ghost shrink-0 -mt-1 -mr-1" onclick={() => showPrivacyPopover = false} aria-label="Close">✕</button>
      </div>
      <p class="text-base-content/60 leading-relaxed">STARlog stores everything — your stories, job profiles, and API key — in your browser's local storage (IndexedDB). This means:</p>
      <ul class="space-y-1.5 text-base-content/70">
        <li class="flex gap-2"><span class="text-primary shrink-0">·</span><span>No account required. No email, no password.</span></li>
        <li class="flex gap-2"><span class="text-primary shrink-0">·</span><span>No server. There is no STARlog backend that receives or stores your data.</span></li>
        <li class="flex gap-2"><span class="text-primary shrink-0">·</span><span>No sync. If you clear browser storage or switch browsers, your data is gone. Use Export to back it up.</span></li>
        <li class="flex gap-2"><span class="text-primary shrink-0">·</span><span>Your API key is only used to talk directly to Google's Gemini API — it is never sent to STARlog.</span></li>
      </ul>
      <p class="text-base-content/40 text-xs">This is a private, single-device tool. It is not designed for sharing or collaboration.</p>
      <button class="btn btn-sm btn-ghost self-end" onclick={() => showPrivacyPopover = false}>Got it</button>
    </div>
  </div>
{/if}

<!-- How it works modal -->
{#if showHowItWorks}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="how-heading"
    onkeydown={(e) => e.key === 'Escape' && (showHowItWorks = false)}
    onclick={(e) => e.target === e.currentTarget && (showHowItWorks = false)}
    tabindex="-1"
  >
    <div class="bg-base-100 border border-base-300 rounded-xl shadow-md p-6 text-sm max-w-xl w-full flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
      <div class="flex items-start justify-between gap-2">
        <h3 id="how-heading" class="font-semibold text-lg">Two ways to use STARlog</h3>
        <button class="btn btn-xs btn-ghost shrink-0 -mt-1 -mr-1" onclick={() => showHowItWorks = false} aria-label="Close">✕</button>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="border border-base-300 rounded-xl p-4 flex flex-col gap-3">
          <div>
            <p class="font-semibold text-base">Job-first</p>
            <p class="text-xs text-base-content/50 mt-0.5">Recommended when you have a specific role to prep for</p>
          </div>
          <ol class="space-y-2 text-base-content/70">
            <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">1.</span><span>Paste the job description → AI extracts 5–7 competencies</span></li>
            <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">2.</span><span>For each competency with no story, STARlog prompts you to fill the gap</span></li>
            <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">3.</span><span>Record or type your story → AI structures it into STAR format</span></li>
            <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">4.</span><span>Rehearse in Interview Mode until it flows</span></li>
          </ol>
        </div>
        <div class="border border-base-300 rounded-xl p-4 flex flex-col gap-3">
          <div>
            <p class="font-semibold text-base">Story-first</p>
            <p class="text-xs text-base-content/50 mt-0.5">Good for building a reusable bank before job-hunting</p>
          </div>
          <ol class="space-y-2 text-base-content/70">
            <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">1.</span><span>Start by capturing stories from memory — anything you're proud of</span></li>
            <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">2.</span><span>Add a job profile when you're ready to apply</span></li>
            <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">3.</span><span>Map your existing stories to the competencies it requires</span></li>
            <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">4.</span><span>See which gaps remain and fill them</span></li>
          </ol>
        </div>
      </div>
      <p class="text-base-content/50 text-xs text-center">Either way, the Story Bank is always there. You own it across every application.</p>
      <button class="btn btn-primary btn-sm self-center px-8" onclick={() => showHowItWorks = false}>Got it</button>
    </div>
  </div>
{/if}
