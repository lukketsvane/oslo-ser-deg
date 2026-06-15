import { error, json } from '@sveltejs/kit';
import { hashPassword, signSession, normalizeHandle, SESSION_COOKIE, sessionCookieOptions } from '$lib/server/auth';
import { findUser, createUser } from '$lib/server/notionUsers';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => ({}));
	const h = normalizeHandle(body?.handle ?? '');
	if (!h) throw error(400, 'Brukarnamn må vere 3–24 teikn (a–z, 0–9, _).');
	if (typeof body?.password !== 'string' || body.password.length < 6) {
		throw error(400, 'Passord må vere minst 6 teikn.');
	}
	if (await findUser(h)) throw error(409, 'Brukarnamnet er teke.');

	const user = await createUser(h, hashPassword(body.password));
	cookies.set(SESSION_COOKIE, signSession(h), sessionCookieOptions());
	return json({ handle: user.handle, eyeballs: user.eyeballs, streak: user.streak });
};
