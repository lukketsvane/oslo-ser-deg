import { json } from '@sveltejs/kit';
import { getCamerasCached } from '$lib/server/cache';
import type { RequestHandler } from './$types';

// GET /api/cameras — cached snapshot of all cameras. The polling target.
export const GET: RequestHandler = async () => {
	const cameras = await getCamerasCached();
	return json(cameras, {
		headers: { 'cache-control': 'no-store' }
	});
};
