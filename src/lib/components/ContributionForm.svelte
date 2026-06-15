<script lang="ts">
	import type { Camera, Confidence } from '$lib/types';
	import { EYEBALL_REWARD } from '$lib/types';

	interface Props {
		camera: Camera;
		onsubmit?: (data: { confirm: boolean; confidence: Confidence; note: string }) => void;
		oncancel?: () => void;
		busy?: boolean;
	}
	let { camera, onsubmit, oncancel, busy = false }: Props = $props();

	let confirm = $state(true);
	let confidence = $state<Confidence>('Middels');
	let note = $state('');

	const confidences: Confidence[] = ['Låg', 'Middels', 'Høg'];
	const reward = $derived(confirm ? EYEBALL_REWARD.confirm : EYEBALL_REWARD.estimate);
</script>

<div class="form">
	<header>
		<h2>Send stadfesting</h2>
		<span class="reward">+{reward} eyeballs</span>
	</header>
	<p class="sub">{camera.namn}</p>

	<div class="tabs">
		<button class="chip" class:active={confirm} onclick={() => (confirm = true)}>Bekreft</button>
		<button class="chip" class:active={!confirm} onclick={() => (confirm = false)}>Estimat</button>
	</div>

	<span class="fieldlabel">Kor sikker er du?</span>
	<div class="tabs">
		{#each confidences as c}
			<button class="chip" class:active={confidence === c} onclick={() => (confidence = c)}>
				{c}
			</button>
		{/each}
	</div>

	<label for="note">Kort notat</label>
	<textarea id="note" bind:value={note} maxlength="200" placeholder="Skriv kva du ser eller veit…"
	></textarea>

	<div class="actions">
		<button class="btn" disabled={busy} onclick={() => onsubmit?.({ confirm, confidence, note })}>
			{busy ? 'Sender…' : `Send stadfesting (+${reward})`}
		</button>
		<button class="btn btn-ghost" onclick={() => oncancel?.()}>Tilbake</button>
	</div>
</div>

<style>
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		margin: 0;
		font-size: 19px;
	}
	.reward {
		font-size: 13px;
		font-weight: 600;
		color: var(--blue);
	}
	.sub {
		color: var(--muted);
		margin: 4px 0 12px;
		font-size: 14px;
	}
	.fieldlabel {
		display: block;
		font-size: 13px;
		font-weight: 600;
		color: var(--muted);
		margin-bottom: 6px;
	}
	.tabs {
		display: flex;
		gap: 8px;
		margin-bottom: 14px;
	}
	.tabs .chip {
		flex: 1;
		justify-content: center;
	}
	.actions {
		margin-top: 16px;
		display: grid;
		gap: 8px;
	}
</style>
