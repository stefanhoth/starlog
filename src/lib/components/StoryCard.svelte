<script lang="ts">
  import type { Story } from '../types';

  let { story, onclick }: { story: Story; onclick: () => void } = $props();

  const QUALITY_DOT: Record<string, string> = {
    high:   'bg-emerald-400',
    medium: 'bg-amber-400',
    low:    'bg-red-400',
  };

  const QUALITY_LABEL: Record<string, string> = {
    high:   'Strong story',
    medium: 'Room to improve',
    low:    'Needs work',
  };

  // Worst quality across all four sections
  const worstQuality = (() => {
    const levels = ['high', 'medium', 'low'];
    const vals = [story.quality.situation, story.quality.task, story.quality.action, story.quality.result];
    return vals.reduce((worst, v) => levels.indexOf(v) > levels.indexOf(worst) ? v : worst, 'high');
  })();
</script>

<div
  class="bg-base-100 border border-base-300 rounded-xl hover:border-indigo-200 hover:shadow-sm
         transition-all cursor-pointer group"
  onclick={onclick}
  role="button"
  tabindex="0"
  onkeydown={(e) => e.key === 'Enter' && onclick()}
  data-testid="story-card"
>
  <div class="p-4 flex flex-col gap-2.5">

    <!-- Title row -->
    <div class="flex items-start justify-between gap-3">
      <h3 class="font-semibold text-sm leading-snug text-slate-800 group-hover:text-indigo-700 transition-colors">
        {story.title}
      </h3>
      <span
        class="shrink-0 w-2.5 h-2.5 rounded-full mt-0.5 {QUALITY_DOT[worstQuality]}"
        title="{QUALITY_LABEL[worstQuality]}"
        aria-label="{QUALITY_LABEL[worstQuality]}"
      ></span>
    </div>

    <!-- Competency tags -->
    <div class="flex flex-wrap gap-1">
      {#each story.competency_tags as tag}
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                     bg-slate-100 text-slate-600">
          {tag}
        </span>
      {/each}
    </div>

    <!-- Strength + date -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1" title="Your confidence rating for this story (1–5)">
        <span class="text-xs text-slate-400">Strength:</span>
        <div class="flex gap-0.5">
          {#each Array(5) as _, i}
            <span class="text-xs {i < story.rank ? 'text-amber-400' : 'text-slate-200'}">★</span>
          {/each}
        </div>
      </div>
      <span class="text-xs text-slate-400">
        {new Date(story.createdAt).toLocaleDateString()}
      </span>
    </div>

  </div>
</div>
