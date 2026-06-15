// Notion-backed user accounts. Server-only.
import { Client } from '@notionhq/client';
import { env } from '$env/dynamic/private';

export interface UserRow {
	id: string;
	handle: string;
	passordhash: string;
	eyeballs: number;
	streak: number;
	lastActive: string | null;
}

const P = {
	handle: 'Brukernavn',
	hash: 'Passordhash',
	eyeballs: 'Eyeballs',
	streak: 'Streak',
	lastActive: 'Sist aktiv'
} as const;

let client: Client | null = null;
function notion(): Client {
	if (!env.NOTION_TOKEN) throw new Error('NOTION_TOKEN is not set.');
	client ??= new Client({ auth: env.NOTION_TOKEN });
	return client;
}
function dsId(): string {
	const id = env.NOTION_USERS_DATA_SOURCE_ID;
	if (!id) throw new Error('NOTION_USERS_DATA_SOURCE_ID is not set.');
	return id;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function plain(prop: any): string {
	const arr = prop?.title ?? prop?.rich_text;
	if (!Array.isArray(arr)) return '';
	return arr.map((t: any) => t?.plain_text ?? '').join('');
}
function num(prop: any): number {
	return typeof prop?.number === 'number' ? prop.number : 0;
}
function pageToUser(page: any): UserRow {
	const p = page.properties ?? {};
	return {
		id: page.id,
		handle: plain(p[P.handle]),
		passordhash: plain(p[P.hash]),
		eyeballs: num(p[P.eyeballs]),
		streak: num(p[P.streak]),
		lastActive: p[P.lastActive]?.date?.start ?? null
	};
}

const today = () => new Date().toISOString().slice(0, 10);

export async function findUser(handle: string): Promise<UserRow | null> {
	const res = await notion().dataSources.query({
		data_source_id: dsId(),
		filter: { property: P.handle, title: { equals: handle } },
		page_size: 1
	});
	return res.results.length ? pageToUser(res.results[0]) : null;
}

/** Top users by eyeballs, for the leaderboard. */
export async function listTopUsers(limit = 10): Promise<UserRow[]> {
	const res = await notion().dataSources.query({
		data_source_id: dsId(),
		sorts: [{ property: P.eyeballs, direction: 'descending' }],
		page_size: Math.min(Math.max(limit, 1), 100)
	});
	return res.results.map(pageToUser).filter((u) => u.handle);
}

export async function createUser(handle: string, passwordHash: string): Promise<UserRow> {
	const page = await notion().pages.create({
		parent: { type: 'data_source_id', data_source_id: dsId() },
		properties: {
			[P.handle]: { title: [{ text: { content: handle } }] },
			[P.hash]: { rich_text: [{ text: { content: passwordHash } }] },
			[P.eyeballs]: { number: 0 },
			[P.streak]: { number: 0 },
			[P.lastActive]: { date: { start: today() } }
		}
	});
	return pageToUser(page);
}

/** Add eyeballs to a user and update the daily streak. Best-effort. */
export async function awardEyeballs(handle: string, amount: number): Promise<UserRow | null> {
	const user = await findUser(handle);
	if (!user) return null;

	const day = today();
	let streak = user.streak;
	if (user.lastActive !== day) {
		const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
		streak = user.lastActive === yesterday ? user.streak + 1 : 1;
	}

	const page = await notion().pages.update({
		page_id: user.id,
		properties: {
			[P.eyeballs]: { number: user.eyeballs + amount },
			[P.streak]: { number: streak },
			[P.lastActive]: { date: { start: day } }
		}
	});
	return pageToUser(page);
}
