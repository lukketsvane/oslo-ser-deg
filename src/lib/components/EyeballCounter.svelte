<script lang="ts">
	import { identity } from '$lib/stores/identity';
</script>

<div class="eyeballs" title="@{$identity.handle} · {$identity.streak} dagars streak">
	<span class="eye">👁</span>
	<span class="num">{$identity.eyeballs}</span>
	<span class="label">eyeballs</span>
</div>

<style>
	.eyeballs {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: rgba(11, 16, 32, 0.85);
		color: #fff;
		padding: 8px 14px;
		border-radius: 999px;
		font-size: 14px;
		box-shadow: var(--shadow);
	}
	.num {
		font-weight: 700;
	}
	.label {
		opacity: 0.7;
		font-size: 12px;
	}
</style>
