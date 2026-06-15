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
	import { distanceMeters } from '$lib/map/markers';
	import {
		EYEBALL_REWARD,
		WALK_RADIUS_M,
		type Camera,
		type Confidence,
		type Kategori
	} from '$lib/types';

	type Mode = 'browse' | 'detail' | 'contribute' | 'adjust-move' | 'place-new' | 'add-form' | 'info';
	type Tab = 'Bekreftet' | 'Estimat' | 'Oppdrag';

	const tabs: Tab[] = ['Bekreftet', 'Estimat', 'Oppdrag'];

	let mode = $state<Mode>('browse');
	let tab = $state<Tab>('Estimat');
	let selected = $state<Camera | null>(null);
	let userLatLng = $state<{ lat: number; lng: number } | null>(null);
	let busy = $state(false);
	let toast = $state<string | null>(null);
	let snap = $state<Snap>('peek');
	let prefillName = $state('');
	let authOpen = $state(false);
	let pending: { lat: number; lng: number } | null = $state(null);

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
			if (c.kamerastatus === 'Bekreftet') bekrefta++;
			else if (c.kamerastatus === 'Estimert') estimat++;
			if (c.kamerastatus === 'Estimert' || c.kamerastatus === 'Ukjent') oppdrag++;
		}
		return { bekrefta, estimat, oppdrag, totalt: $cameras.length };
	});

	// Oppdrag unlock: logged in AND sharing location. When unlocked we restrict
	// missions to walking distance; otherwise we preview all of them (greyed out).
	const oppdragUnlocked = $derived($identity.account && userLatLng != null);

	function isMission(c: Camera) {
		return c.kamerastatus === 'Estimert' || c.kamerastatus === 'Ukjent';
	}
	function withinWalk(c: Camera) {
		if (c.lat == null || c.lng == null || !userLatLng) return false;
		return distanceMeters([c.lat, c.lng], [userLatLng.lat, userLatLng.lng]) <= WALK_RADIUS_M;
	}

	const visible = $derived.by(() => {
		const list = $cameras;
		if (tab === 'Bekreftet') return list.filter((c) => c.kamerastatus === 'Bekreftet');
		if (tab === 'Estimat') return list.filter((c) => c.kamerastatus === 'Estimert');
		const missions = list.filter(isMission);
		// Unlocked: only oppdrag in walking distance (map + list stay in sync).
		return oppdragUnlocked ? missions.filter(withinWalk) : missions;
	});

	const recent = $derived.by(() => $cameras.slice(0, 4));

	function tabCount(t: Tab) {
		if (t === 'Bekreftet') return counts.bekrefta;
		if (t === 'Estimat') return counts.estimat;
		// When unlocked, show how many missions are actually within walking distance.
		return oppdragUnlocked ? $cameras.filter((c) => isMission(c) && withinWalk(c)).length : counts.oppdrag;
	}

	function flash(msg: string) {
		toast = msg;
		setTimeout(() => (toast = null), 2400);
	}

	function selectTab(t: Tab) {
		tab = t;
		// Oppdrag = unconfirmed cameras near you, so ask for location if we don't
		// have it yet (NearbyList then ranks the missions by distance).
		if (t === 'Oppdrag' && !userLatLng) locateMe();
		if (t === 'Oppdrag' && snap === 'peek') snap = 'half';
	}

	function openInfo() {
		selected = null;
		mode = mode === 'info' ? 'browse' : 'info';
		snap = mode === 'info' ? 'full' : 'peek';
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
			flash(`+${EYEBALL_REWARD[action]} eyeballs`);
			mode = 'detail';
		} catch {
			flash('Kunne ikke lagre');
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
			await patchCamera(selected.id, { action: 'move', lat: c.lat, lng: c.lng }, { lat: c.lat, lng: c.lng });
			identity.award(EYEBALL_REWARD.move);
			flash('Plassering lagret');
			mode = 'detail';
			snap = 'half';
		} catch {
			flash('Kunne ikke lagre');
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

	function confirmPlacement() {
		const c = mapComp?.center();
		if (!c) return;
		pending = { lat: c.lat, lng: c.lng };
		mode = 'add-form';
		snap = 'half';
	}

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
				kamerastatus: data.confirm ? 'Bekreftet' : 'Estimert',
				handle: $identity.handle
			});
			identity.award(EYEBALL_REWARD.add);
			flash(`+${EYEBALL_REWARD.add} eyeballs`);
			openCamera(created);
		} catch {
			flash('Kunne ikke lagre');
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
		onbackground={() => (mode === 'detail' || mode === 'contribute' || mode === 'info') && close()}
	/>

	<div class="topbar">
		<button class="brand-btn" class:active={mode === 'info'} onclick={openInfo} aria-label="Info, liste og statistikk">
			<span class="logo-mark" aria-hidden="true"></span>
			<span>OsloSerDeg</span>
			<span class="chev">›</span>
		</button>
		<EyeballCounter onclick={() => (authOpen = true)} />
	</div>

	{#if authOpen}
		<AuthSheet onclose={() => (authOpen = false)} />
	{/if}

	{#if browseChrome}
		<div class="searchbar">
			<Autocomplete placeholder="Søk adresse eller sted…" onselect={onSearchSelect} />
			<button class="search-action" onclick={locateMe} aria-label="Finn meg">◎</button>
		</div>
		<div class="tabs-top">
			{#each tabs as t}
				<button class="chip" class:active={tab === t} onclick={() => selectTab(t)}>
					<i class={t === 'Bekreftet' ? 'blue' : t === 'Estimat' ? 'violet' : 'grey'}></i>
					<span>{t}</span>
					<b>{tabCount(t)}</b>
				</button>
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
		peekPx={112}
		ondismiss={mode === 'detail' || mode === 'contribute' || mode === 'info' ? close : undefined}
	>
		{#if mode === 'info'}
			<div class="info-panel">
				<header class="sheet-titlebar">
					<div>
						<p class="eyebrow">info · liste · statistikk</p>
						<h1>OsloSerDeg</h1>
					</div>
					<button class="round-close" onclick={close} aria-label="Lukk">×</button>
				</header>

				<div class="stats-grid">
					<div class="big-stat"><span>{counts.totalt}</span><small>totalt</small></div>
					<div><span>{counts.bekrefta}</span><small>bekreftet</small></div>
					<div><span>{counts.estimat}</span><small>estimat</small></div>
					<div><span>{counts.oppdrag}</span><small>oppdrag</small></div>
				</div>

				<section class="list-card">
					<header><strong>Siste punkter</strong><button onclick={() => (snap = 'half')}>Se kart</button></header>
					{#each recent as cam}
						<button class="mini-row" onclick={() => openCamera(cam)}>
							<i class={cam.kamerastatus === 'Bekreftet' ? 'blue' : cam.kamerastatus === 'Estimert' ? 'violet' : 'grey'}></i>
							<span>{cam.namn}</span>
							<small>{cam.bydel ?? 'Oslo'}</small>
						</button>
					{/each}
				</section>

				<div class="btn-row">
					<button class="btn btn-sm btn-secondary" onclick={close}>Kart</button>
					<button class="btn btn-sm" onclick={startPlaceNew}>Legg til</button>
				</div>
			</div>
		{:else if mode === 'detail' && selected}
			<CameraDetail
				camera={selected}
				onclose={close}
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
			<div class="action-card compact-action">
				<header class="sheet-titlebar">
					<div><h2>Juster plassering</h2><p class="muted">Flytt kartet til rett punkt.</p></div>
					<button class="round-close" onclick={() => (mode = 'detail')} aria-label="Lukk">×</button>
				</header>
				<div class="btn-row">
					<button class="btn btn-sm btn-secondary" onclick={() => (mode = 'detail')}>Avbryt</button>
					<button class="btn btn-sm" disabled={busy} onclick={saveMove}>{busy ? 'Lagrer…' : 'Lagre'}</button>
				</div>
			</div>
		{:else if mode === 'place-new'}
			<div class="action-card compact-action">
				<header class="sheet-titlebar">
					<div><h2>Plasser punkt</h2><p class="muted">Flytt kartet til kameraet.</p></div>
					<button class="round-close" onclick={close} aria-label="Lukk">×</button>
				</header>
				<div class="btn-row">
					<button class="btn btn-sm btn-secondary" onclick={close}>Avbryt</button>
					<button class="btn btn-sm" onclick={confirmPlacement}>Sett her</button>
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
			<div class="peek-bento">
				<button class="peek-card total" onclick={() => (snap = 'half')}>
					<span>{counts.totalt}</span><small>kamera</small>
				</button>
				<button class="peek-card status" onclick={() => (snap = 'half')}>
					<span><i class="d blue"></i> {counts.bekrefta}</span>
					<span><i class="d violet"></i> {counts.estimat}</span>
					<span><i class="d grey"></i> {counts.oppdrag}</span>
				</button>
				<button class="peek-card add" onclick={startPlaceNew}>+<span>Legg til</span></button>
			</div>
		{:else}
			<div class="sheet-head">
				<h1>{tab === 'Oppdrag' ? 'Oppdrag' : 'Nær deg'}</h1>
				<span class="count">
					{#if tab === 'Oppdrag' && oppdragUnlocked}{visible.length} i gåavstand{:else}{visible.length} punkter{/if}
				</span>
			</div>
			{#if $loading}
				<p class="muted">Laster kart…</p>
			{:else if $loadError}
				<p class="muted">Feil: {$loadError}</p>
			{:else}
				{#if tab === 'Oppdrag' && !oppdragUnlocked}
					<div class="unlock-card">
						<p class="unlock-title">Lås opp oppdrag i gåavstand</p>
						<p class="unlock-sub">
							Logg inn og del lokasjon for å se oppdrag innen 1 km fra der du er.
						</p>
						<div class="btn-row">
							{#if !$identity.account}
								<button class="btn btn-sm" onclick={() => (authOpen = true)}>Logg inn</button>
							{/if}
							{#if !userLatLng}
								<button
									class="btn btn-sm"
									class:btn-secondary={!$identity.account}
									onclick={locateMe}>Del lokasjon</button
								>
							{/if}
						</div>
					</div>
				{/if}
				<NearbyList
					cameras={$cameras}
					{userLatLng}
					missionsOnly={tab === 'Oppdrag'}
					radiusM={tab === 'Oppdrag' && oppdragUnlocked ? WALK_RADIUS_M : null}
					dimmed={tab === 'Oppdrag' && !oppdragUnlocked}
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
		padding: calc(env(safe-area-inset-top) + 8px) 12px 6px;
		background: linear-gradient(rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.38), transparent);
		pointer-events: none;
	}
	.topbar :global(*) { pointer-events: auto; }
	.brand-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 38px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.86);
		backdrop-filter: blur(18px) saturate(1.15);
		color: var(--ink);
		padding: 7px 10px;
		font-weight: 850;
		font-size: 14px;
		letter-spacing: -0.03em;
		box-shadow: var(--shadow-soft);
	}
	.brand-btn.active { background: var(--ink); color: white; }
	.brand-btn .chev { opacity: 0.55; transform: rotate(90deg); }
	.logo-mark {
		position: relative;
		display: inline-block;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: linear-gradient(180deg, var(--ink) 0 46%, var(--paper) 46% 54%, var(--mint) 54% 100%);
		box-shadow: inset 0 0 0 1.5px var(--ink);
		flex: none;
		overflow: hidden;
	}
	.logo-mark::before {
		content: '';
		position: absolute;
		inset: 5px;
		border-radius: 50%;
		background: var(--paper);
		box-shadow: inset 0 0 0 2.5px var(--aqua);
	}
	.logo-mark::after {
		content: '';
		position: absolute;
		left: 50%; top: 50%;
		width: 7px; height: 7px;
		border-radius: 50%;
		background: var(--ink);
		transform: translate(-50%, -50%);
		box-shadow: 3px -3px 0 -1px white;
	}
	.searchbar {
		position: absolute;
		top: calc(env(safe-area-inset-top) + 58px);
		left: 12px;
		right: 12px;
		z-index: 650;
		display: grid;
		grid-template-columns: 1fr 46px;
		gap: 0;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.9);
		box-shadow: var(--shadow-soft);
		backdrop-filter: blur(18px) saturate(1.15);
		overflow: visible;
	}
	.searchbar :global(input) {
		border: 0;
		border-radius: 999px 0 0 999px;
		box-shadow: none;
		padding: 13px 16px;
		background: transparent;
	}
	.search-action {
		border: 0;
		border-left: 1px solid var(--line);
		background: transparent;
		font-size: 20px;
		color: var(--ink);
	}
	.tabs-top {
		position: absolute;
		top: calc(env(safe-area-inset-top) + 112px);
		left: 12px;
		right: 12px;
		z-index: 640;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 7px;
	}
	.tabs-top .chip {
		justify-content: center;
		padding-inline: 10px;
	}
	.tabs-top .chip i, .mini-row i {
		width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex: none;
	}
	.tabs-top .chip i.blue, .mini-row i.blue { background: var(--blue); }
	.tabs-top .chip i.violet, .mini-row i.violet { background: var(--violet); }
	.tabs-top .chip i.grey, .mini-row i.grey { background: #9aa3af; }
	.tabs-top .chip b {
		font-size: 11px;
		font-weight: 850;
		padding: 2px 6px;
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.06);
	}
	.tabs-top .chip.active b { background: rgba(255,255,255,.24); }
	.fab {
		position: absolute;
		right: 14px;
		bottom: calc(env(safe-area-inset-bottom) + 132px);
		z-index: 590;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: 1px solid var(--line);
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(16px);
		box-shadow: var(--shadow-soft);
		font-size: 20px;
		color: var(--ink);
	}
	.peek-bento {
		display: grid;
		grid-template-columns: 0.9fr 1fr 1.25fr;
		gap: 9px;
		align-items: stretch;
		padding-top: 1px;
	}
	.peek-card {
		border: 1px solid var(--line);
		border-radius: 18px;
		background: rgba(255,255,255,.78);
		box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
		min-height: 70px;
		padding: 10px 12px;
		text-align: left;
		color: var(--ink);
	}
	.peek-card.total span {
		display: block;
		font-size: 28px;
		font-weight: 880;
		line-height: 1;
		color: var(--violet);
	}
	.peek-card small {
		display: block;
		margin-top: 4px;
		font-size: 12px;
		font-weight: 650;
		color: var(--muted);
	}
	.peek-card.status {
		display: grid;
		gap: 3px;
		font-size: 12px;
		font-weight: 780;
	}
	.peek-card.status span { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
	.peek-card.add {
		background: var(--blue);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 9px;
		font-size: 25px;
		font-weight: 500;
		text-align: center;
	}
	.peek-card.add span { font-size: 16px; font-weight: 820; }
	.sheet-head, .sheet-titlebar {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}
	h1 { font-size: 20px; margin: 0 0 8px; letter-spacing: -0.035em; }
	h2 { margin: 0; font-size: 19px; letter-spacing: -0.03em; }
	.count, .muted { color: var(--muted); font-size: 13px; }
	.round-close {
		width: 36px;
		height: 36px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgba(15,23,42,.05);
		color: var(--ink);
		font-size: 22px;
		line-height: 1;
		flex: none;
	}
	.action-card { display: grid; gap: 12px; }
	.compact-action { padding-top: 2px; }
	.info-panel { display: grid; gap: 12px; }
	.eyebrow {
		margin: 0 0 2px;
		font-size: 10px;
		font-weight: 850;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.stats-grid {
		display: grid;
		grid-template-columns: 1.3fr 1fr 1fr 1fr;
		gap: 8px;
	}
	.stats-grid div {
		min-width: 0;
		border-radius: 18px;
		padding: 12px 10px;
		background: rgba(255, 255, 255, 0.72);
		border: 1px solid var(--line);
	}
	.stats-grid span { display: block; font-size: 22px; font-weight: 880; line-height: 1; letter-spacing: -0.045em; }
	.stats-grid small { display: block; margin-top: 5px; font-size: 11px; font-weight: 720; color: var(--muted); }
	.list-card {
		border: 1px solid var(--line);
		background: rgba(255,255,255,.72);
		border-radius: 18px;
		overflow: hidden;
	}
	.list-card header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 12px 6px;
	}
	.list-card header button {
		border: 0;
		background: transparent;
		color: var(--blue);
		font-weight: 800;
	}
	.mini-row {
		display: grid;
		grid-template-columns: 10px 1fr auto;
		gap: 9px;
		align-items: center;
		width: 100%;
		border: 0;
		border-top: 1px solid var(--line);
		background: transparent;
		padding: 11px 12px;
		text-align: left;
	}
	.mini-row span { font-weight: 760; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.mini-row small { color: var(--muted); font-size: 12px; }
	.add-inline { margin-top: 12px; }
	.unlock-card {
		border: 1px solid rgba(168, 85, 247, 0.18);
		background: rgba(168, 85, 247, 0.07);
		border-radius: 18px;
		padding: 14px;
		margin-bottom: 10px;
		display: grid;
		gap: 4px;
	}
	.unlock-title { margin: 0; font-size: 15px; font-weight: 850; letter-spacing: -0.02em; }
	.unlock-sub { margin: 0 0 8px; font-size: 13px; color: var(--muted); line-height: 1.35; }
	.d { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
	.d.blue { background: var(--blue); }
	.d.violet { background: var(--violet); }
	.d.grey { background: #9aa3af; }
	.toast {
		position: absolute;
		top: calc(env(safe-area-inset-top) + 122px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 700;
		background: var(--ink);
		color: white;
		padding: 9px 14px;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 760;
		box-shadow: var(--shadow);
	}
</style>
