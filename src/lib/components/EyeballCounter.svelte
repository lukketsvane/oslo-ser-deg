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
	<span class="eye-mark" aria-hidden="true"><i></i></span>
	<span class="num">{$identity.eyeballs}</span>
	<span class="label">{$identity.account ? `@${$identity.handle}` : 'eyeballs'}</span>
</button>

<style>
	.eyeballs {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: rgba(6, 63, 61, 0.92);
		color: #fffaf0;
		padding: 8px 12px 8px 9px;
		border: 1px solid rgba(255, 250, 240, 0.22);
		border-radius: 999px;
		font-size: 13px;
		box-shadow: var(--shadow-soft);
		max-width: 48vw;
		backdrop-filter: blur(16px);
	}
	.eye-mark {
		position: relative;
		width: 20px;
		height: 14px;
		border-radius: 999px 999px 55% 55%;
		background: #fffaf0;
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
		box-shadow: 3px -3px 0 -2px #fffaf0;
	}
	.num {
		font-weight: 820;
		letter-spacing: -0.03em;
	}
	.label {
		opacity: 0.72;
		font-size: 11px;
		font-weight: 680;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
