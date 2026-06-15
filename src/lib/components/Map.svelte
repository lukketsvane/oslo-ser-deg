<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type {
		Map as LMap,
		Marker,
		LatLng,
		DivIcon,
		Circle,
		MarkerClusterGroup
	} from 'leaflet';
	import 'leaflet/dist/leaflet.css';
	import 'leaflet.markercluster/dist/MarkerCluster.css';
	import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
	import { colorFor } from '$lib/map/markers';
	import type { Camera } from '$lib/types';

	interface Props {
		cameras: Camera[];
		selectedId?: string | null;
		adjustMode?: boolean;
		onselect?: (camera: Camera) => void;
		onuserlocation?: (latlng: LatLng) => void;
		/** Tap on the map background (not a marker). */
		onbackground?: () => void;
	}

	let {
		cameras,
		selectedId = null,
		adjustMode = false,
		onselect,
		onuserlocation,
		onbackground
	}: Props = $props();

	const OSLO: [number, number] = [59.9139, 10.7522];

	let mapEl: HTMLDivElement;
	let L: typeof import('leaflet') | undefined;
	let map: LMap | undefined;
	let cluster: MarkerClusterGroup | undefined;
	const markerById = new Map<string, Marker>();
	const statusById = new Map<string, string>();

	// user location
	let userMarker: Marker | undefined;
	let accuracyCircle: Circle | undefined;
	let watchId: number | null = null;
	let lastFix: LatLng | null = null;

	export function center(): LatLng | null {
		return map ? map.getCenter() : null;
	}
	export function flyTo(lat: number, lng: number, zoom = 16) {
		map?.flyTo([lat, lng], zoom);
	}
	/** Start following the user (continuous) and recenter on their position. */
	export function locate() {
		if (lastFix) map?.flyTo(lastFix, 15);
		startWatch();
	}

	function iconFor(camera: Camera): DivIcon {
		const color = colorFor(camera.kamerastatus);
		const ring =
			camera.kamerastatus === 'Stadfesta' ? 'box-shadow:0 0 0 4px rgba(29,111,255,.25);' : '';
		const html = `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;${ring}"></span>`;
		return L!.divIcon({ html, className: 'cctv-marker', iconSize: [20, 20], iconAnchor: [10, 10] });
	}

	function clusterIcon(c: { getAllChildMarkers: () => Marker[]; getChildCount: () => number }): DivIcon {
		// colour the cluster by its dominant camera status
		const tally: Record<string, number> = {};
		for (const m of c.getAllChildMarkers()) {
			const s = (m as Marker & { _status?: string })._status ?? 'Ukjent';
			tally[s] = (tally[s] ?? 0) + 1;
		}
		const dominant = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Ukjent';
		const color = colorFor(dominant as Camera['kamerastatus']);
		const n = c.getChildCount();
		const size = n < 10 ? 34 : n < 100 ? 40 : 48;
		const html = `<div class="cl" style="--c:${color};width:${size}px;height:${size}px">${n}</div>`;
		return L!.divIcon({
			html,
			className: 'cctv-cluster',
			iconSize: [size, size]
		});
	}

	onMount(() => {
		let destroyed = false;
		(async () => {
			L = (await import('leaflet')).default;
			await import('leaflet.markercluster');
			if (destroyed) return;
			map = L.map(mapEl, { zoomControl: false, attributionControl: true }).setView(OSLO, 12);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '© OpenStreetMap'
			}).addTo(map);
			L.control.zoom({ position: 'bottomright' }).addTo(map);
			cluster = L.markerClusterGroup({
				showCoverageOnHover: false,
				maxClusterRadius: 60,
				chunkedLoading: true,
				iconCreateFunction: clusterIcon
			});
			map.addLayer(cluster);
			map.on('click', () => onbackground?.());
			syncMarkers();
		})();
		return () => {
			destroyed = true;
		};
	});

	onDestroy(() => {
		if (watchId != null && typeof navigator !== 'undefined') {
			navigator.geolocation.clearWatch(watchId);
		}
		map?.remove();
	});

	/** Incremental marker sync — add new, drop gone, update moved/changed. */
	function syncMarkers() {
		if (!L || !map || !cluster) return;
		const present = new Set<string>();
		const toAdd: Marker[] = [];

		for (const cam of cameras) {
			if (cam.lat == null || cam.lng == null) continue;
			present.add(cam.id);
			const existing = markerById.get(cam.id);
			const status = cam.kamerastatus ?? 'Ukjent';

			if (!existing) {
				const marker = L.marker([cam.lat, cam.lng], { icon: iconFor(cam) }) as Marker & {
					_status?: string;
				};
				marker._status = status;
				marker.on('click', () => onselect?.(cam));
				markerById.set(cam.id, marker);
				statusById.set(cam.id, status);
				toAdd.push(marker);
			} else {
				const ll = existing.getLatLng();
				if (ll.lat !== cam.lat || ll.lng !== cam.lng) existing.setLatLng([cam.lat, cam.lng]);
				if (statusById.get(cam.id) !== status) {
					existing.setIcon(iconFor(cam));
					(existing as Marker & { _status?: string })._status = status;
					statusById.set(cam.id, status);
				}
			}
		}

		const toRemove: Marker[] = [];
		for (const [id, marker] of markerById) {
			if (!present.has(id)) {
				toRemove.push(marker);
				markerById.delete(id);
				statusById.delete(id);
			}
		}
		if (toRemove.length) cluster.removeLayers(toRemove);
		if (toAdd.length) cluster.addLayers(toAdd);
	}

	$effect(() => {
		cameras;
		syncMarkers();
	});

	$effect(() => {
		const m = selectedId ? markerById.get(selectedId) : undefined;
		m?.setZIndexOffset(1000);
	});

	function startWatch() {
		if (watchId != null || typeof navigator === 'undefined' || !navigator.geolocation) return;
		watchId = navigator.geolocation.watchPosition(
			(pos) => {
				if (!L || !map) return;
				const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
				const acc = pos.coords.accuracy ?? 30;
				const first = lastFix == null;
				lastFix = ll;
				onuserlocation?.(ll);

				if (!userMarker) {
					userMarker = L.marker(ll, {
						icon: L.divIcon({ html: '<span></span>', className: 'user-dot', iconSize: [18, 18] }),
						interactive: false,
						zIndexOffset: 2000
					}).addTo(map);
					accuracyCircle = L.circle(ll, {
						radius: acc,
						color: '#1d6fff',
						weight: 1,
						fillColor: '#1d6fff',
						fillOpacity: 0.1
					}).addTo(map);
				} else {
					userMarker.setLatLng(ll);
					accuracyCircle?.setLatLng(ll);
					accuracyCircle?.setRadius(acc);
				}
				if (first) map.flyTo(ll, 15);
			},
			() => {
				/* permission denied / unavailable — silently ignore */
			},
			{ enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
		);
	}
</script>

<div class="map-wrap">
	<div class="map" bind:this={mapEl}></div>
	{#if adjustMode}
		<div class="crosshair" aria-hidden="true">
			<svg viewBox="0 0 48 48" width="48" height="48">
				<circle cx="24" cy="24" r="9" fill="#1d6fff" stroke="#fff" stroke-width="3" />
				<line x1="24" y1="0" x2="24" y2="14" stroke="#1d6fff" stroke-width="2" />
				<line x1="24" y1="34" x2="24" y2="48" stroke="#1d6fff" stroke-width="2" />
				<line x1="0" y1="24" x2="14" y2="24" stroke="#1d6fff" stroke-width="2" />
				<line x1="34" y1="24" x2="48" y2="24" stroke="#1d6fff" stroke-width="2" />
			</svg>
		</div>
	{/if}
</div>

<style>
	.map-wrap {
		position: absolute;
		inset: 0;
	}
	.map {
		position: absolute;
		inset: 0;
		z-index: 0;
	}
	.crosshair {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 500;
		pointer-events: none;
	}
</style>
