<script lang="ts">
	import type { Camera } from '$lib/types';
	import { EYEBALL_REWARD } from '$lib/types';
	import { distanceMeters, formatDistance, colorFor } from '$lib/map/markers';
	import { kategoriLabel } from '$lib/labels';

	interface Props {
		cameras: Camera[];
		userLatLng?: { lat: number; lng: number } | null;
		missionsOnly?: boolean;
		/** When set (with a known location), only keep rows within this many metres. */
		radiusM?: number | null;
		/** Render as a locked preview (greyed, not actionable). */
		dimmed?: boolean;
		onselect?: (camera: Camera) => void;
	}
	let {
		cameras,
		userLatLng = null,
		missionsOnly = false,
		radiusM = null,
		dimmed = false,
		onselect
	}: Props = $props();

	const ranked = $derived.by(() => {
		let list = cameras.filter((c) => c.lat != null && c.lng != null);
		if (missionsOnly) {
			list = list.filter((c) => c.kamerastatus === 'Estimert' || c.kamerastatus === 'Ukjent');
		}
		let withDist = list.map((c) => ({
			cam: c,
			dist: userLatLng ? distanceMeters([c.lat!, c.lng!], [userLatLng.lat, userLatLng.lng]) : null
		}));
		if (radiusM != null && userLatLng) {
			withDist = withDist.filter((x) => x.dist != null && x.dist <= radiusM);
		}
		withDist.sort((a, b) => {
			if (a.dist == null || b.dist == null) return 0;
			return a.dist - b.dist;
		});
		return withDist.slice(0, 8);
	});
</script>

<ul class="list" class:dimmed>
	{#each ranked as { cam, dist }, i (cam.id)}
		<li>
			<button class="row" onclick={() => onselect?.(cam)}>
				<span class="badge" style="--c:{colorFor(cam.kamerastatus)}"><i>{i + 1}</i></span>
				<span class="meta">
					<span class="name">{cam.namn}</span>
					<span class="sub">
						{kategoriLabel(cam.kategori)}{#if dist != null} · {formatDistance(dist)}{/if}
					</span>
				</span>
				{#if cam.kamerastatus === 'Estimert'}
					<span class="tag tag-grey">Estimat</span>
				{:else if cam.kamerastatus === 'Ukjent'}
					<span class="tag tag-warn">Sjekk</span>
				{/if}
				<span class="reward">+{EYEBALL_REWARD.confirm}</span>
			</button>
		</li>
	{:else}
		<li class="empty">
			{#if missionsOnly && radiusM != null}
				Ingen oppdrag i gåavstand akkurat nå.
			{:else}
				Ingen punkter i nærheten ennå.
			{/if}
		</li>
	{/each}
</ul>

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 7px;
	}
	.list.dimmed {
		opacity: 0.5;
		filter: grayscale(0.6);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 9px;
		width: 100%;
		background: rgba(255, 255, 255, 0.62);
		border: 1px solid var(--line);
		border-radius: 17px;
		padding: 9px;
		text-align: left;
		box-shadow: inset 0 -1px 0 rgba(6, 63, 61, 0.04);
	}
	.badge {
		position: relative;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--c);
		color: #fffaf0;
		font-size: 11px;
		font-weight: 820;
		box-shadow: 0 4px 12px rgba(2, 40, 38, 0.18);
	}
	.badge::before {
		content: '';
		position: absolute;
		left: 6px;
		right: 6px;
		top: 10px;
		height: 7px;
		border-radius: 999px 999px 50% 50%;
		background: rgba(255, 250, 240, 0.9);
	}
	.badge i {
		position: relative;
		font-style: normal;
		z-index: 1;
		color: var(--ink);
	}
	.meta {
		flex: 1;
		min-width: 0;
	}
	.name {
		display: block;
		font-weight: 760;
		font-size: 14px;
		letter-spacing: -0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.sub {
		display: block;
		font-size: 12px;
		font-weight: 620;
		color: var(--muted);
	}
	.reward {
		font-size: 12px;
		font-weight: 820;
		color: var(--blue);
		background: rgba(0, 90, 85, 0.08);
		padding: 5px 7px;
		border-radius: 999px;
	}
	.empty {
		color: var(--muted);
		font-size: 14px;
		padding: 16px 4px;
	}
</style>
