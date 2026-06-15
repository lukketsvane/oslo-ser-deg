// Anonymous identity: a handle + eyeball balance + streak kept in localStorage.
// No auth. The server trusts the handle sent with writes — acceptable for a public
// civic map in v1 (gamification is motivational, not authoritative).
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface Identity {
	handle: string;
	eyeballs: number;
	streak: number;
	lastActiveDay: string | null;
}

const KEY = 'cctv-oslo-identity';

const ADJ = [
	'taste',
	'kr4',
	'lukket',
	'natt',
	'gate',
	'skygge',
	'lyn',
	'kald',
	'stille',
	'rapp',
	'glipp',
	'mørk'
];
const NOUN = ['finger', 'vler', 'svane', 'ugle', 'rev', 'måke', 'katt', 'ravn', 'mus', 'ulv'];

function randomHandle(): string {
	const a = ADJ[Math.floor(Math.random() * ADJ.length)];
	const n = NOUN[Math.floor(Math.random() * NOUN.length)];
	const num = Math.floor(Math.random() * 90 + 10);
	return `${a}${n}${Math.random() < 0.4 ? num : ''}`;
}

function todayStr(): string {
	return new Date().toISOString().slice(0, 10);
}

function load(): Identity {
	if (!browser) {
		return { handle: 'anon', eyeballs: 0, streak: 0, lastActiveDay: null };
	}
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) return JSON.parse(raw) as Identity;
	} catch {
		// ignore corrupt storage
	}
	const fresh: Identity = { handle: randomHandle(), eyeballs: 0, streak: 0, lastActiveDay: null };
	localStorage.setItem(KEY, JSON.stringify(fresh));
	return fresh;
}

function persist(id: Identity) {
	if (browser) localStorage.setItem(KEY, JSON.stringify(id));
}

function createIdentity() {
	const { subscribe, update, set } = writable<Identity>(load());

	return {
		subscribe,
		/** Award eyeballs and bump the daily streak. */
		award(amount: number) {
			update((id) => {
				const day = todayStr();
				let streak = id.streak;
				if (id.lastActiveDay !== day) {
					const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
					streak = id.lastActiveDay === yesterday ? id.streak + 1 : 1;
				}
				const next = { ...id, eyeballs: id.eyeballs + amount, streak, lastActiveDay: day };
				persist(next);
				return next;
			});
		},
		setHandle(handle: string) {
			update((id) => {
				const next = { ...id, handle: handle.replace(/\s+/g, '').slice(0, 24) || id.handle };
				persist(next);
				return next;
			});
		},
		reset() {
			const fresh: Identity = {
				handle: randomHandle(),
				eyeballs: 0,
				streak: 0,
				lastActiveDay: null
			};
			persist(fresh);
			set(fresh);
		}
	};
}

export const identity = createIdentity();
