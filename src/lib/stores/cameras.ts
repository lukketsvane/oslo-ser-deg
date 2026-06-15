// Camera store: polls /api/cameras and supports optimistic writes with rollback.
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { Camera, CreateCameraInput, PatchCameraInput } from '$lib/types';

export const cameras = writable<Camera[]>([]);
export const loading = writable<boolean>(true);
export const loadError = writable<string | null>(null);

let timer: ReturnType<typeof setInterval> | null = null;

async function fetchCameras(): Promise<void> {
	try {
		const res = await fetch('/api/cameras');
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data: Camera[] = await res.json();
		cameras.set(data);
		loadError.set(null);
	} catch (e) {
		loadError.set(e instanceof Error ? e.message : 'Kunne ikkje laste kamera');
	} finally {
		loading.set(false);
	}
}

/** Begin polling. Pauses while the tab is hidden to save Notion quota. */
export function startPolling(intervalMs = 7000): () => void {
	if (!browser) return () => {};
	fetchCameras();

	const tick = () => {
		if (!document.hidden) fetchCameras();
	};
	timer = setInterval(tick, intervalMs);

	const onVisible = () => {
		if (!document.hidden) fetchCameras();
	};
	document.addEventListener('visibilitychange', onVisible);

	return () => {
		if (timer) clearInterval(timer);
		timer = null;
		document.removeEventListener('visibilitychange', onVisible);
	};
}

function replaceCamera(updated: Camera) {
	cameras.update((list) => {
		const i = list.findIndex((c) => c.id === updated.id);
		if (i >= 0) {
			const next = [...list];
			next[i] = updated;
			return next;
		}
		return [...list, updated];
	});
}

/** Add a camera with an optimistic placeholder; reconcile or roll back. */
export async function addCamera(input: CreateCameraInput): Promise<Camera> {
	const tempId = `temp-${Date.now()}`;
	const optimistic: Camera = {
		id: tempId,
		namn: input.namn,
		kategori: input.kategori ?? null,
		eigar: null,
		kamerastatus: input.kamerastatus ?? 'Estimert',
		kameraTal: null,
		lat: input.lat,
		lng: input.lng,
		stadfestingar: 0,
		semje: 0,
		bidragsytarar: input.handle ? [input.handle] : [],
		bydel: null,
		typeUndertype: null,
		kjeldeUrlar: null,
		kjeldenotat: input.kjeldenotat ?? null,
		sistOppdatert: new Date().toISOString().slice(0, 10)
	};
	cameras.update((list) => [...list, optimistic]);

	try {
		const res = await fetch('/api/camera', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(input)
		});
		if (!res.ok) throw new Error(await res.text());
		const created: Camera = await res.json();
		cameras.update((list) => list.map((c) => (c.id === tempId ? created : c)));
		return created;
	} catch (e) {
		cameras.update((list) => list.filter((c) => c.id !== tempId));
		throw e;
	}
}

/** Patch a camera (confirm/estimate/move) optimistically; roll back on failure. */
export async function patchCamera(
	id: string,
	patch: PatchCameraInput,
	optimistic: Partial<Camera>
): Promise<Camera> {
	const prev = get(cameras).find((c) => c.id === id);
	if (prev) replaceCamera({ ...prev, ...optimistic });

	try {
		const res = await fetch(`/api/cameras/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(patch)
		});
		if (!res.ok) throw new Error(await res.text());
		const updated: Camera = await res.json();
		replaceCamera(updated);
		return updated;
	} catch (e) {
		if (prev) replaceCamera(prev);
		throw e;
	}
}
