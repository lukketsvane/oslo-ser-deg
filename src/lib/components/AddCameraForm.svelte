<script lang="ts">
	import { KATEGORIAR, type Kategori } from '$lib/types';

	interface Props {
		onsubmit?: (data: { namn: string; kategori: Kategori; confirm: boolean }) => void;
		oncancel?: () => void;
		busy?: boolean;
	}
	let { onsubmit, oncancel, busy = false }: Props = $props();

	let namn = $state('');
	let kategori = $state<Kategori>('CCTV / kamera');
	let confirm = $state(false);

	const valid = $derived(namn.trim().length > 0);
</script>

<div class="form">
	<h2>Nytt kamerapunkt</h2>
	<p class="sub">Punktet vert lagt der krysshåret står på kartet.</p>

	<label for="namn">Namn / stad</label>
	<input id="namn" bind:value={namn} placeholder="t.d. Tøyen skule" maxlength="120" />

	<label for="kat">Kategori</label>
	<select id="kat" bind:value={kategori}>
		{#each KATEGORIAR as k}<option value={k}>{k}</option>{/each}
	</select>

	<label class="check">
		<input type="checkbox" bind:checked={confirm} class="cb" />
		Eg har sett kameraet sjølv (stadfesta) — elles vert det lagt som estimat
	</label>

	<div class="actions">
		<button
			class="btn"
			disabled={!valid || busy}
			onclick={() => onsubmit?.({ namn: namn.trim(), kategori, confirm })}
		>
			{busy ? 'Lagrar…' : 'Legg til punkt'}
		</button>
		<button class="btn btn-ghost" onclick={() => oncancel?.()}>Avbryt</button>
	</div>
</div>

<style>
	h2 {
		margin: 0 0 4px;
		font-size: 19px;
	}
	.sub {
		color: var(--muted);
		font-size: 14px;
		margin: 0 0 14px;
	}
	label {
		margin-top: 12px;
	}
	.check {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		font-size: 13px;
		color: var(--ink);
		font-weight: 500;
		margin-top: 16px;
	}
	.cb {
		width: auto;
		margin-top: 2px;
	}
	.actions {
		margin-top: 18px;
		display: grid;
		gap: 8px;
	}
</style>
