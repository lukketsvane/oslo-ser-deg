// Pure (Leaflet-free) marker styling + geo helpers, safe to import during SSR.
// Anything that needs the Leaflet runtime (e.g. divIcon) lives in Map.svelte.
import type { Kamerastatus } from '$lib/types';

export const STATUS_COLOR: Record<string, string> = {
	Stadfesta: '#005a55', // deep civic teal
	Estimert: '#ff736d', // coral estimate
	Ukjent: '#9aa8a5', // muted stone
	Ingen: '#9aa8a5'
};

export function colorFor(status: Kamerastatus | null): string {
	return (status && STATUS_COLOR[status]) || STATUS_COLOR.Ukjent;
}

/** Haversine distance in metres between two [lat, lng] points. */
export function distanceMeters(a: [number, number], b: [number, number]): number {
	const R = 6371000;
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(b[0] - a[0]);
	const dLng = toRad(b[1] - a[1]);
	const lat1 = toRad(a[0]);
	const lat2 = toRad(b[0]);
	const h =
		Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
	return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
	if (m < 1000) return `${Math.round(m)} m`;
	return `${(m / 1000).toFixed(1)} km`;
}
