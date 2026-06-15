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
</script>

<div class="detail">
	<header>
		<div>
			<h2>{camera.namn}</h2>
			<span class="status" style="color:{colorFor(camera.kamerastatus)}">
				● {camera.kamerastatus ?? 'Ukjent'}
			</span>
		</div>
	</header>

	<p class="summary">
		{camera.stadfestingar} stadfesting{camera.stadfestingar === 1 ? '' : 'ar'} · {semje}% semje
	</p>
	<div class="bar"><span style="width:{semje}%"></span></div>

	{#if isEstimat}
		<p class="note">
			Dette kamerapunktet kan eksistere. Fellesskapet meiner det sannsynlegvis er her.
		</p>
	{/if}

	<dl class="facts">
		<div><dt>Type</dt><dd>{camera.kategori ?? '—'}</dd></div>
		<div><dt>Eigar / kjelde</dt><dd>{camera.eigar ?? 'Fellesskapet'}</dd></div>
		<div><dt>Bydel</dt><dd>{camera.bydel ?? '—'}</dd></div>
		<div><dt>Sist oppdatert</dt><dd>{camera.sistOppdatert ?? '—'}</dd></div>
		<div><dt>Belønning</dt><dd>+{EYEBALL_REWARD.confirm} eyeballs</dd></div>
	</dl>

	{#if camera.bidragsytarar.length}
		<p class="contribs">
			Siste bidrag:
			{#each camera.bidragsytarar.slice(-4) as h}<span class="handle">@{h}</span>{/each}
		</p>
	{/if}

	<div class="actions">
		<button class="btn" onclick={() => onconfirm?.()}>
			Stadfest +{EYEBALL_REWARD.confirm} eyeballs
		</button>
		{#if isEstimat}
			<button class="btn btn-secondary" onclick={() => onestimate?.()}>
				Det er feil / framleis estimat
			</button>
		{/if}
		<button class="btn btn-ghost" onclick={() => onadjust?.()}>Juster plassering</button>
	</div>
</div>

<style>
	h2 {
		margin: 0 0 2px;
		font-size: 20px;
	}
	.status {
		font-size: 13px;
		font-weight: 600;
	}
	.summary {
		margin: 12px 0 6px;
		font-weight: 600;
		font-size: 14px;
	}
	.bar {
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
	.note {
		background: #f6f3ff;
		color: #5b3fb5;
		padding: 10px 12px;
		border-radius: 10px;
		font-size: 13px;
		margin: 12px 0;
	}
	.facts {
		margin: 14px 0;
		display: grid;
		gap: 8px;
	}
	.facts div {
		display: flex;
		justify-content: space-between;
		font-size: 14px;
	}
	.facts dt {
		color: var(--muted);
	}
	.facts dd {
		margin: 0;
		font-weight: 600;
	}
	.contribs {
		font-size: 13px;
		color: var(--muted);
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	.handle {
		color: var(--blue);
		font-weight: 600;
	}
	.actions {
		margin-top: 14px;
		display: grid;
		gap: 8px;
	}
</style>
