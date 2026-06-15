// Shared types for cctv.oslo.no. Safe to import from both client and server
// (contains no secrets and no server-only imports).

/** Notion `Kamerastatus` select options. */
export type Kamerastatus = 'Bekreftet' | 'Estimert' | 'Ingen' | 'Ukjent';

/** Notion `Kategori` select options. */
export const KATEGORIAR = [
	'Skole',
	'Sykehus',
	'Offentlig/kommunalt bygg',
	'Buss',
	'Trikk',
	'T-bane',
	'Tog',
	'ALPR / skiltleser',
	'CCTV / kamera',
	'Fotoboks (ATK)',
	'Ukjent kameratype',
	'Flyplass',
	'Kjøpesenter / næring',
	'Parkering',
	'Vakt / sikring',
	'Bolig (borettslag/sameie)',
	'Statlig etat',
	'Båt / ferge'
] as const;
export type Kategori = (typeof KATEGORIAR)[number];

/** How sure a contributor is — maps to the Låg/Middels/Høg selector. */
export type Confidence = 'Låg' | 'Middels' | 'Høg';

/** A camera point as the app sees it (mapped from a Notion page). */
export interface Camera {
	id: string;
	namn: string;
	kategori: Kategori | null;
	eigar: string | null;
	kamerastatus: Kamerastatus | null;
	kameraTal: number | null;
	/** latitude (Notion: Breddegrad). null = not placed yet. */
	lat: number | null;
	/** longitude (Notion: Lengdegrad). null = not placed yet. */
	lng: number | null;
	/** confirmation count (Notion: Bekreftelser). */
	stadfestingar: number;
	/** agreement percent 0–100 (Notion: Enighet %). */
	semje: number | null;
	/** recent contributor handles (Notion: Bidragsytere). */
	bidragsytarar: string[];
	bydel: string | null;
	typeUndertype: string | null;
	kjeldeUrlar: string | null;
	kjeldenotat: string | null;
	sistOppdatert: string | null;
}

/** Body for POST /api/camera (add a new camera). */
export interface CreateCameraInput {
	namn: string;
	kategori?: Kategori;
	lat: number;
	lng: number;
	kamerastatus?: Kamerastatus;
	kjeldenotat?: string;
	handle?: string;
}

export type PatchAction = 'confirm' | 'estimate' | 'move';

/** Body for PATCH /api/cameras/[id]. */
export interface PatchCameraInput {
	action: PatchAction;
	handle?: string;
	confidence?: Confidence;
	note?: string;
	/** for action 'move' */
	lat?: number;
	lng?: number;
}

/** Eyeball rewards per action (kept in sync between client display and server logic). */
export const EYEBALL_REWARD: Record<PatchAction | 'add', number> = {
	add: 5,
	confirm: 3,
	estimate: 2,
	move: 1
};

/** How many distinct confirmations promote an Estimert camera to Bekreftet. */
export const PROMOTE_THRESHOLD = 3;

/** Walking-distance radius (metres) for "Oppdrag" near a located, logged-in user. */
export const WALK_RADIUS_M = 1000;

/** Max recent handles kept in the Bidragsytere field. */
export const MAX_BIDRAGSYTARAR = 10;
