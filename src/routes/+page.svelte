<script lang="ts">
	import { onMount } from 'svelte';
	import type L from 'leaflet';
	import Map from '$lib/components/Map.svelte';
	import BottomSheet, { type Snap } from '$lib/components/BottomSheet.svelte';
	import EyeballCounter from '$lib/components/EyeballCounter.svelte';
	import CameraDetail from '$lib/components/CameraDetail.svelte';
	import ContributionForm from '$lib/components/ContributionForm.svelte';
	import AddCameraForm from '$lib/components/AddCameraForm.svelte';
	import NearbyList from '$lib/components/NearbyList.svelte';
	import Autocomplete from '$lib/components/Autocomplete.svelte';
	import AuthSheet from '$lib/components/AuthSheet.svelte';
	import {
		cameras,
		loading,
		loadError,
		startPolling,
		addCamera,
		patchCamera
	} from '$lib/stores/cameras';
	import { identity } from '$lib/stores/identity';
	import { EYEBALL_REWARD, type Camera, type Confidence, type Kategori } from '$lib/types';

	type Mode = 'browse' | 'detail' | 'contribute' | 'adjust-move' | 'place-new' | 'add-form' | 'info';
	type Tab = 'Bekrefta' | 'Estimat' | 'Oppdrag';

	const tabs: Tab[] = ['Bekrefta', 'Estimat', 'Oppdrag'];

	let mode = $state<Mode>('browse');
	let tab = $state<Tab>('Estimat');
	let selected = $state<Camera | null>(null);
	let userLatLng = $state<{ lat: number; lng: number } | null>(null);
	let busy = $state(false);
	let toast = $state<string | null>(null);
	let snap = $state<Snap>('peek');
	let prefillName = $state('');
	let authOpen = $state(false);

	let mapComp: Map;

	onMount(() => startPolling(7000));

	$effect(() => {
		if (selected) {
			const fresh = $cameras.find((c) => c.id === selected!.id);
			if (fresh) selected = fresh;
		}
	});

	const counts = $derived.by(() => {
		let bekrefta = 0;
		let estimat = 0;
		let oppdrag = 0;
		for (const c of $cameras) {
			if (c.kamerastatus === 'Stadfesta') bekrefta++;
			else if (c.kamerastatus === 'Estimert') estimat++;
			if (c.kamerastatus === 'Estimert' || c.kamerastatus === 'Ukjent') oppdrag++;
		}
		return { bekrefta, estimat, oppdrag, totalt: $cameras.length };
	});

	const visible = $derived.by(() => {
		const list = $cameras;
		if (tab === 'Bekrefta') return list.filter((c) => c.kamerastatus === 'Stadfesta');
		if (tab === 'Estimat') return list.filter((c) => c.kamerastatus === 'Estimert');
		return list.filter((c) => c.kamerastatus === 'Estimert' || c.kamerastatus === 'Ukjent');
	});

	function flash(msg: string) {
		toast = msg;
		setTimeout(() => (toast = null), 2600);
	}

	function openInfo() {
		selected = null;
		mode = mode === 'info' ? 'browse' : 'info';
		snap = mode === 'info' ? 'half' : 'peek';
	}

	function openCamera(cam: Camera) {
		selected = cam;
		mode = 'detail';
		snap = 'half';
		if (cam.lat != null && cam.lng != null) mapComp?.flyTo(cam.lat, cam.lng);
	}

	async function doConfirm(data: { confirm: boolean; confidence: Confidence; note: string }) {
		if (!selected) return;
		busy = true;
		const action = data.confirm ? 'confirm' : 'estimate';
		try {
			await patchCamera(
				selected.id,
				{ action, handle: $identity.handle, confidence: data.confidence, note: data.note },
				{
					stadfestingar: selected.stadfestingar + (data.confirm ? 1 : 0),
					bidragsytarar: [...selected.bidragsytarar, $identity.handle]
				}
			);
			identity.award(EYEBALL_REWARD[action]);
			flash(`Takk! +${EYEBALL_REWARD[action]} eyeballs`);
			mode = 'detail';
		} catch {
			flash('Noko gjekk gale — prøv igjen');
		} finally {
			busy = false;
		}
	}

	function startAdjust() {
		if (!selected) return;
		if (selected.lat != null && selected.lng != null) mapComp?.flyTo(selected.lat, selected.lng);
		mode = 'adjust-move';
		snap = 'peek';
	}

	async function saveMove() {
		const c: L.LatLng | null = mapComp?.center() ?? null;
		if (!selected || !c) return;
		busy = true;
		try {
			await patchCamera(
				selected.id,
				{ action: 'move', lat: c.lat, lng: c.lng },
				{ lat: c.lat, lng: c.lng }
			);
			identity.award(EYEBALL_REWARD.move);
			flash('Plassering lagra');
			mode = 'detail';
			snap = 'half';
		} catch {
			flash('Kunne ikkje lagre plassering');
		} finally {
			busy = false;
		}
	}

	function startPlaceNew() {
		selected = null;
		prefillName = '';
		mode = 'place-new';
		snap = 'peek';
	}

	let pending: { lat: number; lng: number } | null = $state(null);
	function confirmPlacement() {
		const c = mapComp?.center();
		if (!c) return;
		pending = { lat: c.lat, lng: c.lng };
		mode = 'add-form';
		snap = 'half';
	}

	// global search: fly there and start placing a point at that spot
	function onSearchSelect(hit: { namn: string; lat: number; lng: number }) {
		mapComp?.flyTo(hit.lat, hit.lng, 17);
		pending = { lat: hit.lat, lng: hit.lng };
		prefillName = hit.namn;
		mode = 'place-new';
		snap = 'peek';
	}

	async function saveNew(data: { namn: string; kategori: Kategori; confirm: boolean }) {
		if (!pending) return;
		busy = true;
		try {
			const created = await addCamera({
				namn: data.namn,
				kategori: data.kategori,
				lat: pending.lat,
				lng: pending.lng,
				kamerastatus: data.confirm ? 'Stadfesta' : 'Estimert',
				handle: $identity.handle
			});
			identity.award(EYEBALL_REWARD.add);
			flash(`Lagt til! +${EYEBALL_REWARD.add} eyeballs`);
			openCamera(created);
		} catch {
			flash('Kunne ikkje lagre punktet');
		} finally {
			busy = false;
			pending = null;
		}
	}

	function close() {
		mode = 'browse';
		selected = null;
		snap = 'peek';
	}

	function locateMe() {
		mapComp?.locate();
	}

	const adjusting = $derived(mode === 'adjust-move' || mode === 'place-new');
	const browseChrome = $derived(mode === 'browse');
</script>

<div class="app">
	<Map
		bind:this={mapComp}
		cameras={browseChrome ? visible : $cameras}
		selectedId={selected?.id}
		adjustMode={adjusting}
		onselect={openCamera}
		onuserlocation={(ll) => (userLatLng = { lat: ll.lat, lng: ll.lng })}
		onbackground={() => (mode === 'detail' || mode === 'info') && close()}
	/>

	<div class="topbar">
		<button class="brand-btn" class:active={mode === 'info'} onclick={openInfo} aria-label="Opne info">
			<span class="logo-mark" aria-hidden="true"></span>
			<span class="brand-copy">
				<strong>OsloSerDeg</strong>
				<small>overvaking.iverfinne.no</small>
			</span>
		</button>
		<EyeballCounter onclick={() => (authOpen = true)} />
	</div>

	{#if authOpen}
		<AuthSheet onclose={() => (authOpen = false)} />
	{/if}

	{#if browseChrome}
		<div class="searchbar">
			<Autocomplete placeholder="Søk adresse eller bedrift…" onselect={onSearchSelect} />
		</div>
		<div class="tabs-top">
			{#each tabs as t}
				<button class="chip" class:active={tab === t} onclick={() => (tab = t)}>{t}</button>
			{/each}
		</div>
	{/if}

	{#if mode !== 'adjust-move' && mode !== 'place-new'}
		<button class="fab locate" onclick={locateMe} aria-label="Finn meg">◎</button>
	{/if}

	{#if toast}
		<div class="toast">{toast}</div>
	{/if}

	<BottomSheet
		bind:snap
		peekPx={82}
		ondismiss={mode === 'detail' || mode === 'contribute' || mode === 'info' ? close : undefined}
	>
		{#if mode === 'info'}
			<div class="info-panel">
				<header class="info-hero">
					<span class="logo-mark logo-large" aria-hidden="true"></span>
					<div>
						<p class="eyebrow">ope kart · Oslo</p>
						<h1>Oslo ser deg</h1>
						<p class="lead">Eit ope, etterprøvbart kart over kamera og overvaking i byrommet.</p>
					</div>
				</header>

				<div class="stats-grid">
					<div><span>{counts.totalt}</span><small>punkt totalt</small></div>
					<div><span>{counts.bekrefta}</span><small>stadfesta</small></div>
					<div><span>{counts.estimat}</span><small>estimat</small></div>
					<div><span>{counts.oppdrag}</span><small>oppdrag</small></div>
				</div>

				<div class="legend-card">
					<p><i class="d blue"></i><span>Stadfesta kamera</span></p>
					<p><i class="d violet"></i><span>Estimert punkt</span></p>
					<p><i class="d grey"></i><span>Treng sjekk</span></p>
				</div>

				<div class="btn-row">
					<button class="btn btn-sm btn-secondary" onclick={close}>Til kart</button>
					<button class="btn btn-sm" onclick={startPlaceNew}>Legg til kamera</button>
				</div>
			</div>
		{:else if mode === 'detail' && selected}
			<div class="detail-top">
				<button class="back" onclick={close}>
					<span class="chev">‹</span> Kart
				</button>
			</div>
			<CameraDetail
				camera={selected}
				onconfirm={() => (mode = 'contribute')}
				onestimate={() => (mode = 'contribute')}
				onadjust={startAdjust}
			/>
		{:else if mode === 'contribute' && selected}
			<ContributionForm
				camera={selected}
				{busy}
				onsubmit={doConfirm}
				oncancel={() => (mode = 'detail')}
			/>
		{:else if mode === 'adjust-move'}
			<div class="action-card">
				<h2>Juster plassering</h2>
				<p class="muted">Flytt kartet så krysshåret står på kameraet.</p>
				<div class="btn-row">
					<button class="btn btn-sm btn-secondary" onclick={() => (mode = 'detail')}>Tilbake</button>
					<button class="btn btn-sm" disabled={busy} onclick={saveMove}>
						{busy ? 'Lagrar…' : 'Lagre'}
					</button>
				</div>
			</div>
		{:else if mode === 'place-new'}
			<div class="action-card">
				<h2>Plasser nytt punkt</h2>
				<p class="muted">Flytt kartet så krysshåret står på kameraet.</p>
				<div class="btn-row">
					<button class="btn btn-sm btn-secondary" onclick={close}>Avbryt</button>
					<button class="btn btn-sm" onclick={confirmPlacement}>Set punkt her</button>
				</div>
			</div>
		{:else if mode === 'add-form'}
			<AddCameraForm
				{busy}
				initialName={prefillName}
				onsubmit={saveNew}
				ongeocode={(hit) => {
					pending = { lat: hit.lat, lng: hit.lng };
					mapComp?.flyTo(hit.lat, hit.lng, 17);
				}}
				oncancel={() => (mode = 'place-new')}
			/>
		{:else if snap === 'peek'}
			<div class="peek">
				<div class="peek-row">
					<div>
						<strong>{tab === 'Oppdrag' ? 'Oppdrag nær deg' : 'Kartlagde kamera'}</strong>
						<p class="hint">Trykk eit punkt · dra opp for liste</p>
					</div>
					<div class="legend">
						<span><i class="d blue"></i>{counts.bekrefta}</span>
						<span><i class="d violet"></i>{counts.estimat}</span>
						<span><i class="d grey"></i>{counts.oppdrag}</span>
					</div>
				</div>
			</div>
		{:else}
			<div class="sheet-head">
				<h1>{tab === 'Oppdrag' ? 'Oppdrag nær deg' : 'Nær deg'}</h1>
				<span class="count">{visible.length} punkt</span>
			</div>
			{#if $loading}
				<p class="muted">Lastar kart…</p>
			{:else if $loadError}
				<p class="muted">Feil: {$loadError}</p>
			{:else}
				<NearbyList
					cameras={$cameras}
					{userLatLng}
					missionsOnly={tab === 'Oppdrag'}
					onselect={openCamera}
				/>
			{/if}
			{#if tab !== 'Oppdrag'}
				<button class="btn add-inline" onclick={startPlaceNew}>Legg til kamera</button>
			{/if}
		{/if}
	</BottomSheet>
</div>

<style>
	.app {
		position: fixed;
		inset: 0;
		overflow: hidden;
	}
	.topbar {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 650;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: calc(env(safe-area-inset-top) + 8px) 12px 8px;
		background: linear-gradient(rgba(238, 248, 246, 0.96), rgba(238, 248, 246, 0.72), transparent);
		pointer-events: none;
	}
	.topbar :global(*) {
		pointer-events: auto;
	}
	.brand-btn {
		display: inline-flex;
		align-items: center;
		gap: 9px;
		min-width: 0;
		border: 1px solid rgba(6, 63, 61, 0.12);
		border-radius: 999px;
		background: rgba(255, 250, 240, 0.82);
		backdrop-filter: blur(16px);
		color: var(--ink);
		padding: 7px 11px 7px 8px;
		box-shadow: var(--shadow-soft);
	}
	.brand-btn.active {
		background: var(--ink);
		color: #fffaf0;
	}
	.logo-mark {
		position: relative;
		display: inline-block;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: conic-gradient(from 180deg, var(--coral) 0 25%, var(--mustard) 25% 50%, var(--aqua) 50% 100%);
		box-shadow: inset 0 0 0 1px rgba(6, 63, 61, 0.1);
		flex: none;
		overflow: hidden;
	}
	.logo-mark::before {
		content: '';
		position: absolute;
		left: 3px;
		right: 3px;
		top: 9px;
		height: 10px;
		border-radius: 999px 999px 55% 55%;
		background: #fffaf0;
	}
	.logo-mark::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--ink);
		transform: translate(-50%, -50%);
		box-shadow: 3px -3px 0 -1px #fffaf0;
	}
	.logo-large {
		width: 54px;
		height: 54px;
	}
	.logo-large::before {
		left: 6px;
		right: 6px;
		top: 18px;
		height: 18px;
	}
	.logo-large::after {
		width: 19px;
		height: 19px;
		box-shadow: 6px -6px 0 -2px #fffaf0;
	}
	.brand-copy {
		display: grid;
		line-height: 1.05;
		text-align: left;
		min-width: 0;
	}
	.brand-copy strong {
		font-size: 14px;
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	.brand-copy small {
		font-size: 10px;
		color: currentColor;
		opacity: 0.62;
		white-space: nowrap;
	}
	.searchbar {
		position: absolute;
		top: calc(env(safe-area-inset-top) + 58px);
		left: 12px;
		right: 12px;
		z-index: 650;
	}
	.searchbar :global(input) {
		border-radius: 999px;
		box-shadow: var(--shadow-soft);
		border-color: rgba(6, 63, 61, 0.12);
		padding: 11px 16px;
		background: rgba(255, 250, 240, 0.9);
		backdrop-filter: blur(16px);
	}
	.tabs-top {
		position: absolute;
		top: calc(env(safe-area-inset-top) + 108px);
		left: 0;
		right: 0;
		z-index: 640;
		display: flex;
		gap: 7px;
		justify-content: center;
		padding: 0 12px;
	}
	.fab {
		position: absolute;
		right: 14px;
		bottom: calc(env(safe-area-inset-bottom) + 100px);
		z-index: 590;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		border: 1px solid rgba(6, 63, 61, 0.14);
		background: rgba(255, 250, 240, 0.9);
		backdrop-filter: blur(16px);
		box-shadow: var(--shadow-soft);
		font-size: 19px;
		color: var(--ink);
	}

	.peek {
		display: grid;
		gap: 6px;
	}
	.peek-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}
	.peek strong {
		font-size: 14px;
		letter-spacing: -0.01em;
	}
	.hint {
		margin: 1px 0 0;
		font-size: 11px;
		color: var(--muted);
	}
	.legend {
		display: flex;
		gap: 9px;
		font-size: 12px;
		font-weight: 760;
		color: var(--ink);
		white-space: nowrap;
	}
	.legend span,
	.legend-card p {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.d {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		display: inline-block;
	}
	.d.blue {
		background: var(--blue);
	}
	.d.violet {
		background: var(--violet);
	}
	.d.grey {
		background: #9aa8a5;
	}
	.sheet-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	h1 {
		font-size: 20px;
		margin: 0 0 8px;
		letter-spacing: -0.03em;
	}
	.count {
		color: var(--muted);
		font-size: 13px;
	}
	.muted {
		color: var(--muted);
		font-size: 14px;
	}
	.add-inline {
		margin-top: 14px;
	}
	.detail-top {
		margin: -2px 0 10px;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 34px;
		padding: 6px 12px 6px 8px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.66);
		color: var(--ink);
		font-size: 13px;
		font-weight: 700;
	}
	.back .chev {
		font-size: 19px;
		line-height: 1;
		margin-top: -1px;
	}
	.action-card {
		display: grid;
		gap: 8px;
	}
	.action-card h2 {
		margin: 0;
		font-size: 19px;
		letter-spacing: -0.02em;
	}
	.info-panel {
		display: grid;
		gap: 12px;
	}
	.info-hero {
		display: flex;
		align-items: center;
		gap: 13px;
	}
	.eyebrow {
		margin: 0 0 2px;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.lead {
		margin: 0;
		font-size: 13px;
		line-height: 1.35;
		color: var(--muted);
	}
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 7px;
	}
	.stats-grid div {
		min-width: 0;
		border-radius: 16px;
		padding: 10px 8px;
		background: rgba(255, 255, 255, 0.68);
		border: 1px solid var(--line);
		text-align: center;
	}
	.stats-grid span {
		display: block;
		font-size: 20px;
		font-weight: 820;
		line-height: 1;
		letter-spacing: -0.04em;
	}
	.stats-grid small {
		display: block;
		margin-top: 4px;
		font-size: 10px;
		font-weight: 700;
		color: var(--muted);
		white-space: nowrap;
	}
	.legend-card {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 6px;
		padding: 10px;
		border-radius: 18px;
		background: rgba(6, 63, 61, 0.05);
	}
	.legend-card p {
		margin: 0;
		font-size: 11px;
		font-weight: 700;
		color: var(--muted);
	}
	.toast {
		position: absolute;
		top: calc(env(safe-area-inset-top) + 132px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 700;
		background: var(--ink);
		color: #fffaf0;
		padding: 10px 16px;
		border-radius: 999px;
		font-size: 14px;
		box-shadow: var(--shadow);
	}
</style>
