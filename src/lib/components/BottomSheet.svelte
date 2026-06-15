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
	let { snap = $bindable('peek'), peekPx = 140, ondismiss, children }: Props = $props();

	let vh = $state(browser ? window.innerHeight : 800);
	let dragging = $state(false);
	let liveH = $state<number | null>(null);

	function snapPx(s: Snap): number {
		if (s === 'peek') return peekPx;
		if (s === 'half') return Math.round(vh * 0.48);
		return Math.round(vh * 0.86);
	}
	const heightPx = $derived(dragging && liveH != null ? liveH : snapPx(snap));

	let startY = 0;
	let startH = 0;

	function down(e: PointerEvent) {
		dragging = true;
		startY = e.clientY;
		startH = snapPx(snap);
		liveH = startH;
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!dragging) return;
		const dy = startY - e.clientY; // drag up → positive → taller
		const min = ondismiss ? 0 : peekPx - 42;
		liveH = Math.max(min, Math.min(vh * 0.92, startH + dy));
	}
	function up() {
		if (!dragging) return;
		dragging = false;
		const target = liveH ?? snapPx(snap);
		liveH = null;
		// dragged well below peek → dismiss instead of snapping back
		if (ondismiss && target < peekPx * 0.6) {
			ondismiss();
			return;
		}
		const cands: Snap[] = ['peek', 'half', 'full'];
		snap = cands.reduce((best, s) =>
			Math.abs(snapPx(s) - target) < Math.abs(snapPx(best) - target) ? s : best
		);
	}
	function toggle() {
		// tap the handle: cycle peek → half → peek
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
		aria-label="Dra for å utvide panelet"
		aria-valuenow={snap === 'peek' ? 0 : snap === 'half' ? 1 : 2}
		aria-valuemin="0"
		aria-valuemax="2"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		onclick={toggle}
		onkeydown={(e) => {
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
		left: 8px;
		right: 8px;
		bottom: 8px;
		z-index: 600;
		display: flex;
		flex-direction: column;
		background: var(--panel);
		border: 1px solid rgba(6, 63, 61, 0.12);
		border-radius: 26px;
		box-shadow: var(--shadow);
		transition: height 0.28s cubic-bezier(0.22, 0.61, 0.36, 1);
		touch-action: none;
		backdrop-filter: blur(22px) saturate(1.2);
		overflow: hidden;
	}
	.sheet.dragging {
		transition: none;
	}
	.handle-area {
		flex: none;
		padding: 9px 0 5px;
		display: flex;
		justify-content: center;
		cursor: grab;
		touch-action: none;
	}
	.handle-area:active {
		cursor: grabbing;
	}
	.grab {
		width: 38px;
		height: 4px;
		border-radius: 999px;
		background: rgba(6, 63, 61, 0.2);
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
