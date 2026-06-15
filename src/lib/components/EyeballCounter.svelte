<script lang="ts">
	import { identity } from '$lib/stores/identity';

	interface Props {
		onclick?: () => void;
	}
	let { onclick }: Props = $props();
</script>

<button
	class="eyeballs"
	class:guest={!$identity.account}
	onclick={() => onclick?.()}
	title={$identity.account ? `@${$identity.handle}` : 'Logg inn / lag konto'}
>
	<span class="eye-mark" aria-hidden="true"><i></i></span>
	{#if $identity.account}
		<span class="num">{$identity.eyeballs}</span>
		<span class="label">{$identity.handle}</span>
	{:else}
		<span class="label">Logg inn</span>
	{/if}
</button>

<style>
	.eyeballs {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		min-height: 38px;
		background: rgba(15, 23, 42, 0.9);
		color: white;
		padding: 7px 11px 7px 9px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 999px;
		font-size: 13px;
		box-shadow: var(--shadow-soft);
		max-width: 52vw;
		backdrop-filter: blur(16px) saturate(1.1);
	}
	.eye-mark {
		position: relative;
		width: 20px;
		height: 13px;
		border-radius: 999px 999px 55% 55%;
		background: var(--paper);
		flex: none;
	}
	.eye-mark i {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ink);
		transform: translate(-50%, -50%);
		box-shadow: 3px -3px 0 -2px white;
	}
	.num {
		font-weight: 850;
		letter-spacing: -0.03em;
	}
	.label {
		opacity: 0.72;
		font-size: 12px;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.guest .label {
		opacity: 1;
		font-weight: 800;
	}
</style>
