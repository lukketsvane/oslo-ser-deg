// Identity: a logged-in account (server, Notion-backed) when available, else an
// anonymous handle kept in localStorage. Accounts are optional.
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface Identity {
	handle: string;
	eyeballs: number;
	streak: number;
	lastActiveDay: string | null;
	account: boolean;
}

const KEY = 'cctv-oslo-identity';
const ACCOUNT_KEY = 'cctv-oslo-account';

const ADJ = ['taste', 'kr4', 'natt', 'gate', 'skygge', 'lyn', 'kald', 'stille', 'rapp', 'tåke'];
const NOUN = ['finger', 'vler', 'ugle', 'rev', 'måke', 'katt', 'ravn', 'mus', 'ulv', 'hauk'];

function randomHandle(): string {
	const a = ADJ[Math.floor(Math.random() * ADJ.length)];
	const n = NOUN[Math.floor(Math.random() * NOUN.length)];
	return `${a}${n}${Math.random() < 0.4 ? Math.floor(Math.random() * 90 + 10) : ''}`;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function loadAnon(): Identity {
	if (!browser) return { handle: 'anon', eyeballs: 0, streak: 0, lastActiveDay: null, account: false };
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) return { ...(JSON.parse(raw) as Identity), account: false };
	} catch {
		/* ignore */
	}
	const fresh: Identity = {
		handle: randomHandle(),
		eyeballs: 0,
		streak: 0,
		lastActiveDay: null,
		account: false
	};
	localStorage.setItem(KEY, JSON.stringify(fresh));
	return fresh;
}

/** Last known logged-in account, cached so the UI restores instantly on reload
 *  (and survives a slow/offline /api/auth/me) until the server says otherwise. */
function loadCachedAccount(): Identity | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(ACCOUNT_KEY);
		if (raw) return { ...(JSON.parse(raw) as Identity), account: true };
	} catch {
		/* ignore */
	}
	return null;
}

/** Initial identity: prefer a cached account, else the anon handle. */
function loadInitial(): Identity {
	return loadCachedAccount() ?? loadAnon();
}

function persistAnon(id: Identity) {
	if (!browser) return;
	if (id.account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(id));
	else localStorage.setItem(KEY, JSON.stringify(id));
}

function cacheAccount(id: Identity) {
	if (browser && id.account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(id));
}

function clearAccount() {
	if (browser) localStorage.removeItem(ACCOUNT_KEY);
}

function createIdentity() {
	const initial = loadInitial();
	const { subscribe, update, set } = writable<Identity>(initial);
	let current = initial;
	subscribe((v) => (current = v));

	/** Set + persist a confirmed logged-in account. */
	function setAccount(id: Identity) {
		set(id);
		cacheAccount(id);
	}

	async function refresh() {
		if (!browser) return;
		try {
			const res = await fetch('/api/auth/me');
			const data = await res.json();
			if (data.user) {
				setAccount({
					handle: data.user.handle,
					eyeballs: data.user.eyeballs ?? 0,
					streak: data.user.streak ?? 0,
					lastActiveDay: todayStr(),
					account: true
				});
			} else if (current.account) {
				// Server explicitly says we're not logged in — drop the cached account.
				clearAccount();
				set(loadAnon());
			}
		} catch {
			/* offline — keep current (cached account stays logged in) */
		}
	}

	if (browser) refresh();

	async function post(path: string, body: unknown) {
		const res = await fetch(path, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return { ok: false as const, error: data?.message ?? 'Noko gjekk gale' };
		return { ok: true as const, data };
	}

	return {
		subscribe,
		refresh,
		/** Reward eyeballs + bump daily streak (instant local feedback). */
		award(amount: number) {
			update((id) => {
				const day = todayStr();
				let streak = id.streak;
				if (id.lastActiveDay !== day) {
					const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
					streak = id.lastActiveDay === yesterday ? id.streak + 1 : 1;
				}
				const next = { ...id, eyeballs: id.eyeballs + amount, streak, lastActiveDay: day };
				persistAnon(next);
				return next;
			});
			// account totals are authoritative on the server
			if (current.account) refresh();
		},
		async register(handle: string, password: string) {
			const r = await post('/api/auth/register', { handle, password });
			if (r.ok) {
				setAccount({
					handle: r.data.handle,
					eyeballs: r.data.eyeballs ?? 0,
					streak: r.data.streak ?? 0,
					lastActiveDay: todayStr(),
					account: true
				});
			}
			return r;
		},
		async login(handle: string, password: string) {
			const r = await post('/api/auth/login', { handle, password });
			if (r.ok) {
				setAccount({
					handle: r.data.handle,
					eyeballs: r.data.eyeballs ?? 0,
					streak: r.data.streak ?? 0,
					lastActiveDay: todayStr(),
					account: true
				});
			}
			return r;
		},
		async logout() {
			await post('/api/auth/logout', {});
			clearAccount();
			set(loadAnon());
		}
	};
}

export const identity = createIdentity();
