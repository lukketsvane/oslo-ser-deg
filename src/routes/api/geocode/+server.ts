import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Address/business autocomplete via Photon (OpenStreetMap, free, no key).
// Proxied so we can bias to Oslo, cache briefly, and send a polite User-Agent.

export interface GeocodeHit {
	namn: string;
	label: string;
	lat: number;
	lng: number;
}

const OSLO = { lat: 59.9139, lng: 10.7522 };
const cache = new Map<string, { at: number; hits: GeocodeHit[] }>();
const TTL = 60_000;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toHit(f: any): GeocodeHit | null {
	const [lng, lat] = f?.geometry?.coordinates ?? [];
	if (typeof lat !== 'number' || typeof lng !== 'number') return null;
	const p = f.properties ?? {};
	const namn: string = p.name || p.street || p.city || 'Ukjend stad';
	const parts = [p.name, p.street && [p.street, p.housenumber].filter(Boolean).join(' '), p.city, p.postcode]
		.filter(Boolean)
		.filter((v, i, a) => a.indexOf(v) === i);
	return { namn, label: parts.join(', ') || namn, lat, lng };
}

export const GET: RequestHandler = async ({ url, fetch }) => {
	const q = (url.searchParams.get('q') ?? '').trim();
	if (q.length < 3) return json([] as GeocodeHit[]);

	const key = q.toLowerCase();
	const cached = cache.get(key);
	if (cached && Date.now() - cached.at < TTL) {
		return json(cached.hits, { headers: { 'cache-control': 'no-store' } });
	}

	const api = new URL('https://photon.komoot.io/api');
	api.searchParams.set('q', q);
	api.searchParams.set('lat', String(OSLO.lat));
	api.searchParams.set('lon', String(OSLO.lng));
	api.searchParams.set('limit', '6');
	api.searchParams.set('lang', 'default');

	try {
		const res = await fetch(api, { headers: { 'User-Agent': 'cctv.oslo.no (overvaking.iverfinne.no)' } });
		if (!res.ok) return json([] as GeocodeHit[]);
		const data: any = await res.json();
		const hits = (data.features ?? []).map(toHit).filter(Boolean).slice(0, 6) as GeocodeHit[];
		cache.set(key, { at: Date.now(), hits });
		return json(hits, { headers: { 'cache-control': 'no-store' } });
	} catch {
		return json([] as GeocodeHit[]);
	}
};
