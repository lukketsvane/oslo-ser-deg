<script lang="ts">
	import { untrack } from 'svelte';
	import type { Kategori } from '$lib/types';
	import Autocomplete from './Autocomplete.svelte';
	import type { GeocodeHit } from '../../routes/api/geocode/+server';

	interface Props {
		onsubmit?: (data: { namn: string; kategori: Kategori; confirm: boolean }) => void;
		oncancel?: () => void;
		ongeocode?: (hit: GeocodeHit) => void;
		initialName?: string;
		busy?: boolean;
	}
	let { onsubmit, oncancel, ongeocode, initialName = '', busy = false }: Props = $props();

	let namn = $state(untrack(() => initialName));
	let kategori = $state<Kategori>('CCTV / kamera');
	let confirm = $state(false);

	// quick-pick chips mapped to real KATEGORIAR values
	const quickCats: { label: string; value: Kategori }[] = [
		{ label: 'Skule', value: 'Skule' },
		{ label: 'Butikk', value: 'Kjøpesenter / næring' },
		{ label: 'Kollektiv', value: 'Buss' },
		{ label: 'Anna', value: 'Ukjend kameratype' }
	];

	const valid = $derived(namn.trim().length > 0);
</script>

<div class="form">
	<h2>Legg til kamera</h2>

	<div class="seg">
		<button class="chip" class:active={confirm} onclick={() => (confirm = true)}>
			<span class="cdot blue"></span>Bekrefta
		</button>
		<button class="chip" class:active={!confirm} onclick={() => (confirm = false)}>
			<span class="cdot violet"></span>Estimat
		</button>
	</div>

	<div class="cats">
		{#each quickCats as c}
			<button class="chip" class:active={kategori === c.value} onclick={() => (kategori = c.value)}>
				{c.label}
			</button>
		{/each}
	</div>

	<div class="namn-field">
		<span class="pin">📍</span>
		<Autocomplete
			bind:value={namn}
			placeholder="Namn på stad"
			onselect={(hit) => {
				namn = hit.namn;
				ongeocode?.(hit);
			}}
		/>
	</div>
	<p class="hint">Juster sehøgda — flytt krysshåret på kartet.</p>

	<div class="btn-row actions">
		<button class="btn btn-sm btn-secondary" onclick={() => oncancel?.()}>Avbryt</button>
		<button
			class="btn btn-sm"
			disabled={!valid || busy}
			onclick={() => onsubmit?.({ namn: namn.trim(), kategori, confirm })}
		>
			{busy ? 'Lagrar…' : 'Lagre'}
		</button>
	</div>
</div>

<style>
	h2 {
		margin: 0 0 12px;
		font-size: 18px;
	}
	.seg {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-bottom: 8px;
	}
	.seg .chip {
		justify-content: center;
	}
	.cats {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 12px;
	}
	.namn-field {
		position: relative;
	}
	.pin {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		z-index: 1;
		font-size: 14px;
		pointer-events: none;
	}
	.namn-field :global(input) {
		padding-left: 34px;
	}
	.hint {
		margin: 6px 0 0;
		font-size: 11px;
		color: var(--muted);
	}
	.actions {
		margin-top: 14px;
	}
</style>
