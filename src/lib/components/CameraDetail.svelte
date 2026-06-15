<script lang="ts">
	import type { Camera } from '$lib/types';
	import { EYEBALL_REWARD } from '$lib/types';
	import { colorFor } from '$lib/map/markers';

	interface Props {
		camera: Camera;
		onconfirm?: () => void;
		onadjust?: () => void;
		onestimate?: () => void;
	}
	let { camera, onconfirm, onadjust, onestimate }: Props = $props();

	const semje = $derived(camera.semje ?? 0);
	const isEstimat = $derived(camera.kamerastatus === 'Estimert' || camera.kamerastatus === 'Ukjent');
	const statusLabel = $derived(isEstimat ? 'Estimat' : (camera.kamerastatus ?? 'Ukjent'));
</script>

<div class="detail">
	<header>
		<span class="dot" style="background:{colorFor(camera.kamerastatus)}"></span>
		<h2>{camera.namn}</h2>
		<span class="status" style="color:{colorFor(camera.kamerastatus)}">{statusLabel}</span>
	</header>

	<div class="summary">
		<span class="sum-text"
			>{camera.stadfestingar} stadfesting{camera.stadfestingar === 1 ? '' : 'ar'}</span
		>
		<div class="bar"><span style="width:{semje}%"></span></div>
		<span class="pct">{semje}% semje</span>
	</div>

	{#if isEstimat}
		<p class="note">👁 Truleg her — meld inn om du veit meir.</p>
	{/if}

	<div class="bento">
		<div class="bento-cell"><span class="k">Type</span><span class="v">{camera.kategori ?? '—'}</span></div>
		<div class="bento-cell"><span class="k">Kjelde</span><span class="v">{camera.eigar ?? 'Fellesskapet'}</span></div>
		<div class="bento-cell"><span class="k">Bydel</span><span class="v">{camera.bydel ?? '—'}</span></div>
		<div class="bento-cell"><span class="k">Oppdatert</span><span class="v">{camera.sistOppdatert ?? '—'}</span></div>
		<div class="bento-cell wide"><span class="k">Belønning</span><span class="v">+{EYEBALL_REWARD.confirm} eyeballs</span></div>
	</div>

	{#if camera.bidragsytarar.length}
		<p class="contribs">
			{#each camera.bidragsytarar.slice(-4) as h}<span class="handle">@{h}</span>{/each}
		</p>
	{/if}

	<div class="btn-row actions">
		<button class="btn btn-sm" onclick={() => onconfirm?.()}>Stadfest</button>
		<button class="btn btn-sm btn-secondary" onclick={() => onadjust?.()}>Juster</button>
	</div>
	{#if isEstimat}
		<button class="errlink" onclick={() => onestimate?.()}>Det er feil / framleis estimat</button>
	{/if}
</div>

<style>
	header {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex: none;
	}
	h2 {
		margin: 0;
		font-size: 17px;
		line-height: 1.2;
		flex: 1;
		min-width: 0;
	}
	.status {
		font-size: 12px;
		font-weight: 700;
		flex: none;
	}
	.summary {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 10px 0;
	}
	.sum-text {
		font-size: 12px;
		font-weight: 600;
		color: var(--muted);
		white-space: nowrap;
	}
	.bar {
		flex: 1;
		height: 8px;
		border-radius: 999px;
		background: #eef0f4;
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--violet);
	}
	.pct {
		font-size: 12px;
		font-weight: 700;
		color: var(--violet);
		white-space: nowrap;
	}
	.note {
		background: #f6f3ff;
		color: #5b3fb5;
		padding: 8px 11px;
		border-radius: 10px;
		font-size: 12px;
		margin: 0 0 10px;
	}
	.contribs {
		font-size: 13px;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		margin: 10px 0 0;
	}
	.handle {
		color: var(--blue);
		font-weight: 600;
	}
	.actions {
		margin-top: 12px;
	}
	.errlink {
		display: block;
		width: 100%;
		margin-top: 8px;
		padding: 4px;
		border: none;
		background: transparent;
		color: var(--muted);
		font-size: 12px;
		text-align: center;
	}
</style>
