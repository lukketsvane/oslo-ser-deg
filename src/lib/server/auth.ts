// Password hashing + signed session cookie. Server-only.
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

export const SESSION_COOKIE = 'cctv_session';

/** Cookie options for the session — HttpOnly, Secure (prod), SameSite=Lax, 1 year. */
export function sessionCookieOptions() {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: !dev,
		maxAge: 60 * 60 * 24 * 365
	};
}

function secret(): string {
	return env.AUTH_SECRET || 'dev-insecure-secret-change-me';
}

/** scrypt hash, stored as "salt:hash" (hex). */
export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const hash = scryptSync(password, salt, 64).toString('hex');
	return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [salt, hash] = (stored ?? '').split(':');
	if (!salt || !hash) return false;
	const test = scryptSync(password, salt, 64);
	const orig = Buffer.from(hash, 'hex');
	return orig.length === test.length && timingSafeEqual(orig, test);
}

/** HMAC-signed token: base64url(payload).base64url(sig). */
export function signSession(handle: string): string {
	const payload = Buffer.from(JSON.stringify({ h: handle, t: Date.now() })).toString('base64url');
	const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
	return `${payload}.${sig}`;
}

export function readSession(token: string | undefined): { handle: string } | null {
	if (!token) return null;
	const [payload, sig] = token.split('.');
	if (!payload || !sig) return null;
	const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
	const a = Buffer.from(sig);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
	try {
		const obj = JSON.parse(Buffer.from(payload, 'base64url').toString());
		if (obj && typeof obj.h === 'string') return { handle: obj.h };
	} catch {
		/* malformed */
	}
	return null;
}

/** Username rules: 3–24 chars, lowercase letters/digits/_ . */
export function normalizeHandle(raw: string): string | null {
	const h = (raw ?? '').trim().toLowerCase();
	return /^[a-z0-9_]{3,24}$/.test(h) ? h : null;
}
