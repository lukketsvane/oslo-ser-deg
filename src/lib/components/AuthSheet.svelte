<script lang="ts">
	import { browser } from '$app/environment';
	import { identity } from '$lib/stores/identity';

	interface Props {
		onclose?: () => void;
	}
	let { onclose }: Props = $props();

	// Hide the "add to home screen" tip once the app is already installed/standalone.
	const standalone =
		browser &&
		(window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as unknown as { standalone?: boolean }).standalone === true);

	let tab = $state<'login' | 'register'>('register');
	let handle = $state('');
	let password = $state('');
	let busy = $state(false);
	let err = $state<string | null>(null);

	async function submit() {
		err = null;
		busy = true;
		const r =
			tab === 'register'
				? await identity.register(handle, password)
				: await identity.login(handle, password);
		busy = false;
		if (r.ok) {
			password = '';
			onclose?.();
		} else {
			err = r.error;
		}
	}

	async function logout() {
		await identity.logout();
		onclose?.();
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose?.()} />
<div class="backdrop">
	<button class="scrim" aria-label="Lukk" onclick={() => onclose?.()}></button>
	<div class="card">
		<div class="grab"></div>

		{#if $identity.account}
			<h2>@{$identity.handle}</h2>
			<p class="sub">👁 {$identity.eyeballs} eyeballs · {$identity.streak} dagars streak</p>
			<button class="btn btn-secondary" onclick={logout}>Logg ut</button>
			<button class="btn btn-ghost" onclick={() => onclose?.()}>Lukk</button>
		{:else}
			<div class="tabs">
				<button class="chip" class:active={tab === 'register'} onclick={() => (tab = 'register')}>
					Lag konto
				</button>
				<button class="chip" class:active={tab === 'login'} onclick={() => (tab = 'login')}>
					Logg inn
				</button>
			</div>

			<p class="sub">
				{tab === 'register'
					? 'Brukarnamn og passord. Ingen e-post.'
					: 'Logg inn for å ta vare på eyeballs på tvers av einingar.'}
			</p>

			<label for="h">Brukarnamn</label>
			<input
				id="h"
				bind:value={handle}
				placeholder="vel eit brukarnamn"
				autocomplete="username"
				maxlength="24"
			/>

			<label for="p">Passord</label>
			<input
				id="p"
				type="password"
				bind:value={password}
				placeholder="minst 6 teikn"
				autocomplete={tab === 'register' ? 'new-password' : 'current-password'}
				onkeydown={(e) => e.key === 'Enter' && submit()}
			/>

			{#if err}<p class="err">{err}</p>{/if}

			<button class="btn" disabled={busy} onclick={submit}>
				{busy ? '…' : tab === 'register' ? 'Lag konto' : 'Logg inn'}
			</button>
			<button class="btn btn-ghost" onclick={() => onclose?.()}>Avbryt</button>
		{/if}

		{#if !standalone}
			<div class="install">
				<strong>📲 Legg på heimskjermen</strong>
				<ol>
					<li>Trykk Del-knappen nede i Safari.</li>
					<li>Vel <b>Legg til på Hjem-skjerm</b>.</li>
					<li>Appen heiter då <b>OsloSerDeg</b>.</li>
				</ol>
			</div>
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 800;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	.scrim {
		position: absolute;
		inset: 0;
		border: none;
		background: rgba(11, 16, 32, 0.45);
	}
	.card {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 520px;
		background: var(--panel);
		border-radius: 22px 22px 0 0;
		box-shadow: var(--shadow);
		padding: 10px 18px calc(env(safe-area-inset-bottom) + 18px);
		display: grid;
		gap: 8px;
		animation: rise 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
	}
	@keyframes rise {
		from {
			transform: translateY(100%);
		}
	}
	.grab {
		width: 40px;
		height: 4px;
		border-radius: 999px;
		background: #d6dae2;
		margin: 0 auto 6px;
	}
	h2 {
		margin: 0;
		font-size: 20px;
	}
	.sub {
		color: var(--muted);
		font-size: 13px;
		margin: 0 0 6px;
	}
	.tabs {
		display: flex;
		gap: 8px;
	}
	.tabs .chip {
		flex: 1;
		justify-content: center;
	}
	label {
		margin-top: 4px;
	}
	.err {
		color: #dc2626;
		font-size: 13px;
		margin: 2px 0 0;
	}
	.install {
		margin-top: 6px;
		padding-top: 12px;
		border-top: 1px solid var(--line);
	}
	.install strong {
		font-size: 14px;
	}
	.install ol {
		margin: 8px 0 0;
		padding-left: 18px;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.5;
	}
	.install b {
		color: var(--ink);
	}
</style>
