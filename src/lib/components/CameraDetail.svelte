<script lang="ts">
	import type { Camera } from '$lib/types';
	import { EYEBALL_REWARD } from '$lib/types';
	import { colorFor } from '$lib/map/markers';
	import { kategoriLabel, statusLabel } from '$lib/labels';

	interface Props {
		camera: Camera;
		onconfirm?: () => void;
		onadjust?: () => void;
		onestimate?: () => void;
		onclose?: () => void;
	}
	let { camera, onconfirm, onadjust, onestimate, onclose }: Props = $props();

	const semje = $derived(camera.semje ?? 0);
	const isEstimat = $derived(camera.kamerastatus === 'Estimert' || camera.kamerastatus === 'Ukjent');
	const statusText = $derived(isEstimat ? 'Estimat' : statusLabel(camera.kamerastatus));
</script>

<div class="detail">
	<header class="topline">
		<div class="name-row">
			<span class="dot" style="background:{colorFor(camera.kamerastatus)}"></span>
			<div class="title">
				<h2>{camera.namn}</h2>
				<span>{statusText} · {camera.bydel ?? 'Oslo'}</span>
			</div>
		</div>
		<button class="close" onclick={() => onclose?.()} aria-label="Lukk detaljer">×</button>
	</header>

	<div class="metric-row">
		<strong>{camera.stadfestingar} bekreftelse{camera.stadfestingar === 1 ? '' : 'r'}</strong>
		<div class="bar"><span style="width:{semje}%"></span></div>
		<strong>{semje}%</strong>
	</div>

	{#if isEstimat}
		<button class="notice" onclick={() => onconfirm?.()}>
			<span>Kan eksistere her</span>
			<b>+{EYEBALL_REWARD.confirm}</b>
		</button>
	{/if}

	<div class="bento compact">
		<div class="bento-cell main"><span class="k">Type</span><span class="v">{kategoriLabel(camera.kategori)}</span></div>
		<div class="bento-cell"><span class="k">Kilde</span><span class="v">{camera.eigar ?? 'Fellesskapet'}</span></div>
		<div class="bento-cell"><span class="k">Bydel</span><span class="v">{camera.bydel ?? '—'}</span></div>
		<div class="bento-cell"><span class="k">Oppdatert</span><span class="v">{camera.sistOppdatert ?? '—'}</span></div>
	</div>

	{#if camera.bidragsytarar.length}
		<p class="contribs">
			{#each camera.bidragsytarar.slice(-4) as h}<span>{h}</span>{/each}
		</p>
	{/if}

	<div class="btn-row actions">
		<button class="btn btn-sm" onclick={() => onconfirm?.()}>Bekreft</button>
		<button class="btn btn-sm btn-secondary" onclick={() => onadjust?.()}>Juster</button>
	</div>
	{#if isEstimat}
		<button class="errlink" onclick={() => onestimate?.()}>Fortsatt usikkert</button>
	{/if}
</div>

<style>
	.detail {
		display: grid;
		gap: 10px;
	}
	.topline {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}
	.name-row {
		display: flex;
		align-items: flex-start;
		gap: 9px;
		min-width: 0;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex: none;
		margin-top: 8px;
		box-shadow: 0 0 0 4px rgba(0, 90, 85, 0.1);
	}
	.title {
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-size: 20px;
		line-height: 1.08;
		letter-spacing: -0.04em;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.title span {
		display: block;
		margin-top: 4px;
		font-size: 13px;
		font-weight: 760;
		color: var(--violet);
	}
	.close {
		width: 36px;
		height: 36px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.05);
		color: var(--ink);
		font-size: 22px;
		line-height: 1;
		flex: none;
	}
	.metric-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 9px;
		font-size: 13px;
		color: var(--muted);
	}
	.metric-row strong {
		font-size: 13px;
		font-weight: 820;
		color: var(--ink);
		white-space: nowrap;
	}
	.bar {
		height: 7px;
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.07);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, var(--violet), var(--blue));
	}
	.notice {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		width: 100%;
		border: 1px solid rgba(255, 115, 109, 0.18);
		border-radius: 16px;
		background: rgba(255, 115, 109, 0.1);
		color: #b23b35;
		padding: 10px 12px;
		font-size: 13px;
		font-weight: 760;
		text-align: left;
	}
	.notice b {
		font-size: 12px;
		padding: 4px 8px;
		border-radius: 999px;
		background: rgba(255,255,255,.7);
	}
	.bento.compact {
		grid-template-columns: 1.1fr 1fr;
		gap: 8px;
	}
	.bento-cell {
		padding: 9px 10px;
		border-radius: 15px;
		background: rgba(15, 23, 42, 0.035);
	}
	.bento-cell.main {
		grid-row: span 2;
	}
	.bento-cell .k {
		font-size: 10px;
		letter-spacing: 0;
		text-transform: none;
	}
	.bento-cell .v {
		font-size: 13px;
		line-height: 1.22;
	}
	.contribs {
		display: flex;
		gap: 6px;
		margin: -1px 0;
		overflow: hidden;
	}
	.contribs span {
		font-size: 11px;
		font-weight: 760;
		color: var(--muted);
		background: rgba(15, 23, 42, 0.04);
		padding: 5px 8px;
		border-radius: 999px;
		white-space: nowrap;
	}
	.actions {
		margin-top: 2px;
	}
	.errlink {
		width: 100%;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 12px;
		font-weight: 720;
		text-align: center;
		padding: 2px 0 0;
	}
</style>
