<script lang="ts">
	import { onMount } from 'svelte';
	import type L from 'leaflet';
	import Map from '$lib/components/Map.svelte';
	import EyeballCounter from '$lib/components/EyeballCounter.svelte';
	import CameraDetail from '$lib/components/CameraDetail.svelte';
	import ContributionForm from '$lib/components/ContributionForm.svelte';
	import AddCameraForm from '$lib/components/AddCameraForm.svelte';
	import NearbyList from '$lib/components/NearbyList.svelte';
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
	let tab = $state<Tab>('Bekrefta');
	let selected = $state<Camera | null>(null);
	let userLatLng = $state<{ lat: number; lng: number } | null>(null);
	let busy = $state(false);
	let toast = $state<string | null>(null);

	let mapComp: Map;

	onMount(() => {
		const stop = startPolling(7000);
		return stop;
	});

	// Keep `selected` in sync with the freshest polled data.
	$effect(() => {
		if (selected) {
			const fresh = $cameras.find((c) => c.id === selected!.id);
			if (fresh) selected = fresh;
		}
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
		} catch {
			flash('Kunne ikkje lagre plassering');
		} finally {
			busy = false;
		}
	}

	function startPlaceNew() {
		selected = null;
		mode = 'place-new';
	}

	let pending: { lat: number; lng: number } | null = $state(null);
	function confirmPlacement() {
		const c = mapComp?.center();
		if (!c) return;
		pending = { lat: c.lat, lng: c.lng };
		mode = 'add-form';
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
	}

	function locateMe() {
		mapComp?.locate();
	}
</script>

<div class="app">
	<Map
		bind:this={mapComp}
		cameras={mode === 'browse' || mode === 'detail' || mode === 'contribute' ? visible : $cameras}
		selectedId={selected?.id}
		adjustMode={mode === 'adjust-move' || mode === 'place-new'}
		onselect={openCamera}
		onuserlocation={(ll) => (userLatLng = { lat: ll.lat, lng: ll.lng })}
	/>

	<!-- top bar -->
	<div class="topbar">
		<div class="brand">cctv.oslo.no</div>
		<EyeballCounter />
	</div>

	{#if mode === 'browse' || mode === 'detail' || mode === 'contribute'}
		<div class="tabs-top">
			{#each ['Bekrefta', 'Estimat', 'Oppdrag'] as const as t}
				<button class="chip" class:active={tab === t} onclick={() => (tab = t)}>{t}</button>
			{/each}
		</div>
	{/if}

	<button class="fab locate" onclick={locateMe} aria-label="Finn meg">◎</button>
	{#if mode === 'browse'}
		<button class="fab add" onclick={startPlaceNew} aria-label="Legg til kamera">＋</button>
	{/if}

	{#if toast}
		<div class="toast">{toast}</div>
	{/if}

	<!-- bottom sheet -->
	<div class="sheet">
		{#if mode === 'browse'}
			<div class="grab"></div>
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
		{:else if mode === 'detail' && selected}
			<div class="grab"></div>
			<button class="close" onclick={close} aria-label="Lukk">✕</button>
			<CameraDetail
				camera={selected}
				onconfirm={() => (mode = 'contribute')}
				onestimate={() => (mode = 'contribute')}
				onadjust={startAdjust}
			/>
		{:else if mode === 'contribute' && selected}
			<div class="grab"></div>
			<ContributionForm
				camera={selected}
				{busy}
				onsubmit={doConfirm}
				oncancel={() => (mode = 'detail')}
			/>
		{:else if mode === 'adjust-move'}
			<div class="grab"></div>
			<div class="adjust">
				<h2>Juster plassering</h2>
				<p class="muted">Flytt kartet til kameraet står nøyaktig.</p>
				<button class="btn" disabled={busy} onclick={saveMove}>
					{busy ? 'Lagrar…' : 'Lagre endring'}
				</button>
				<button class="btn btn-ghost" onclick={() => (mode = 'detail')}>Tilbake</button>
			</div>
		{:else if mode === 'place-new'}
			<div class="grab"></div>
			<div class="adjust">
				<h2>Plasser nytt punkt</h2>
				<p class="muted">Flytt kartet slik at krysshåret står på kameraet.</p>
				<button class="btn" onclick={confirmPlacement}>Set punkt her</button>
				<button class="btn btn-ghost" onclick={close}>Avbryt</button>
			</div>
		{:else if mode === 'add-form'}
			<div class="grab"></div>
			<AddCameraForm {busy} onsubmit={saveNew} oncancel={() => (mode = 'place-new')} />
		{/if}
	</div>
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
		z-index: 600;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: calc(env(safe-area-inset-top) + 10px) 14px 10px;
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
	.tabs-top {
		position: absolute;
		top: calc(env(safe-area-inset-top) + 54px);
		left: 0;
		right: 0;
		z-index: 600;
		display: flex;
		gap: 8px;
		justify-content: center;
		padding: 0 12px;
	}
	.fab {
		position: absolute;
		right: 16px;
		z-index: 600;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: none;
		background: #fff;
		box-shadow: var(--shadow);
		font-size: 22px;
		color: var(--ink);
	}
	.fab.locate {
		bottom: calc(46vh + 16px);
	}
	.fab.add {
		bottom: calc(46vh + 76px);
		background: var(--blue);
		color: #fff;
		font-size: 26px;
	}
	.sheet {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 600;
		max-height: 80vh;
		min-height: 42vh;
		overflow-y: auto;
		background: var(--panel);
		border-radius: 22px 22px 0 0;
		box-shadow: var(--shadow);
		padding: 10px 18px calc(env(safe-area-inset-bottom) + 18px);
	}
	.grab {
		width: 40px;
		height: 4px;
		border-radius: 999px;
		background: #d6dae2;
		margin: 2px auto 10px;
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
	.close {
		position: absolute;
		top: 12px;
		right: 14px;
		border: none;
		background: #f1f4f9;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		font-size: 14px;
	}
	.adjust {
		display: grid;
		gap: 8px;
	}
	.adjust h2 {
		margin: 0;
		font-size: 19px;
	}
	.toast {
		position: absolute;
		top: calc(env(safe-area-inset-top) + 100px);
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
