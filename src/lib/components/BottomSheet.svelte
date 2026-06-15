<script lang="ts">
	import { browser } from '$app/environment';
	import type { Snippet } from 'svelte';

	export type Snap = 'peek' | 'half' | 'full';

	interface Props {
		snap?: Snap;
		peekPx?: number;
		/** When set, dragging the sheet below the peek height dismisses it instead of snapping. */
		ondismiss?: () => void;
		children: Snippet;
	}
	let { snap = $bindable('peek'), peekPx = 116, ondismiss, children }: Props = $props();

	let vh = $state(browser ? window.innerHeight : 800);
	let dragging = $state(false);
	let liveH = $state<number | null>(null);

	function snapPx(s: Snap): number {
		if (s === 'peek') return peekPx;
		if (s === 'half') return Math.round(vh * 0.42);
		return Math.round(vh * 0.84);
	}
	const heightPx = $derived(dragging && liveH != null ? liveH : snapPx(snap));

	// Scrim darkens the map behind dismissable sheets and fades as the sheet is
	// dragged toward the dismiss line, so closing always has a clear target.
	const scrimOpacity = $derived.by(() => {
		if (!ondismiss) return 0;
		const lo = snapPx('half') * 0.6;
		const hi = snapPx('full');
		const t = Math.max(0, Math.min(1, (heightPx - lo) / (hi - lo)));
		return +(0.34 * t).toFixed(3);
	});

	let startY = 0;
	let startH = 0;
	let moved = false;
	let lastY = 0;
	let lastT = 0;
	let vy = 0; // px/ms of pointer Y; positive = moving down

	function down(e: PointerEvent) {
		dragging = true;
		moved = false;
		startY = e.clientY;
		startH = snapPx(snap);
		liveH = startH;
		lastY = e.clientY;
		lastT = e.timeStamp;
		vy = 0;
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!dragging) return;
		const dy = startY - e.clientY;
		if (Math.abs(dy) > 4) moved = true;
		const dt = e.timeStamp - lastT;
		if (dt > 0) vy = (e.clientY - lastY) / dt;
		lastY = e.clientY;
		lastT = e.timeStamp;
		const min = ondismiss ? 0 : Math.max(48, peekPx - 48);
		liveH = Math.max(min, Math.min(vh * 0.92, startH + dy));
	}
	function up() {
		if (!dragging) return;
		dragging = false;
		const target = liveH ?? snapPx(snap);
		const flickDown = vy > 0.5;
		const flickUp = vy < -0.5;
		liveH = null;
		vy = 0;
		const half = snapPx('half');

		if (ondismiss) {
			// A downward flick or a drag past ~60% of the half height closes it.
			if ((flickDown && target < snapPx('full')) || target < half * 0.6) {
				ondismiss();
				return;
			}
			snap = flickUp ? 'full' : flickDown ? 'half' : closest(target, ['half', 'full']);
			return;
		}
		snap = closest(target, ['peek', 'half', 'full']);
	}
	function closest(target: number, cands: Snap[]): Snap {
		return cands.reduce((best, s) =>
			Math.abs(snapPx(s) - target) < Math.abs(snapPx(best) - target) ? s : best
		);
	}
	function toggle() {
		if (moved) return;
		if (ondismiss) snap = snap === 'full' ? 'half' : 'full';
		else snap = snap === 'peek' ? 'half' : 'peek';
	}

	$effect(() => {
		if (!browser) return;
		const onResize = () => (vh = window.innerHeight);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});
</script>

{#if ondismiss && scrimOpacity > 0.001}
	<button
		class="scrim"
		class:dragging
		style="opacity:{scrimOpacity}"
		aria-label="Lukk panel"
		onclick={() => ondismiss?.()}
	></button>
{/if}
<section class="sheet" class:dragging style="height:{heightPx}px">
	<div
		class="handle-area"
		role="slider"
		tabindex="0"
		aria-label="Dra for å utvide eller lukke panelet"
		aria-valuenow={snap === 'peek' ? 0 : snap === 'half' ? 1 : 2}
		aria-valuemin="0"
		aria-valuemax="2"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		onclick={toggle}
		onkeydown={(e) => {
			if (e.key === 'Escape' && ondismiss) ondismiss();
			if (e.key === 'ArrowUp') snap = snap === 'peek' ? 'half' : 'full';
			if (e.key === 'ArrowDown') snap = snap === 'full' ? 'half' : 'peek';
		}}
	>
		<span class="grab"></span>
	</div>
	<div class="content" class:scroll={snap !== 'peek'}>
		{@render children()}
	</div>
</section>

<style>
	.scrim {
		position: absolute;
		inset: 0;
		z-index: 595;
		border: 0;
		padding: 0;
		background: rgba(15, 23, 42, 1);
		transition: opacity 0.26s cubic-bezier(0.22, 0.61, 0.36, 1);
		cursor: pointer;
	}
	.scrim.dragging {
		transition: none;
	}
	.sheet {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 600;
		display: flex;
		flex-direction: column;
		background: var(--panel);
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-bottom: 0;
		border-radius: 26px 26px 0 0;
		box-shadow: var(--shadow);
		transition: height 0.26s cubic-bezier(0.22, 0.61, 0.36, 1);
		touch-action: none;
		backdrop-filter: blur(24px) saturate(1.2);
		overflow: hidden;
	}
	.sheet.dragging {
		transition: none;
	}
	.handle-area {
		flex: none;
		padding: 8px 0 5px;
		display: flex;
		justify-content: center;
		cursor: grab;
		touch-action: none;
	}
	.handle-area:active {
		cursor: grabbing;
	}
	.grab {
		width: 42px;
		height: 4px;
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.16);
	}
	.content {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		padding: 0 14px calc(env(safe-area-inset-bottom) + 14px);
	}
	.content.scroll {
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}
</style>
