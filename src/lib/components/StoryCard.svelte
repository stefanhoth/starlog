<script lang="ts">
  import type { Story } from '../types';

  let { story, onclick }: { story: Story; onclick: () => void } = $props();

  const QUALITY_ICON: Record<string, string> = { high: '🟢', medium: '🟡', low: '🔴' };

  // Worst quality across all sections
  const worstQuality = (() => {
    const levels = ['high', 'medium', 'low'];
    const vals = [story.quality.situation, story.quality.task, story.quality.action, story.quality.result];
    return vals.reduce((worst, v) => levels.indexOf(v) > levels.indexOf(worst) ? v : worst, 'high');
  })();
</script>

<div
  class="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow cursor-pointer"
  onclick={onclick}
  role="button"
  tabindex="0"
  onkeydown={(e) => e.key === 'Enter' && onclick()}
  data-testid="story-card"
>
  <div class="card-body p-4 gap-2">
    <div class="flex items-start justify-between gap-2">
      <h3 class="font-semibold text-sm leading-tight">{story.title}</h3>
      <span class="shrink-0 text-sm">{QUALITY_ICON[worstQuality]}</span>
    </div>
    <div class="flex flex-wrap gap-1">
      {#each story.competency_tags as tag}
        <span class="badge badge-sm badge-outline">{tag}</span>
      {/each}
    </div>
    <div class="flex items-center justify-between mt-1">
      <div class="flex gap-0.5">
        {#each Array(5) as _, i}
          <span class="text-xs {i < story.rank ? 'text-warning' : 'text-base-300'}">★</span>
        {/each}
      </div>
      <span class="text-xs text-base-content/40">
        {new Date(story.createdAt).toLocaleDateString()}
      </span>
    </div>
  </div>
</div>
