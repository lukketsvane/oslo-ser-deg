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
		<div class="title">
			<h2>{camera.namn}</h2>
			<span class="subline">{camera.bydel ?? 'Oslo'} · {camera.kategori ?? 'Kamera'}</span>
		</div>
		<span class="status" style="color:{colorFor(camera.kamerastatus)}">{statusLabel}</span>
	</header>

	<div class="summary">
		<span class="sum-text">{camera.stadfestingar} stadfesting{camera.stadfestingar === 1 ? '' : 'ar'}</span>
		<div class="bar"><span style="width:{semje}%"></span></div>
		<span class="pct">{semje}%</span>
	</div>

	{#if isEstimat}
		<p class="note">Truleg her. Sjekk punktet fysisk og stadfest eller juster.</p>
	{/if}

	<div class="bento">
		<div class="bento-cell"><span class="k">Type</span><span class="v">{camera.kategori ?? '—'}</span></div>
		<div class="bento-cell"><span class="k">Kjelde</span><span class="v">{camera.eigar ?? 'Fellesskapet'}</span></div>
		<div class="bento-cell"><span class="k">Bydel</span><span class="v">{camera.bydel ?? '—'}</span></div>
		<div class="bento-cell"><span class="k">Oppdatert</span><span class="v">{camera.sistOppdatert ?? '—'}</span></div>
		<div class="bento-cell wide"><span class="k">Belønning</span><span class="v">+{EYEBALL_REWARD.confirm} eyeballs for stadfesting</span></div>
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
	.detail {
		display: grid;
		gap: 10px;
	}
	header {
		display: flex;
		align-items: flex-start;
		gap: 9px;
	}
	.dot {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		flex: none;
		margin-top: 5px;
		box-shadow: 0 0 0 4px rgba(0, 90, 85, 0.08);
	}
	.title {
		flex: 1;
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-size: 18px;
		line-height: 1.12;
		letter-spacing: -0.03em;
		min-width: 0;
	}
	.subline {
		display: block;
		margin-top: 2px;
		font-size: 12px;
		font-weight: 650;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.status {
		font-size: 11px;
		font-weight: 800;
		flex: none;
		padding: 5px 8px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.66);
		border: 1px solid var(--line);
	}
	.summary {
		display: flex;
		align-items: center;
		gap: 9px;
		margin: -2px 0 0;
	}
	.sum-text {
		font-size: 12px;
		font-weight: 700;
		color: var(--muted);
		white-space: nowrap;
	}
	.bar {
		flex: 1;
		height: 8px;
		border-radius: 999px;
		background: rgba(6, 63, 61, 0.08);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, var(--coral), var(--mustard));
	}
	.pct {
		font-size: 12px;
		font-weight: 800;
		color: var(--ink);
		white-space: nowrap;
	}
	.note {
		background: rgba(255, 199, 94, 0.2);
		color: #6b4a00;
		padding: 9px 11px;
		border-radius: 14px;
		font-size: 12px;
		font-weight: 650;
		margin: 0;
	}
	.contribs {
		font-size: 12px;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		margin: 0;
	}
	.handle {
		color: var(--blue);
		font-weight: 750;
		background: rgba(0, 90, 85, 0.08);
		padding: 4px 7px;
		border-radius: 999px;
	}
	.actions {
		margin-top: 2px;
	}
	.errlink {
		display: block;
		width: 100%;
		margin-top: -2px;
		padding: 4px;
		border: none;
		background: transparent;
		color: var(--muted);
		font-size: 12px;
		font-weight: 650;
		text-align: center;
	}
</style>
