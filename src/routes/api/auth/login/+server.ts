import { error, json } from '@sveltejs/kit';
import { verifyPassword, signSession, normalizeHandle, SESSION_COOKIE, sessionCookieOptions } from '$lib/server/auth';
import { findUser } from '$lib/server/notionUsers';
import type { RequestHandler } from './$types';

// very small in-memory rate limiter (per handle) — best effort, per instance
const attempts = new Map<string, { n: number; at: number }>();
const WINDOW = 60_000;
const MAX = 8;

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => ({}));
	const h = normalizeHandle(body?.handle ?? '');
	if (!h || typeof body?.password !== 'string') throw error(400, 'Manglar brukarnamn/passord.');

	const rec = attempts.get(h);
	const now = Date.now();
	if (rec && now - rec.at < WINDOW && rec.n >= MAX) {
		throw error(429, 'For mange forsøk — vent eit minutt.');
	}

	const user = await findUser(h);
	const ok = user ? verifyPassword(body.password, user.passordhash) : false;
	if (!ok || !user) {
		attempts.set(h, { n: (rec && now - rec.at < WINDOW ? rec.n : 0) + 1, at: now });
		throw error(401, 'Feil brukarnamn eller passord.');
	}

	attempts.delete(h);
	cookies.set(SESSION_COOKIE, signSession(h), sessionCookieOptions());
	return json({ handle: user.handle, eyeballs: user.eyeballs, streak: user.streak });
};
