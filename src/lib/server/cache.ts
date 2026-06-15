// In-memory snapshot cache for the camera list. Keeps Notion read load to roughly
// one query per TTL window regardless of how many clients poll. Best-effort only:
// Vercel may run several serverless instances, each with its own cache — fine for
// low traffic. Move to Vercel KV later if a shared snapshot is needed.
import { env } from '$env/dynamic/private';
import { queryAllCameras } from './notion';
import type { Camera } from '$lib/types';

const DEFAULT_TTL = 7000;
function ttl(): number {
	const v = Number(env.CACHE_TTL_MS);
	return Number.isFinite(v) && v > 0 ? v : DEFAULT_TTL;
}

let data: Camera[] | null = null;
let fetchedAt = 0;
let inFlight: Promise<Camera[]> | null = null;

/** Return cached cameras, refetching from Notion when stale. */
export async function getCamerasCached(): Promise<Camera[]> {
	const fresh = data !== null && Date.now() - fetchedAt < ttl();
	if (fresh) return data as Camera[];

	// Coalesce concurrent refreshes into a single Notion query.
	inFlight ??= queryAllCameras()
		.then((cameras) => {
			data = cameras;
			fetchedAt = Date.now();
			return cameras;
		})
		.finally(() => {
			inFlight = null;
		});

	// If we have stale data and a refresh is already running, the caller can wait
	// for the in-flight result (still cheap — same promise).
	return inFlight;
}

/** Force the next read to hit Notion. Call after any write. */
export function invalidateCache(): void {
	fetchedAt = 0;
	data = null;
}

/** Optimistically replace/insert a camera in the cached snapshot. */
export function patchCache(camera: Camera): void {
	if (data === null) return;
	const i = data.findIndex((c) => c.id === camera.id);
	if (i >= 0) data[i] = camera;
	else data.push(camera);
}
