<script lang="ts">
	import { identity } from '$lib/stores/identity';

	interface Props {
		onclick?: () => void;
	}
	let { onclick }: Props = $props();
</script>

<button
	class="eyeballs"
	onclick={() => onclick?.()}
	title={$identity.account ? `@${$identity.handle}` : 'Logg inn / lag konto'}
>
	<span class="eye">👁</span>
	<span class="num">{$identity.eyeballs}</span>
	<span class="label">{$identity.account ? `@${$identity.handle}` : 'eyeballs'}</span>
</button>

<style>
	.eyeballs {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: rgba(11, 16, 32, 0.85);
		color: #fff;
		padding: 8px 14px;
		border: none;
		border-radius: 999px;
		font-size: 14px;
		box-shadow: var(--shadow);
		max-width: 60vw;
	}
	.num {
		font-weight: 700;
	}
	.label {
		opacity: 0.7;
		font-size: 12px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
