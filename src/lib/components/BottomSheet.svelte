<script lang="ts">
	import { browser } from '$app/environment';
	import type { Snippet } from 'svelte';

	export type Snap = 'peek' | 'half' | 'full';

	interface Props {
		snap?: Snap;
		peekPx?: number;
		children: Snippet;
	}
	let { snap = $bindable('peek'), peekPx = 140, children }: Props = $props();

	let vh = $state(browser ? window.innerHeight : 800);
	let dragging = $state(false);
	let liveH = $state<number | null>(null);

	function snapPx(s: Snap): number {
		if (s === 'peek') return peekPx;
		if (s === 'half') return Math.round(vh * 0.5);
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
		liveH = Math.max(peekPx - 50, Math.min(vh * 0.92, startH + dy));
	}
	function up() {
		if (!dragging) return;
		dragging = false;
		const target = liveH ?? snapPx(snap);
		const cands: Snap[] = ['peek', 'half', 'full'];
		snap = cands.reduce((best, s) =>
			Math.abs(snapPx(s) - target) < Math.abs(snapPx(best) - target) ? s : best
		);
		liveH = null;
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
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 600;
		display: flex;
		flex-direction: column;
		background: var(--panel);
		border-radius: 22px 22px 0 0;
		box-shadow: var(--shadow);
		transition: height 0.28s cubic-bezier(0.22, 0.61, 0.36, 1);
		touch-action: none;
	}
	.sheet.dragging {
		transition: none;
	}
	.handle-area {
		flex: none;
		padding: 10px 0 6px;
		display: flex;
		justify-content: center;
		cursor: grab;
		touch-action: none;
	}
	.handle-area:active {
		cursor: grabbing;
	}
	.grab {
		width: 40px;
		height: 4px;
		border-radius: 999px;
		background: #d6dae2;
	}
	.content {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		padding: 0 18px calc(env(safe-area-inset-bottom) + 18px);
	}
	.content.scroll {
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}
</style>
