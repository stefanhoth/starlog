<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		active = false,
		class: className = '',
		children,
	}: { active?: boolean; class?: string; children?: Snippet } = $props();
</script>

<div class="relative {className}">
	{@render children?.()}
	{#if active}
		<span class="absolute inset-0 pointer-events-none ai-glow" aria-hidden="true"></span>
	{/if}
</div>

<style>
	@property --ai-angle {
		syntax: '<angle>';
		initial-value: 0deg;
		inherits: false;
	}

	.ai-glow {
		border-radius: inherit;
	}

	/* Sweeping gradient border — visible only in the border region via mask-composite */
	.ai-glow::before {
		content: '';
		position: absolute;
		inset: -1.5px;
		border-radius: inherit;
		padding: 1.5px;
		background: conic-gradient(
			from var(--ai-angle),
			transparent 55%,
			#4f46e5 70%,
			#818cf8 82%,
			#6366f1 90%,
			transparent 100%
		);
		-webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask-composite: exclude;
		animation: ai-sweep 3.5s linear infinite;
	}

	/* Soft outer glow following the sweep */
	.ai-glow::after {
		content: '';
		position: absolute;
		inset: -5px;
		border-radius: inherit;
		background: conic-gradient(
			from var(--ai-angle),
			transparent 60%,
			rgba(99, 102, 241, 0.35) 75%,
			rgba(129, 140, 248, 0.25) 85%,
			transparent 95%
		);
		filter: blur(7px);
		animation: ai-sweep 3.5s linear infinite;
	}

	@keyframes ai-sweep {
		to { --ai-angle: 360deg; }
	}
</style>
