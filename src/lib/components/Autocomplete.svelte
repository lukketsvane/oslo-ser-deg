<script lang="ts">
	import type { GeocodeHit } from '../../routes/api/geocode/+server';

	interface Props {
		value?: string;
		placeholder?: string;
		onselect?: (hit: GeocodeHit) => void;
		oninput?: (value: string) => void;
	}
	let { value = $bindable(''), placeholder = 'Søk adresse eller bedrift…', onselect, oninput }: Props =
		$props();

	let hits = $state<GeocodeHit[]>([]);
	let open = $state(false);
	let loading = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	async function query(q: string) {
		if (q.trim().length < 3) {
			hits = [];
			open = false;
			return;
		}
		loading = true;
		try {
			const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
			hits = res.ok ? await res.json() : [];
			open = hits.length > 0;
		} catch {
			hits = [];
		} finally {
			loading = false;
		}
	}

	function onInput(e: Event) {
		value = (e.target as HTMLInputElement).value;
		oninput?.(value);
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => query(value), 300);
	}

	function pick(hit: GeocodeHit) {
		value = hit.namn;
		open = false;
		hits = [];
		onselect?.(hit);
	}
</script>

<div class="ac">
	<input
		type="text"
		{placeholder}
		{value}
		oninput={onInput}
		onfocus={() => (open = hits.length > 0)}
		autocomplete="off"
	/>
	{#if loading}<span class="spin" aria-hidden="true"></span>{/if}
	{#if open}
		<ul class="drop">
			{#each hits as hit}
				<li>
					<button type="button" onclick={() => pick(hit)}>
						<strong>{hit.namn}</strong>
						<span>{hit.label}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.ac {
		position: relative;
	}
	.spin {
		position: absolute;
		right: 12px;
		top: 50%;
		width: 14px;
		height: 14px;
		margin-top: -7px;
		border: 2px solid var(--line);
		border-top-color: var(--blue);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.drop {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + 4px);
		z-index: 20;
		list-style: none;
		margin: 0;
		padding: 4px;
		background: #fff;
		border: 1px solid var(--line);
		border-radius: 12px;
		box-shadow: var(--shadow);
		max-height: 240px;
		overflow-y: auto;
	}
	.drop button {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		padding: 8px 10px;
		border-radius: 8px;
	}
	.drop button:hover {
		background: #f1f4f9;
	}
	.drop strong {
		display: block;
		font-size: 14px;
	}
	.drop span {
		display: block;
		font-size: 12px;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
