<script lang="ts">
  import { settingsStore } from '../lib/stores/settings';
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { navigate } from '../lib/stores/view';
  import { isEngineReady } from '../lib/local';
  import { GEMINI_MODELS, type GeminiModel, type AiProvider } from '../lib/types';
  import { buildSettingsPatch } from '../lib/ai-settings';
  import AiProviderField from '../lib/components/AiProviderField.svelte';

  let apiKey = $state($settingsStore.apiKey ?? '');
  let selectedModel = $state<GeminiModel>($settingsStore.geminiModel ?? 'gemini-2.5-flash');
  let selectedProvider = $state<AiProvider>($settingsStore.aiProvider ?? 'cloud');
  let localModelReady = $state(isEngineReady());
  let valid = $state(false);

  async function save() {
    if (!valid) return;
    await settingsStore.set(buildSettingsPatch(selectedProvider, apiKey, $settingsStore.apiKey, selectedModel));
    if ($jobProfilesStore.length === 0) {
      navigate('add-job');
    } else {
      navigate('job-hub');
    }
  }

  function saveModelSelection() {
    settingsStore.update(s => ({ ...s, geminiModel: selectedModel }));
  }
</script>

<div class="min-h-full flex items-center justify-center p-6">
  <div class="bg-base-100 border border-base-300 rounded-2xl shadow-sm w-full max-w-sm p-6 flex flex-col gap-5">
    <div>
      <h2 class="font-semibold text-base">Settings</h2>
      <p class="text-sm text-base-content/50 mt-0.5">Configure your AI provider</p>
    </div>

    <AiProviderField
      bind:apiKey
      bind:selectedProvider
      bind:localModelReady
      bind:valid
      alwaysShowLocalTab={true}
      onSubmit={save}
    />

    {#if selectedProvider === 'cloud'}
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium" for="model-select">Gemini Model</label>
        <select
          id="model-select"
          class="select select-bordered w-full text-sm"
          bind:value={selectedModel}
          onchange={saveModelSelection}
          data-testid="model-select"
        >
          {#each GEMINI_MODELS as m}
            <option value={m.id}>{m.label}</option>
          {/each}
        </select>
      </div>
    {/if}

    <div class="flex flex-col gap-2">
      <button
        class="btn btn-primary w-full"
        onclick={save}
        disabled={!valid}
        data-testid="onboarding-submit"
      >Save</button>
      <button class="btn btn-ghost w-full text-base-content/50" onclick={() => navigate('job-hub')}>
        Cancel
      </button>
    </div>

    <div class="border-t border-base-300 pt-5 flex items-center justify-between gap-4">
      <p class="text-xs text-base-content/50">Back up or restore your data in the Data section.</p>
      <button
        class="btn btn-ghost btn-xs shrink-0"
        onclick={() => navigate('data')}
        data-testid="data-hint"
      >
        Go to Data →
      </button>
    </div>
  </div>
</div>
