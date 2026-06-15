import { json } from '@sveltejs/kit';
import { findUser } from '$lib/server/notionUsers';
import type { RequestHandler } from './$types';

// Returns the logged-in user (handle + server eyeballs/streak), or null.
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return json({ user: null });
	try {
		const u = await findUser(locals.user.handle);
		if (!u) return json({ user: null });
		return json({ user: { handle: u.handle, eyeballs: u.eyeballs, streak: u.streak } });
	} catch {
		// Notion hiccup — report the handle from the cookie so the UI still shows login state
		return json({ user: { handle: locals.user.handle, eyeballs: 0, streak: 0 } });
	}
};
