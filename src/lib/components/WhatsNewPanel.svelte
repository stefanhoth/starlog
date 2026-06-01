<script lang="ts">
  import { CHANGELOG } from '../changelog';
  import { markSeen } from '../stores/whatsNew';
  import { onMount } from 'svelte';
  import ChangelogList from './ChangelogList.svelte';

  let { onClose }: { onClose: () => void } = $props();

  onMount(async () => {
    if (CHANGELOG.length > 0) {
      await markSeen(CHANGELOG[0].date);
    }
  });
</script>

<div data-testid="whats-new-panel" class="fixed inset-y-0 right-0 z-50 w-96 bg-base-100 shadow-xl flex flex-col">
  <div class="flex items-center justify-between p-4 border-b border-base-300">
    <h2 class="font-semibold text-lg">What's New</h2>
    <button class="btn btn-sm btn-ghost" aria-label="Close What's New panel" onclick={onClose}>✕</button>
  </div>
  <div class="flex-1 overflow-y-auto p-4">
    <ChangelogList entries={CHANGELOG} initialVisible={3} />
  </div>
</div>
<div class="fixed inset-0 z-40 bg-black/20" onclick={onClose}></div>
