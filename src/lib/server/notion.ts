// Notion data-access layer. Server-only: lives under $lib/server so SvelteKit
// guarantees it never ships to the client bundle (where NOTION_TOKEN must never go).
import { Client } from '@notionhq/client';
import { env } from '$env/dynamic/private';
import {
	MAX_BIDRAGSYTARAR,
	type Camera,
	type CreateCameraInput,
	type Kategori,
	type Kamerastatus
} from '$lib/types';

// Notion property names (exact, including spaces and Norwegian characters).
const P = {
	namn: 'Namn',
	kategori: 'Kategori',
	eigar: 'Eigar / operatør',
	kamerastatus: 'Kamerastatus',
	kameraTal: 'Kamera (tal)',
	lat: 'Breiddegrad',
	lng: 'Lengdegrad',
	stadfestingar: 'Stadfestingar',
	semje: 'Semje %',
	bidragsytarar: 'Bidragsytarar',
	bydel: 'Bydel / område',
	typeUndertype: 'Type / undertype',
	kjeldeUrlar: 'Kjelde-URL-ar',
	kjeldenotat: 'Kjeldenotat',
	sistOppdatert: 'Sist oppdatert'
} as const;

let client: Client | null = null;
function notion(): Client {
	if (!env.NOTION_TOKEN) {
		throw new Error('NOTION_TOKEN is not set. Copy .env.example to .env and fill it in.');
	}
	client ??= new Client({ auth: env.NOTION_TOKEN });
	return client;
}

function dataSourceId(): string {
	// Accept either name — NOTION_DATA_SOURCE_ID is canonical, NOTION_DB_ID is a
	// tolerated alias (used in some deploy setups).
	const id = env.NOTION_DATA_SOURCE_ID || env.NOTION_DB_ID;
	if (!id) throw new Error('NOTION_DATA_SOURCE_ID (or NOTION_DB_ID) is not set.');
	return id;
}

/* ---------------- read helpers ---------------- */

// The SDK's property union is large; we read defensively with `any`.
/* eslint-disable @typescript-eslint/no-explicit-any */
function plainText(prop: any): string | null {
	const arr = prop?.title ?? prop?.rich_text;
	if (!Array.isArray(arr)) return null;
	const text = arr.map((t: any) => t?.plain_text ?? '').join('').trim();
	return text || null;
}
function selectName(prop: any): string | null {
	return prop?.select?.name ?? null;
}
function numberVal(prop: any): number | null {
	return typeof prop?.number === 'number' ? prop.number : null;
}
function dateStart(prop: any): string | null {
	return prop?.date?.start ?? null;
}

function pageToCamera(page: any): Camera {
	const props = page.properties ?? {};
	const handlesRaw = plainText(props[P.bidragsytarar]) ?? '';
	return {
		id: page.id,
		namn: plainText(props[P.namn]) ?? '(utan namn)',
		kategori: selectName(props[P.kategori]) as Kategori | null,
		eigar: selectName(props[P.eigar]),
		kamerastatus: selectName(props[P.kamerastatus]) as Kamerastatus | null,
		kameraTal: numberVal(props[P.kameraTal]),
		lat: numberVal(props[P.lat]),
		lng: numberVal(props[P.lng]),
		stadfestingar: numberVal(props[P.stadfestingar]) ?? 0,
		semje: numberVal(props[P.semje]),
		bidragsytarar: handlesRaw ? handlesRaw.split(/\s+/).filter(Boolean) : [],
		bydel: plainText(props[P.bydel]),
		typeUndertype: plainText(props[P.typeUndertype]),
		kjeldeUrlar: plainText(props[P.kjeldeUrlar]),
		kjeldenotat: plainText(props[P.kjeldenotat]),
		sistOppdatert: dateStart(props[P.sistOppdatert])
	};
}

/** Query every camera page, following pagination. */
export async function queryAllCameras(): Promise<Camera[]> {
	const cameras: Camera[] = [];
	let cursor: string | undefined;
	do {
		const res = await notion().dataSources.query({
			data_source_id: dataSourceId(),
			start_cursor: cursor,
			page_size: 100
		});
		for (const page of res.results) cameras.push(pageToCamera(page));
		cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
	} while (cursor);
	return cameras;
}

export async function getCamera(pageId: string): Promise<Camera> {
	const page = await notion().pages.retrieve({ page_id: pageId });
	return pageToCamera(page);
}

/* ---------------- write helpers ---------------- */

function titleProp(value: string) {
	return { title: [{ text: { content: value } }] };
}
function richTextProp(value: string) {
	return { rich_text: value ? [{ text: { content: value } }] : [] };
}
function selectProp(value: string | undefined | null) {
	return value ? { select: { name: value } } : { select: null };
}
function numberProp(value: number | undefined | null) {
	return { number: typeof value === 'number' ? value : null };
}

const today = () => new Date().toISOString().slice(0, 10);

export async function createCamera(input: CreateCameraInput): Promise<Camera> {
	const status: Kamerastatus = input.kamerastatus ?? 'Estimert';
	const handles = input.handle ? [input.handle] : [];
	const page = await notion().pages.create({
		parent: { type: 'data_source_id', data_source_id: dataSourceId() },
		properties: {
			[P.namn]: titleProp(input.namn),
			[P.kategori]: selectProp(input.kategori),
			[P.kamerastatus]: selectProp(status),
			[P.lat]: numberProp(input.lat),
			[P.lng]: numberProp(input.lng),
			[P.stadfestingar]: numberProp(status === 'Stadfesta' ? 1 : 0),
			[P.semje]: numberProp(status === 'Stadfesta' ? 100 : 0),
			[P.bidragsytarar]: richTextProp(handles.join(' ')),
			[P.kjeldenotat]: richTextProp(input.kjeldenotat ?? ''),
			[P.sistOppdatert]: { date: { start: today() } }
		}
	});
	return pageToCamera(page);
}

/** Move a camera's coordinates. */
export async function moveCamera(pageId: string, lat: number, lng: number): Promise<Camera> {
	const page = await notion().pages.update({
		page_id: pageId,
		properties: {
			[P.lat]: numberProp(lat),
			[P.lng]: numberProp(lng),
			[P.sistOppdatert]: { date: { start: today() } }
		}
	});
	return pageToCamera(page);
}

/** Add one confirmation/estimate, append handle, recompute aggregates. */
export async function addContribution(
	pageId: string,
	opts: { confirm: boolean; handle?: string; promoteThreshold: number; maxHandles?: number }
): Promise<Camera> {
	const current = await getCamera(pageId);
	const stadfestingar = current.stadfestingar + (opts.confirm ? 1 : 0);

	// Append handle, keep most recent N, no duplicates adjacent.
	const handles = [...current.bidragsytarar];
	if (opts.handle) {
		const clean = opts.handle.replace(/\s+/g, '');
		if (clean) handles.push(clean);
	}
	const trimmed = handles.slice(-(opts.maxHandles ?? MAX_BIDRAGSYTARAR));

	// Simple agreement model: confirmations push agreement up toward 100.
	const totalSignals = trimmed.length || 1;
	const semje = opts.confirm
		? Math.round((stadfestingar / Math.max(totalSignals, stadfestingar)) * 100)
		: (current.semje ?? 0);

	const properties: Record<string, any> = {
		[P.stadfestingar]: numberProp(stadfestingar),
		[P.semje]: numberProp(Math.min(100, Math.max(0, semje))),
		[P.bidragsytarar]: richTextProp(trimmed.join(' ')),
		[P.sistOppdatert]: { date: { start: today() } }
	};

	// Promote Estimert → Stadfesta once enough confirmations gathered.
	if (
		opts.confirm &&
		current.kamerastatus !== 'Stadfesta' &&
		stadfestingar >= opts.promoteThreshold
	) {
		properties[P.kamerastatus] = selectProp('Stadfesta');
	}

	const page = await notion().pages.update({ page_id: pageId, properties });
	return pageToCamera(page);
}
