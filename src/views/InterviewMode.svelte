<script lang="ts">
  import { storiesStore } from '../lib/stores/stories';
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { navigate, activeProfileId } from '../lib/stores/view';
  import type { Story } from '../lib/types';

  type Submode = 'launch' | 'read' | 'train-question' | 'train-timer' | 'live';
  type InterviewMode = 'library' | 'profile';

  const mode = (sessionStorage.getItem('starlog_interview_mode') ?? 'profile') as InterviewMode;
  const profileId = $activeProfileId || (sessionStorage.getItem('starlog_active_profile') ?? '');
  const rawSubmode = (sessionStorage.getItem('starlog_interview_submode') ?? 'launch') as Submode;
  let submode = $state<Submode>(rawSubmode);

  // ── Story groups ───────────────────────────────────────────────────
  type Group = { competency: string | null; stories: Story[] };

  const groups = $derived.by<Group[]>(() => {
    const stories = $storiesStore;
    if (mode === 'library') {
      return [{ competency: null, stories }];
    }
    const profile = $jobProfilesStore.find(p => p.id === profileId);
    if (!profile) return [];
    return profile.extractedCompetencies
      .map(c => ({
        competency: c,
        stories: (profile.competencyMap[c] ?? [])
          .map(id => stories.find(s => s.id === id))
          .filter((s): s is Story => !!s),
      }))
      .filter(g => g.stories.length > 0);
  });

  const allStories = $derived(groups.flatMap(g => g.stories));
  const profile = $derived($jobProfilesStore.find(p => p.id === profileId));

  // ── Card navigation (Read / Train-timer) ──────────────────────────
  let groupIdx = $state(0);
  let storyIdx = $state(0);
  let expanded = $state(false);
  let loopFlash = $state(false);

  const currentGroup = $derived(groups[Math.min(groupIdx, groups.length - 1)] ?? null);
  const currentStory = $derived(
    currentGroup?.stories[Math.min(storyIdx, (currentGroup?.stories.length ?? 1) - 1)] ?? null
  );

  function flashLoop() {
    loopFlash = true;
    setTimeout(() => loopFlash = false, 600);
  }

  function exit() {
    navigate(mode === 'profile' ? 'job-hub' : 'story-bank');
  }
  function nextStory() {
    if (!currentGroup) return;
    const atEnd = storyIdx >= currentGroup.stories.length - 1;
    storyIdx = atEnd ? 0 : storyIdx + 1;
    expanded = false;
    if (atEnd) flashLoop();
  }
  function prevStory() {
    if (!currentGroup) return;
    const atStart = storyIdx === 0;
    storyIdx = atStart ? currentGroup.stories.length - 1 : storyIdx - 1;
    expanded = false;
    if (atStart) flashLoop();
  }
  function nextGroup() {
    if (groupIdx < groups.length - 1) { groupIdx++; storyIdx = 0; expanded = false; }
  }
  function prevGroup() {
    if (groupIdx > 0) { groupIdx--; storyIdx = 0; expanded = false; }
  }

  // Global story position (across all groups)
  const totalStories = $derived(allStories.length);
  const currentPosition = $derived(
    groups.slice(0, groupIdx).reduce((sum, g) => sum + g.stories.length, 0) + storyIdx + 1
  );

  // ── Train: question-first ─────────────────────────────────────────
  let questionRevealed = $state(false);
  let questionTimer = $state(0);
  let questionTimerInterval: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    if (submode === 'train-question') {
      questionTimer = 0;
      questionRevealed = false;
      questionTimerInterval = setInterval(() => questionTimer++, 1000);
    } else {
      if (questionTimerInterval) { clearInterval(questionTimerInterval); questionTimerInterval = null; }
    }
    return () => { if (questionTimerInterval) clearInterval(questionTimerInterval); };
  });

  function revealStory() {
    questionRevealed = true;
    if (questionTimerInterval) { clearInterval(questionTimerInterval); questionTimerInterval = null; }
  }

  function nextQuestion() {
    nextStory();
    questionRevealed = false;
    questionTimer = 0;
    if (questionTimerInterval) clearInterval(questionTimerInterval);
    questionTimerInterval = setInterval(() => questionTimer++, 1000);
  }

  function formatTime(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  }

  // ── Train: timer + self-rating ────────────────────────────────────
  let timerElapsed = $state(0);
  let timerRunning = $state(false);
  let selectedRating = $state<number | null>(null);
  const TARGET_SECONDS = 90;

  let timerInterval: ReturnType<typeof setInterval> | null = null;
  $effect(() => {
    if (submode === 'train-timer') {
      timerElapsed = 0; timerRunning = true; selectedRating = null;
      timerInterval = setInterval(() => { if (timerRunning) timerElapsed++; }, 1000);
    } else {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    }
    return () => { if (timerInterval) clearInterval(timerInterval); };
  });

  const timerPct = $derived(Math.min((timerElapsed / TARGET_SECONDS) * 100, 100));
  const overPct = $derived(timerElapsed > TARGET_SECONDS ? Math.min(((timerElapsed - TARGET_SECONDS) / TARGET_SECONDS) * 100, 100) : 0);

  function toggleTimer() { timerRunning = !timerRunning; }

  function nextTimerStory() {
    nextStory();
    timerElapsed = 0; timerRunning = true; selectedRating = null;
  }

  // ── Live: ⌘K palette ─────────────────────────────────────────────
  let liveQuery = $state('');
  const liveResults = $derived(
    liveQuery.trim().length === 0
      ? groups
      : groups.filter(g =>
          g.competency?.toLowerCase().includes(liveQuery.toLowerCase()) ||
          g.stories.some(s => s.title.toLowerCase().includes(liveQuery.toLowerCase()))
        )
  );
  let liveSelectedGroup = $state<Group | null>(null);
  $effect(() => {
    liveSelectedGroup = liveResults[0] ?? null;
  });

  // ── Keyboard handler ──────────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    if (submode === 'read') {
      switch (e.key) {
        case 'Escape':     exit();      break;
        case 'ArrowRight': nextStory(); break;
        case 'ArrowLeft':  prevStory(); break;
        case 'ArrowDown':  nextGroup(); break;
        case 'ArrowUp':    prevGroup(); break;
        case ' ':          e.preventDefault(); expanded = !expanded; break;
      }
    } else if (submode === 'train-question') {
      if (e.key === ' ' && !questionRevealed) { e.preventDefault(); revealStory(); }
      if (e.key === 'ArrowRight' && questionRevealed) nextQuestion();
      if (e.key === 'Escape') exit();
    } else if (submode === 'train-timer') {
      if (e.key >= '1' && e.key <= '5') selectedRating = parseInt(e.key);
      if (e.key === 'ArrowRight') nextTimerStory();
      if (e.key === ' ') { e.preventDefault(); toggleTimer(); }
      if (e.key === 'Escape') exit();
    } else if (submode === 'live') {
      if (e.key === 'Escape') exit();
    }
  }

  const RATINGS = ['🤯 lost it', '😬 rough', '🙂 ok', '💪 strong', '🎯 nailed'];
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- ───────────────────────────────────────────────────────────────── -->
<!-- LAUNCH PAD                                                        -->
<!-- ───────────────────────────────────────────────────────────────── -->
{#if submode === 'launch'}
  <div class="min-h-screen bg-base-100 flex flex-col" data-testid="interview-view">
    <div class="flex items-center justify-between px-8 py-4 border-b border-base-300">
      <div class="flex items-center gap-2">
        <span class="text-primary font-bold text-lg">★</span>
        <span class="font-bold text-sm">StarLog · Interview Prep</span>
      </div>
      <button class="btn btn-ghost btn-sm" onclick={exit} data-testid="exit-btn">✕ Exit</button>
    </div>

    <div class="flex-1 p-8 max-w-2xl mx-auto w-full">
      <h1 class="text-2xl font-bold mb-1">
        {profile ? `${profile.role} · ${profile.company}` : 'All stories'}
      </h1>
      <p class="text-base-content/60 text-sm mb-8">
        {groups.length} competencie{groups.length === 1 ? 'y' : 's'} ready ·
        {allStories.length} stor{allStories.length === 1 ? 'y' : 'ies'}
      </p>

      {#if allStories.length === 0}
        <div class="text-center py-16 text-base-content/40">
          <p>No stories mapped yet.</p>
          <button class="btn btn-primary btn-sm mt-4" onclick={() => navigate('job-hub')}>Go to Job Hub</button>
        </div>
      {:else}
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {#each [
            { icon: '🃏', label: 'Flash cards',     desc: 'Browse · keyboard nav',   sub: 'read'           as Submode },
            { icon: '🎤', label: 'Mock interview',   desc: 'Question-first · timed',  sub: 'train-question' as Submode },
            { icon: '⏱', label: 'Drill with timer', desc: 'Timer + self-rating',      sub: 'train-timer'    as Submode },
          ] as m}
            <button
              class="border-2 border-base-300 hover:border-primary rounded-xl p-5 text-left transition-colors group"
              onclick={() => submode = m.sub}
              data-testid="mode-{m.sub}"
            >
              <div class="text-3xl mb-3">{m.icon}</div>
              <div class="font-semibold text-sm group-hover:text-primary transition-colors">{m.label}</div>
              <div class="text-xs text-base-content/50 mt-0.5">{m.desc}</div>
            </button>
          {/each}
        </div>

        <!-- Competency list -->
        <div class="border border-base-300 rounded-xl overflow-hidden">
          <div class="px-4 py-2.5 bg-base-200 border-b border-base-300 flex justify-between items-center">
            <span class="text-xs font-semibold uppercase tracking-wide text-base-content/50">Competencies</span>
            <span class="badge badge-ghost badge-sm">{groups.length} selected</span>
          </div>
          {#each groups as g}
            <div class="flex items-center gap-3 px-4 py-2.5 border-b border-base-200 last:border-0">
              <span class="text-success">☑</span>
              <span class="flex-1 text-sm font-medium">{g.competency ?? 'All'}</span>
              <span class="text-xs text-base-content/40">{g.stories.length} stor{g.stories.length === 1 ? 'y' : 'ies'}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

<!-- ───────────────────────────────────────────────────────────────── -->
<!-- READ MODE: card deck                                              -->
<!-- ───────────────────────────────────────────────────────────────── -->
{:else if submode === 'read'}
  <div class="min-h-screen bg-neutral text-neutral-content flex flex-col p-8" data-testid="interview-view">

    <!-- Top bar -->
    <div class="flex items-center justify-between mb-6 text-sm text-neutral-content/60">
      <div class="flex items-center gap-2">
        <span class="text-primary text-xs">★</span>
        <span>StarLog · Review mode</span>
      </div>
      <div class="flex items-center gap-4">
        {#if currentGroup?.competency}
          <span>{currentGroup.competency}</span>
        {/if}
        <span class="transition-colors duration-150 {loopFlash ? 'text-primary font-bold' : ''}"
          >{currentPosition} / {totalStories}</span>
        <button class="btn btn-ghost btn-xs text-neutral-content/60" onclick={exit} data-testid="exit-btn">esc ✕</button>
      </div>
    </div>

    {#if !currentStory}
      <div class="flex-1 flex items-center justify-center text-neutral-content/40">No stories to show.</div>
    {:else}
      <!-- Main card -->
      <div class="flex-1 flex flex-col items-center justify-center">
        {#if currentGroup?.competency}
          <span class="badge badge-outline text-primary border-primary/40 mb-6 text-xs px-4 py-2"
            data-testid="competency-header">
            {currentGroup.competency}
          </span>
        {/if}

        <button
          class="w-full max-w-2xl text-left bg-neutral-800 rounded-2xl p-8 cursor-pointer hover:bg-neutral-700 transition-colors"
          onclick={() => expanded = !expanded}
          data-testid="story-card-interview"
        >
          <h2 class="text-3xl font-bold mb-4 text-neutral-content" data-testid="interview-story-title">
            {currentStory.title}
          </h2>

          {#if !expanded}
            <div class="text-xs text-primary/70 uppercase tracking-widest mb-3">2-line opening</div>
            <ul class="space-y-2" data-testid="action-crib">
              {#each currentStory.star.action.slice(0, 2) as action, i}
                <li class="text-neutral-content/70 flex gap-3 items-start">
                  <span class="text-primary shrink-0 font-bold">{i + 1}.</span>
                  <span>{action}</span>
                </li>
              {/each}
            </ul>
            <p class="text-xs text-neutral-content/30 mt-4">space / click to expand full STAR</p>
          {:else}
            <!-- Full STAR -->
            <div class="space-y-4 text-sm" data-testid="full-star">
              {#each [
                { key: 'S', label: 'Situation', value: currentStory.star.situation },
                { key: 'T', label: 'Task',      value: currentStory.star.task },
                { key: 'R', label: 'Result',    value: currentStory.star.result },
              ] as section}
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="w-5 h-5 rounded bg-primary text-primary-content text-xs font-bold flex items-center justify-center">{section.key}</span>
                    <span class="text-xs uppercase tracking-wider text-neutral-content/50">{section.label}</span>
                  </div>
                  <p class="text-neutral-content/80 ml-7">{section.value}</p>
                </div>
              {/each}
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="w-5 h-5 rounded bg-primary text-primary-content text-xs font-bold flex items-center justify-center">A</span>
                  <span class="text-xs uppercase tracking-wider text-neutral-content/50">Action</span>
                </div>
                <ul class="space-y-1 ml-7">
                  {#each currentStory.star.action as a}
                    <li class="text-neutral-content/80 flex gap-2 items-start">
                      <span class="text-primary shrink-0">▸</span><span>{a}</span>
                    </li>
                  {/each}
                </ul>
              </div>
            </div>
            <p class="text-xs text-neutral-content/30 mt-4">click to collapse</p>
          {/if}
        </button>
      </div>

      <!-- Nav row -->
      <div class="flex items-center justify-between mt-6 text-sm text-neutral-content/40">
        <button onclick={prevStory} data-testid="prev-story-btn">← prev</button>
        <span class="text-xs">← → navigate · space expand · esc exit</span>
        <button onclick={nextStory} data-testid="next-story-btn">next →</button>
      </div>
    {/if}
  </div>

<!-- ───────────────────────────────────────────────────────────────── -->
<!-- TRAIN: question-first                                             -->
<!-- ───────────────────────────────────────────────────────────────── -->
{:else if submode === 'train-question'}
  <div class="min-h-screen bg-neutral text-neutral-content flex flex-col p-8" data-testid="interview-view">

    <div class="flex items-center justify-between mb-6 text-sm text-neutral-content/60">
      <div class="flex items-center gap-2">
        <span class="text-primary text-xs">★</span>
        <span>StarLog · Mock Interview</span>
      </div>
      <div class="flex items-center gap-4">
        <span>{currentPosition} / {totalStories}</span>
        <button class="btn btn-ghost btn-xs text-neutral-content/60" onclick={exit} data-testid="exit-btn">esc ✕</button>
      </div>
    </div>

    {#if !currentStory}
      <div class="flex-1 flex items-center justify-center text-neutral-content/40">No stories to show.</div>
    {:else}
      <div class="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
        {#if currentGroup?.competency}
          <div class="text-xs text-primary/80 tracking-widest uppercase mb-4">
            Behavioural · {currentGroup.competency}
          </div>
        {/if}

        <!-- The question -->
        <div class="text-2xl font-bold leading-snug mb-8" data-testid="interview-story-title">
          "Tell me about a time you demonstrated {currentGroup?.competency ?? 'this'}."
        </div>

        <!-- Timer + reveal -->
        <div class="border border-neutral-700 rounded-2xl p-6 bg-neutral-800">
          {#if !questionRevealed}
            <div class="flex items-center justify-between">
              <p class="text-neutral-content/60 text-sm">Think for a moment, then reveal your story</p>
              <div class="font-mono text-3xl font-bold text-neutral-content">{formatTime(questionTimer)}</div>
            </div>
            <button
              class="btn btn-primary btn-lg w-full mt-4"
              onclick={revealStory}
            >
              Reveal my story · space
            </button>
          {:else}
            <div data-testid="full-star">
              <h3 class="text-xl font-bold mb-3">{currentStory.title}</h3>
              <ul class="space-y-2 text-sm text-neutral-content/80">
                {#each currentStory.star.action.slice(0, 2) as action, i}
                  <li class="flex gap-2">
                    <span class="text-primary font-bold">{i + 1}.</span><span>{action}</span>
                  </li>
                {/each}
              </ul>
              <p class="text-xs text-neutral-content/40 mt-2">click to expand full STAR</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Nav -->
      <div class="flex items-center justify-between mt-6 text-sm text-neutral-content/40">
        <button onclick={prevStory} data-testid="prev-story-btn">← skip</button>
        <span class="text-xs">space = reveal · → next</span>
        <button onclick={nextQuestion} data-testid="next-story-btn">next →</button>
      </div>
    {/if}
  </div>

<!-- ───────────────────────────────────────────────────────────────── -->
<!-- TRAIN: timer + self-rating                                        -->
<!-- ───────────────────────────────────────────────────────────────── -->
{:else if submode === 'train-timer'}
  <div class="min-h-screen bg-neutral text-neutral-content flex flex-col p-8" data-testid="interview-view">

    <div class="flex items-center justify-between mb-6 text-sm text-neutral-content/60">
      <div class="flex items-center gap-2">
        <span class="text-primary text-xs">★</span>
        <span>StarLog · Drill with timer</span>
      </div>
      <div class="flex items-center gap-4">
        <span>{currentPosition} / {totalStories}</span>
        <button class="btn btn-ghost btn-xs text-neutral-content/60" onclick={exit} data-testid="exit-btn">esc ✕</button>
      </div>
    </div>

    {#if !currentStory}
      <div class="flex-1 flex items-center justify-center text-neutral-content/40">No stories to show.</div>
    {:else}
      <div class="flex-1 flex flex-col gap-4 max-w-2xl mx-auto w-full">

        <!-- Timer bar -->
        <div>
          <div class="flex justify-between text-xs text-neutral-content/50 mb-1">
            <span>target: {TARGET_SECONDS}s</span>
            <button
              class="font-mono text-sm {timerElapsed > TARGET_SECONDS ? 'text-warning' : 'text-neutral-content'}"
              onclick={toggleTimer}
            >
              {formatTime(timerElapsed)} {timerRunning ? '⏸' : '▶'}
            </button>
            {#if timerElapsed > TARGET_SECONDS}
              <span class="text-warning">+{timerElapsed - TARGET_SECONDS}s over</span>
            {:else}
              <span>{TARGET_SECONDS - timerElapsed}s left</span>
            {/if}
          </div>
          <div class="h-2 bg-neutral-700 rounded-full overflow-hidden flex">
            <div class="h-full bg-primary transition-all" style="width: {Math.min(timerPct, 100)}%"></div>
            {#if overPct > 0}
              <div class="h-full bg-warning transition-all" style="width: {overPct}%"></div>
            {/if}
          </div>
        </div>

        <!-- Card -->
        <div class="flex-1 border border-neutral-700 rounded-2xl p-6 bg-neutral-800 flex flex-col gap-4"
          data-testid="story-card-interview">
          {#if currentGroup?.competency}
            <span class="badge badge-outline text-primary border-primary/40 self-start text-xs"
              data-testid="competency-header">{currentGroup.competency}</span>
          {/if}
          <h2 class="text-2xl font-bold" data-testid="interview-story-title">{currentStory.title}</h2>
          <div class="text-sm text-neutral-content/70 space-y-1.5" data-testid="full-star">
            <div class="flex gap-2"><span class="text-primary font-bold">S</span><span>{currentStory.star.situation}</span></div>
            <div class="flex gap-2"><span class="text-primary font-bold">T</span><span>{currentStory.star.task}</span></div>
            <div class="flex gap-2"><span class="text-primary font-bold">A</span>
              <span>{currentStory.star.action.slice(0, 2).join(' · ')}{currentStory.star.action.length > 2 ? '…' : ''}</span>
            </div>
            <div class="flex gap-2"><span class="text-primary font-bold">R</span><span>{currentStory.star.result}</span></div>
          </div>
        </div>

        <!-- Self-rating -->
        <div>
          <p class="text-xs text-neutral-content/40 uppercase tracking-widest mb-2">How did that feel?</p>
          <div class="grid grid-cols-5 gap-2">
            {#each RATINGS as label, i}
              <button
                class="border rounded-xl py-2 px-1 text-center text-xs transition-all
                  {selectedRating === i + 1
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-neutral-700 text-neutral-content/60 hover:border-primary/50'}"
                onclick={() => selectedRating = i + 1}
              >
                <div class="text-lg mb-1">{label.split(' ')[0]}</div>
                <div class="text-xs text-neutral-content/40">{i + 1} · {label.split(' ').slice(1).join(' ')}</div>
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Nav -->
      <div class="flex items-center justify-between mt-4 text-sm text-neutral-content/40">
        <button onclick={prevStory} data-testid="prev-story-btn">← prev</button>
        <span class="text-xs">rate 1–5 · → next</span>
        <button onclick={nextTimerStory} data-testid="next-story-btn">next →</button>
      </div>
    {/if}
  </div>

<!-- ───────────────────────────────────────────────────────────────── -->
<!-- LIVE: ⌘K palette                                                 -->
<!-- ───────────────────────────────────────────────────────────────── -->
{:else if submode === 'live'}
  <div class="min-h-screen bg-neutral text-neutral-content flex flex-col" data-testid="interview-view">

    <!-- Tiny header -->
    <div class="flex justify-between items-center px-5 py-3 border-b border-neutral-700 text-xs text-neutral-content/50">
      <span class="flex items-center gap-2"><span class="text-primary">★</span> StarLog · Live mode</span>
      <span>⌘K open · esc close</span>
    </div>

    <div class="flex-1 flex flex-col p-6 gap-4 max-w-2xl mx-auto w-full">

      <!-- Search input -->
      <div class="flex items-center gap-3 border-2 border-primary/40 rounded-xl px-4 py-3 bg-neutral-800">
        <span class="text-primary text-xl">⌘</span>
        <input
          class="flex-1 bg-transparent text-xl font-semibold placeholder-neutral-content/30 outline-none"
          placeholder="type a competency…"
          bind:value={liveQuery}
          autofocus
        />
        <span class="text-xs text-neutral-content/40">or 1–{groups.length} for competency</span>
      </div>

      <!-- Results -->
      {#if liveSelectedGroup && liveSelectedGroup.stories.length > 0}
        {@const story = liveSelectedGroup.stories[0]}
        <div class="border border-neutral-700 rounded-2xl bg-neutral-800 p-5 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            {#if liveSelectedGroup.competency}
              <span class="badge badge-outline text-primary border-primary/40 text-xs">
                {liveSelectedGroup.competency}
              </span>
            {/if}
            <span class="text-xs text-primary font-bold">★ go-to</span>
          </div>
          <div class="text-2xl font-bold">{story.title}</div>
          <div class="flex flex-col gap-2">
            <div class="text-xs text-primary/80 uppercase tracking-widest font-semibold">2-line opening</div>
            {#each story.star.action.slice(0, 2) as line, i}
              <div class="text-base text-neutral-content/80 flex gap-3">
                <span class="text-primary font-bold">{i + 1}.</span><span>{line}</span>
              </div>
            {/each}
          </div>
          <p class="text-xs text-neutral-content/40">↓ expand full STAR · ⏎ mark used</p>
        </div>
      {:else if liveQuery}
        <div class="text-center py-10 text-neutral-content/40 text-sm">No match for "{liveQuery}"</div>
      {/if}

      <!-- Competency shortcuts -->
      <div class="flex flex-wrap gap-2 mt-auto">
        {#each groups as g, i}
          <button
            class="text-xs px-3 py-1.5 rounded-lg border transition-colors
              {liveSelectedGroup === g
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-neutral-700 text-neutral-content/50 hover:border-primary/40'}"
            onclick={() => liveSelectedGroup = g}
          >
            <span class="font-mono opacity-60 mr-1">{i + 1}</span>
            {g.competency ?? 'All'}
          </button>
        {/each}
      </div>
    </div>

    <div class="px-6 pb-4 text-center">
      <button class="btn btn-ghost btn-sm text-neutral-content/40" onclick={exit}>esc · exit</button>
    </div>
  </div>
{/if}
