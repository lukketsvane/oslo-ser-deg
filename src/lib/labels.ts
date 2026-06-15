// Display helpers for camera values. Category and status are stored in Notion
// in Bokmål, so they render as-is — these helpers only add null fallbacks.
// Confidence is an internal-only selector (never written to Notion), so it keeps
// its Nynorsk option values and is translated for display here.
import type { Confidence, Kamerastatus } from '$lib/types';

export function kategoriLabel(k?: string | null): string {
	return k ?? '—';
}

export function statusLabel(s?: Kamerastatus | null): string {
	return s ?? 'Ukjent';
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
	Låg: 'Lav',
	Middels: 'Middels',
	Høg: 'Høy'
};

export function confidenceLabel(c: Confidence): string {
	return CONFIDENCE_LABEL[c] ?? c;
}
