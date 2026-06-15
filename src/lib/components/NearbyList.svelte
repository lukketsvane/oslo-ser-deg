<script lang="ts">
	import type { Camera } from '$lib/types';
	import { EYEBALL_REWARD } from '$lib/types';
	import { distanceMeters, formatDistance, colorFor } from '$lib/map/markers';

	interface Props {
		cameras: Camera[];
		userLatLng?: { lat: number; lng: number } | null;
		missionsOnly?: boolean;
		onselect?: (camera: Camera) => void;
	}
	let { cameras, userLatLng = null, missionsOnly = false, onselect }: Props = $props();

	const ranked = $derived.by(() => {
		let list = cameras.filter((c) => c.lat != null && c.lng != null);
		if (missionsOnly) {
			list = list.filter((c) => c.kamerastatus === 'Estimert' || c.kamerastatus === 'Ukjent');
		}
		const withDist = list.map((c) => ({
			cam: c,
			dist: userLatLng ? distanceMeters([c.lat!, c.lng!], [userLatLng.lat, userLatLng.lng]) : null
		}));
		withDist.sort((a, b) => {
			if (a.dist == null || b.dist == null) return 0;
			return a.dist - b.dist;
		});
		return withDist.slice(0, 8);
	});
</script>

<ul class="list">
	{#each ranked as { cam, dist } (cam.id)}
		<li>
			<button class="row" onclick={() => onselect?.(cam)}>
				<span class="dot" style="background:{colorFor(cam.kamerastatus)}"></span>
				<span class="meta">
					<span class="name">{cam.namn}</span>
					<span class="sub">
						{cam.kategori ?? 'Ukjend'}
						{#if dist != null}· {formatDistance(dist)}{/if}
						{#if cam.kamerastatus === 'Estimert'}· Ubekrefta{/if}
					</span>
				</span>
				<span class="reward">+{EYEBALL_REWARD.confirm}</span>
			</button>
		</li>
	{:else}
		<li class="empty">Ingen punkt i nærleiken enno.</li>
	{/each}
</ul>

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 4px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		background: transparent;
		border: none;
		padding: 10px 4px;
		text-align: left;
		border-bottom: 1px solid var(--line);
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex: none;
	}
	.meta {
		flex: 1;
		min-width: 0;
	}
	.name {
		display: block;
		font-weight: 600;
		font-size: 14px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.sub {
		display: block;
		font-size: 12px;
		color: var(--muted);
	}
	.reward {
		font-size: 13px;
		font-weight: 700;
		color: var(--blue);
	}
	.empty {
		color: var(--muted);
		font-size: 14px;
		padding: 16px 4px;
	}
</style>
