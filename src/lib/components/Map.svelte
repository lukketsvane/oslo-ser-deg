<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Map as LMap, LayerGroup, Marker, LatLng, DivIcon } from 'leaflet';
	import 'leaflet/dist/leaflet.css';
	import { colorFor } from '$lib/map/markers';
	import type { Camera } from '$lib/types';

	interface Props {
		cameras: Camera[];
		selectedId?: string | null;
		adjustMode?: boolean;
		onselect?: (camera: Camera) => void;
		onuserlocation?: (latlng: LatLng) => void;
	}

	let {
		cameras,
		selectedId = null,
		adjustMode = false,
		onselect,
		onuserlocation
	}: Props = $props();

	const OSLO: [number, number] = [59.9139, 10.7522];

	let mapEl: HTMLDivElement;
	// Leaflet is imported dynamically (client only) — it touches `window` at load.
	let L: typeof import('leaflet') | undefined;
	let map: LMap | undefined;
	let layer: LayerGroup | undefined;
	const markerById = new Map<string, Marker>();

	/** Exposed to parent via bind:this — current map centre (for "Juster plassering"). */
	export function center(): LatLng | null {
		return map ? map.getCenter() : null;
	}
	export function flyTo(lat: number, lng: number, zoom = 16) {
		map?.flyTo([lat, lng], zoom);
	}
	export function locate() {
		map?.locate({ setView: true, maxZoom: 15 });
	}

	function iconFor(camera: Camera): DivIcon {
		const color = colorFor(camera.kamerastatus);
		const ring =
			camera.kamerastatus === 'Stadfesta' ? 'box-shadow:0 0 0 4px rgba(29,111,255,.25);' : '';
		const html = `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;${ring}"></span>`;
		return L!.divIcon({ html, className: 'cctv-marker', iconSize: [20, 20], iconAnchor: [10, 10] });
	}

	onMount(() => {
		let destroyed = false;
		(async () => {
			const lib = (await import('leaflet')).default;
			if (destroyed) return;
			L = lib;
			map = L.map(mapEl, { zoomControl: false, attributionControl: true }).setView(OSLO, 12);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '© OpenStreetMap'
			}).addTo(map);
			L.control.zoom({ position: 'bottomright' }).addTo(map);
			layer = L.layerGroup().addTo(map);
			map.on('locationfound', (e) => onuserlocation?.(e.latlng));
			renderMarkers();
		})();
		return () => {
			destroyed = true;
		};
	});

	onDestroy(() => map?.remove());

	function renderMarkers() {
		if (!L || !map || !layer) return;
		layer.clearLayers();
		markerById.clear();
		for (const cam of cameras) {
			if (cam.lat == null || cam.lng == null) continue;
			const marker = L.marker([cam.lat, cam.lng], { icon: iconFor(cam) });
			marker.on('click', () => onselect?.(cam));
			marker.addTo(layer);
			markerById.set(cam.id, marker);
		}
	}

	// Re-render whenever the camera list changes.
	$effect(() => {
		cameras;
		renderMarkers();
	});

	$effect(() => {
		const m = selectedId ? markerById.get(selectedId) : undefined;
		m?.setZIndexOffset(1000);
	});
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
