import { error, json } from '@sveltejs/kit';
import { addContribution, moveCamera } from '$lib/server/notion';
import { invalidateCache, patchCache } from '$lib/server/cache';
import { PROMOTE_THRESHOLD, type PatchCameraInput } from '$lib/types';
import type { RequestHandler } from './$types';

function isLat(n: unknown): n is number {
	return typeof n === 'number' && Number.isFinite(n) && n >= -90 && n <= 90;
}
function isLng(n: unknown): n is number {
	return typeof n === 'number' && Number.isFinite(n) && n >= -180 && n <= 180;
}

// PATCH /api/cameras/[id] — confirm | estimate | move.
export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = params.id;
	if (!id) throw error(400, 'Manglar id');

	let body: PatchCameraInput;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}

	const handle = typeof body.handle === 'string' ? body.handle.trim() : undefined;
	let camera;

	switch (body.action) {
		case 'move':
			if (!isLat(body.lat) || !isLng(body.lng)) throw error(400, 'Ugyldige koordinatar');
			camera = await moveCamera(id, body.lat, body.lng);
			break;
		case 'confirm':
			camera = await addContribution(id, {
				confirm: true,
				handle,
				promoteThreshold: PROMOTE_THRESHOLD
			});
			break;
		case 'estimate':
			camera = await addContribution(id, {
				confirm: false,
				handle,
				promoteThreshold: PROMOTE_THRESHOLD
			});
			break;
		default:
			throw error(400, 'Ukjend handling');
	}

	patchCache(camera);
	invalidateCache();
	return json(camera);
};
