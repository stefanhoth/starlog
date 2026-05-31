<script lang="ts">
	import BorderGlow from './BorderGlow.svelte';
	import type { Snippet } from 'svelte';

	let {
		active = false,
		class: className = '',
		children,
	}: { active?: boolean; class?: string; children?: Snippet } = $props();

	// Retrigger the sweep animation while active by incrementing a counter every 3.5 s.
	// The sweep itself takes ~4 s, so this keeps the glow continuous without gaps.
	let cycle = $state(0);
	$effect(() => {
		if (!active) return;
		cycle = 0;
		const id = setInterval(() => { cycle++; }, 3500);
		return () => clearInterval(id);
	});
</script>

{#if active}
	{#key cycle}
		<BorderGlow
			animated={true}
			backgroundColor="#ffffff"
			borderRadius={8}
			glowColor="243 75 59"
			colors={['#4f46e5', '#818cf8', '#6366f1']}
			glowIntensity={1.8}
			coneSpread={35}
			edgeSensitivity={10}
			class={className}
		>
			{@render children?.()}
		</BorderGlow>
	{/key}
{:else}
	<div class={className}>
		{@render children?.()}
	</div>
{/if}
