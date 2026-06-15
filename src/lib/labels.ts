// Bokmål display labels for values that are stored in Notion using Nynorsk
// option names. We keep the raw Notion values in `types.ts` (they are a data
// contract with the database) and only translate them at display time here.
import type { Confidence, Kamerastatus } from '$lib/types';

const KATEGORI_LABEL: Record<string, string> = {
	Skule: 'Skole',
	Sjukehus: 'Sykehus',
	'Offentleg/kommunalt bygg': 'Offentlig/kommunal bygning',
	'ALPR / skiltlesar': 'ALPR / skiltleser',
	'Ukjend kameratype': 'Ukjent kameratype',
	'Bustad (borettslag/sameie)': 'Bolig (borettslag/sameie)',
	'Statleg etat': 'Statlig etat',
	'Båt / ferje': 'Båt / ferge'
};

export function kategoriLabel(k?: string | null): string {
	if (!k) return '—';
	return KATEGORI_LABEL[k] ?? k;
}

const STATUS_LABEL: Record<string, string> = {
	Stadfesta: 'Bekreftet',
	Estimert: 'Estimert',
	Ukjent: 'Ukjent',
	Ingen: 'Ingen'
};

export function statusLabel(s?: Kamerastatus | null): string {
	if (!s) return 'Ukjent';
	return STATUS_LABEL[s] ?? s;
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
	Låg: 'Lav',
	Middels: 'Middels',
	Høg: 'Høy'
};

export function confidenceLabel(c: Confidence): string {
	return CONFIDENCE_LABEL[c] ?? c;
}
