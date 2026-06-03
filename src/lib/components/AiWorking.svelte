<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		active = false,
		class: className = '',
		children,
	}: { active?: boolean; class?: string; children?: Snippet } = $props();
</script>

<div class="relative {className}" class:ai-active={active}>
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

	/* While AI is working, reset the wrapped button to page-background + readable text.
	   The animated ring on the overlay span serves as the visible border. */
	.ai-active :global(.btn) {
		background-color: #ffffff !important;
		color: rgba(15, 23, 42, 0.55) !important;
		border-color: transparent !important;
		opacity: 1 !important;
	}

	.ai-glow {
		border-radius: var(--rounded-btn, 0.5rem);
		animation: ai-pulse 1.8s ease-in-out infinite;
	}

	@keyframes ai-pulse {
		0%, 100% {
			box-shadow:
				0 0 0 1.5px rgba(99, 102, 241, 0.65),
				0 0 10px 2px rgba(99, 102, 241, 0.2);
		}
		50% {
			box-shadow:
				0 0 0 2.5px rgba(99, 102, 241, 1),
				0 0 18px 4px rgba(99, 102, 241, 0.4),
				0 0 32px 6px rgba(79, 70, 229, 0.2);
		}
	}

	/* Sweeping arc around the border — premium detail on top of the pulse */
	.ai-glow::before {
		content: '';
		position: absolute;
		inset: -2px;
		border-radius: inherit;
		padding: 2px;
		background: conic-gradient(
			from var(--ai-angle),
			transparent 55%,
			#4f46e5 70%,
			#818cf8 82%,
			#6366f1 90%,
			transparent 100%
		);
		-webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
		mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask-composite: exclude;
		animation: ai-sweep 3.5s linear infinite;
	}

	@keyframes ai-sweep {
		to { --ai-angle: 360deg; }
	}
</style>
