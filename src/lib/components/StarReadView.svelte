<script lang="ts">
  import type { StarSections } from '../types';

  let { star }: { star: StarSections } = $props();
</script>

<div class="flex flex-col gap-4 text-sm">
  <div class="flex gap-3">
    <div class="w-7 h-7 rounded-full bg-primary text-primary-content flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">S</div>
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-1">Situation</p>
      {#if star.situation}
        <p class="leading-relaxed">{star.situation}</p>
      {:else}
        <p class="text-base-content/30 italic">Not provided.</p>
      {/if}
    </div>
  </div>

  <div class="flex gap-3">
    <div class="w-7 h-7 rounded-full bg-primary text-primary-content flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">T</div>
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-1">Task</p>
      {#if star.task}
        <p class="leading-relaxed">{star.task}</p>
      {:else}
        <p class="text-base-content/30 italic">Not provided.</p>
      {/if}
    </div>
  </div>

  <div class="flex gap-3">
    <div class="w-7 h-7 rounded-full bg-primary text-primary-content flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">A</div>
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-1">Action</p>
      {#if star.action.length === 1}
        <p class="leading-relaxed">{star.action[0]}</p>
      {:else if star.action.length > 1}
        <ol class="list-decimal list-inside space-y-1">
          {#each star.action as step}
            <li class="leading-relaxed">{step}</li>
          {/each}
        </ol>
      {:else}
        <p class="text-base-content/30 italic">Not provided.</p>
      {/if}
    </div>
  </div>

  <div class="flex gap-3">
    <div class="w-7 h-7 rounded-full bg-primary text-primary-content flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">R</div>
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-1">Result</p>
      {#if star.result}
        <p class="leading-relaxed">{star.result}</p>
      {:else}
        <p class="text-base-content/30 italic">Not provided.</p>
      {/if}
    </div>
  </div>
</div>
