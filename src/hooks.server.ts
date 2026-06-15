import type { Handle } from '@sveltejs/kit';
import { readSession, SESSION_COOKIE } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const session = readSession(event.cookies.get(SESSION_COOKIE));
	event.locals.user = session ? { handle: session.handle } : null;
	return resolve(event);
};
