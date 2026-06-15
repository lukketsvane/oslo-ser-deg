import { error, json } from '@sveltejs/kit';
import { createCamera } from '$lib/server/notion';
import { invalidateCache, patchCache } from '$lib/server/cache';
import { awardEyeballs } from '$lib/server/notionUsers';
import { EYEBALL_REWARD, KATEGORIAR, type CreateCameraInput } from '$lib/types';
import type { RequestHandler } from './$types';

function isLat(n: unknown): n is number {
	return typeof n === 'number' && Number.isFinite(n) && n >= -90 && n <= 90;
}
function isLng(n: unknown): n is number {
	return typeof n === 'number' && Number.isFinite(n) && n >= -180 && n <= 180;
}

// POST /api/camera — add a new camera point.
export const POST: RequestHandler = async ({ request, locals }) => {
	let body: Partial<CreateCameraInput>;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}

	const namn = typeof body.namn === 'string' ? body.namn.trim() : '';
	if (!namn) throw error(400, 'Navn er påkrevd');
	if (!isLat(body.lat) || !isLng(body.lng)) throw error(400, 'Ugyldige koordinater');
	if (body.kategori && !KATEGORIAR.includes(body.kategori)) {
		throw error(400, 'Ukjent kategori');
	}

	// Prefer the authenticated handle over whatever the client sent.
	const handle =
		locals.user?.handle ?? (typeof body.handle === 'string' ? body.handle.trim() : undefined);

	const camera = await createCamera({
		namn,
		kategori: body.kategori,
		lat: body.lat,
		lng: body.lng,
		kamerastatus: body.kamerastatus,
		kjeldenotat: typeof body.kjeldenotat === 'string' ? body.kjeldenotat.trim() : undefined,
		handle
	});

	if (locals.user) {
		try {
			await awardEyeballs(locals.user.handle, EYEBALL_REWARD.add);
		} catch {
			/* eyeball award is best-effort */
		}
	}

	patchCache(camera);
	invalidateCache();
	return json(camera, { status: 201 });
};
