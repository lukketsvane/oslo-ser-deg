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

	let startY = 0;
	let startH = 0;
	let moved = false;

	function down(e: PointerEvent) {
		dragging = true;
		moved = false;
		startY = e.clientY;
		startH = snapPx(snap);
		liveH = startH;
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!dragging) return;
		const dy = startY - e.clientY;
		if (Math.abs(dy) > 4) moved = true;
		const min = ondismiss ? 0 : Math.max(48, peekPx - 48);
		liveH = Math.max(min, Math.min(vh * 0.92, startH + dy));
	}
	function up() {
		if (!dragging) return;
		dragging = false;
		const target = liveH ?? snapPx(snap);
		liveH = null;
		if (ondismiss && target < Math.max(112, peekPx * 1.2)) {
			ondismiss();
			return;
		}
		const cands: Snap[] = ['peek', 'half', 'full'];
		snap = cands.reduce((best, s) =>
			Math.abs(snapPx(s) - target) < Math.abs(snapPx(best) - target) ? s : best
		);
	}
	function toggle() {
		if (moved) return;
		snap = snap === 'peek' ? 'half' : 'peek';
	}

	$effect(() => {
		if (!browser) return;
		const onResize = () => (vh = window.innerHeight);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});
</script>

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
