import { error, json } from '@sveltejs/kit';
import { addContribution, moveCamera } from '$lib/server/notion';
import { invalidateCache, patchCache } from '$lib/server/cache';
import { awardEyeballs } from '$lib/server/notionUsers';
import { EYEBALL_REWARD, PROMOTE_THRESHOLD, type PatchCameraInput } from '$lib/types';
import type { RequestHandler } from './$types';

function isLat(n: unknown): n is number {
	return typeof n === 'number' && Number.isFinite(n) && n >= -90 && n <= 90;
}
function isLng(n: unknown): n is number {
	return typeof n === 'number' && Number.isFinite(n) && n >= -180 && n <= 180;
}

// PATCH /api/cameras/[id] — confirm | estimate | move.
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const id = params.id;
	if (!id) throw error(400, 'Manglar id');

	let body: PatchCameraInput;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}

	// Prefer the authenticated handle over the client-supplied one.
	const handle =
		locals.user?.handle ?? (typeof body.handle === 'string' ? body.handle.trim() : undefined);
	let camera;
	let reward = 0;

	switch (body.action) {
		case 'move':
			if (!isLat(body.lat) || !isLng(body.lng)) throw error(400, 'Ugyldige koordinatar');
			camera = await moveCamera(id, body.lat, body.lng);
			reward = EYEBALL_REWARD.move;
			break;
		case 'confirm':
			camera = await addContribution(id, { confirm: true, handle, promoteThreshold: PROMOTE_THRESHOLD });
			reward = EYEBALL_REWARD.confirm;
			break;
		case 'estimate':
			camera = await addContribution(id, { confirm: false, handle, promoteThreshold: PROMOTE_THRESHOLD });
			reward = EYEBALL_REWARD.estimate;
			break;
		default:
			throw error(400, 'Ukjend handling');
	}

	if (locals.user && reward > 0) {
		try {
			await awardEyeballs(locals.user.handle, reward);
		} catch {
			/* eyeball award is best-effort */
		}
	}

	patchCache(camera);
	invalidateCache();
	return json(camera);
};
