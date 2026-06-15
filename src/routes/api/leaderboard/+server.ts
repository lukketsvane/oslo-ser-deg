import { json } from '@sveltejs/kit';
import { listTopUsers } from '$lib/server/notionUsers';
import type { RequestHandler } from './$types';

// GET /api/leaderboard — top contributors by eyeballs. Public, best-effort.
export const GET: RequestHandler = async () => {
	try {
		const users = await listTopUsers(10);
		return json({
			leaders: users.map((u) => ({
				handle: u.handle,
				eyeballs: u.eyeballs,
				streak: u.streak
			}))
		});
	} catch {
		return json({ leaders: [] });
	}
};
