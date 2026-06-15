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

	type Mode = 'browse' | 'detail' | 'contribute' | 'adjust-move' | 'place-new' | 'add-form';
	type Tab = 'Bekrefta' | 'Estimat' | 'Oppdrag';

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
		return { bekrefta, estimat, oppdrag };
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
	const showChrome = $derived(mode === 'browse' || mode === 'detail' || mode === 'contribute');
</script>

<div class="app">
	<Map
		bind:this={mapComp}
		cameras={showChrome ? visible : $cameras}
		selectedId={selected?.id}
		adjustMode={adjusting}
		onselect={openCamera}
		onuserlocation={(ll) => (userLatLng = { lat: ll.lat, lng: ll.lng })}
	/>

	<div class="topbar">
		<div class="brand">cctv.oslo.no</div>
		<EyeballCounter onclick={() => (authOpen = true)} />
	</div>

	{#if authOpen}
		<AuthSheet onclose={() => (authOpen = false)} />
	{/if}

	{#if showChrome}
		<div class="searchbar">
			<Autocomplete placeholder="Søk adresse eller bedrift…" onselect={onSearchSelect} />
		</div>
		<div class="tabs-top">
			{#each ['Bekrefta', 'Estimat', 'Oppdrag'] as const as t}
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

	<BottomSheet bind:snap peekPx={116}>
		{#if mode === 'detail' && selected}
			<button class="close" onclick={close} aria-label="Lukk">✕</button>
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
				<p class="muted">Flytt kartet til kameraet står nøyaktig under krysshåret.</p>
				<button class="btn" disabled={busy} onclick={saveMove}>
					{busy ? 'Lagrar…' : 'Lagre endring'}
				</button>
				<button class="btn btn-ghost" onclick={() => (mode = 'detail')}>Tilbake</button>
			</div>
		{:else if mode === 'place-new'}
			<div class="action-card">
				<h2>Plasser nytt punkt</h2>
				<p class="muted">Flytt kartet slik at krysshåret står på kameraet.</p>
				<button class="btn" onclick={confirmPlacement}>Set punkt her</button>
				<button class="btn btn-ghost" onclick={close}>Avbryt</button>
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
						<p class="hint">Trykk på eit punkt, eller dra opp for liste</p>
					</div>
					<div class="legend">
						<span><i class="d blue"></i>{counts.bekrefta}</span>
						<span><i class="d violet"></i>{counts.estimat}</span>
					</div>
				</div>
				{#if tab === 'Oppdrag'}
					<button class="btn" onclick={() => (snap = 'half')}>
						⊙ Start oppdrag ({counts.oppdrag})
					</button>
				{:else}
					<button class="btn" onclick={startPlaceNew}>＋ Legg til kamera</button>
				{/if}
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
				<button class="btn add-inline" onclick={startPlaceNew}>＋ Legg til kamera</button>
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
		padding: calc(env(safe-area-inset-top) + 8px) 14px 8px;
		background: linear-gradient(rgba(11, 16, 32, 0.55), transparent);
		pointer-events: none;
	}
	.topbar :global(*) {
		pointer-events: auto;
	}
	.brand {
		color: #fff;
		font-weight: 700;
		font-size: 15px;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
	}
	.searchbar {
		position: absolute;
		top: calc(env(safe-area-inset-top) + 44px);
		left: 12px;
		right: 12px;
		z-index: 650;
	}
	.searchbar :global(input) {
		border-radius: 999px;
		box-shadow: var(--shadow);
		border-color: transparent;
		padding: 11px 16px;
	}
	.tabs-top {
		position: absolute;
		top: calc(env(safe-area-inset-top) + 92px);
		left: 0;
		right: 0;
		z-index: 640;
		display: flex;
		gap: 8px;
		justify-content: center;
		padding: 0 12px;
	}
	.fab {
		position: absolute;
		right: 16px;
		bottom: 160px;
		z-index: 590;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		border: none;
		background: #fff;
		box-shadow: var(--shadow);
		font-size: 20px;
		color: var(--ink);
	}

	.peek {
		display: grid;
		gap: 10px;
	}
	.peek-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}
	.peek strong {
		font-size: 15px;
	}
	.hint {
		margin: 1px 0 0;
		font-size: 11px;
		color: var(--muted);
	}
	.legend {
		display: flex;
		gap: 12px;
		font-size: 13px;
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.d {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		display: inline-block;
	}
	.d.blue {
		background: var(--blue);
	}
	.d.violet {
		background: var(--violet);
	}
	.sheet-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	h1 {
		font-size: 20px;
		margin: 0 0 8px;
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
	.close {
		position: absolute;
		top: 12px;
		right: 14px;
		z-index: 2;
		border: none;
		background: #f1f4f9;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		font-size: 14px;
	}
	.action-card {
		display: grid;
		gap: 8px;
	}
	.action-card h2 {
		margin: 0;
		font-size: 19px;
	}
	.toast {
		position: absolute;
		top: calc(env(safe-area-inset-top) + 140px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 700;
		background: var(--ink);
		color: #fff;
		padding: 10px 16px;
		border-radius: 999px;
		font-size: 14px;
		box-shadow: var(--shadow);
	}
</style>
