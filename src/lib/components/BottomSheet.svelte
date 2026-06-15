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

	let sheetEl: HTMLElement;
	let scrimEl = $state<HTMLButtonElement | undefined>(undefined);
	let contentEl: HTMLDivElement;

	function snapPx(s: Snap): number {
		if (s === 'peek') return peekPx;
		if (s === 'half') return Math.round(vh * 0.42);
		return Math.round(vh * 0.84);
	}
	/** The sheet is rendered at this tall height and pushed down with translateY. */
	const maxH = $derived(snapPx('full'));

	// Light haptic feedback (no-op where unsupported, e.g. iOS Safari).
	function haptic(ms = 8) {
		if (browser) navigator.vibrate?.(ms);
	}

	// Scrim opacity for a given visible height (only for dismissable sheets).
	function scrimFor(h: number): number {
		if (!ondismiss) return 0;
		const lo = snapPx('half') * 0.6;
		const hi = snapPx('full');
		const t = Math.max(0, Math.min(1, (h - lo) / (hi - lo)));
		return +(0.34 * t).toFixed(3);
	}

	function applyTranslate(h: number) {
		if (!sheetEl) return;
		sheetEl.style.transform = `translate3d(0, ${maxH - h}px, 0)`;
		if (scrimEl) scrimEl.style.opacity = String(scrimFor(h));
	}

	// ----- drag state (non-reactive: never written to during pointermove) -----
	let startY = 0;
	let startH = 0;
	let curH = 0;
	let moved = false;
	let lastY = 0;
	let lastT = 0;
	let vy = 0; // px/ms of pointer Y; positive = moving down
	let raf = 0;
	let pendingY = 0;
	let fromContent = false; // drag initiated inside the scroll area

	/** iOS-style rubber-band damping for overscroll past the top bound. */
	function rubber(x: number): number {
		return (1 - 1 / (x / maxH + 1)) * maxH;
	}

	function beginDrag(e: PointerEvent, viaContent: boolean) {
		dragging = true;
		moved = false;
		fromContent = viaContent;
		startY = e.clientY;
		startH = snapPx(snap);
		curH = startH;
		lastY = e.clientY;
		lastT = e.timeStamp;
		vy = 0;
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function handleDown(e: PointerEvent) {
		beginDrag(e, false);
	}

	// Content-initiated drag: only collapse when scrolled to the very top and pulling down.
	function contentDown(e: PointerEvent) {
		if (snap === 'peek') return;
		startY = e.clientY;
		lastY = e.clientY;
		fromContent = true;
		// don't capture or flip `dragging` yet — wait until contentMove confirms a pull-down
	}
	function contentMove(e: PointerEvent) {
		if (dragging) {
			scheduleMove(e);
			return;
		}
		if (!fromContent) return;
		const dy = e.clientY - startY;
		if (dy > 6 && contentEl.scrollTop <= 0) {
			beginDrag(e, true);
			scheduleMove(e);
		}
	}

	function scheduleMove(e: PointerEvent) {
		pendingY = e.clientY;
		const dt = e.timeStamp - lastT;
		if (dt > 0) vy = (e.clientY - lastY) / dt;
		lastY = e.clientY;
		lastT = e.timeStamp;
		if (raf) return;
		raf = requestAnimationFrame(() => {
			raf = 0;
			const dy = startY - pendingY;
			if (Math.abs(dy) > 4) moved = true;
			let h = startH + dy;
			const max = maxH;
			if (h > max) h = max + rubber(h - max); // rubber-band past the top
			const min = ondismiss ? 0 : Math.max(48, peekPx - 48);
			h = Math.max(min, h);
			curH = Math.min(h, max + maxH); // hard ceiling well past rubber zone
			applyTranslate(curH);
		});
	}

	function move(e: PointerEvent) {
		if (!dragging) return;
		scheduleMove(e);
	}

	function endDrag() {
		if (!dragging) return;
		if (raf) {
			cancelAnimationFrame(raf);
			raf = 0;
		}
		dragging = false;
		fromContent = false;
		const target = Math.min(curH, maxH);
		const flickDown = vy > 0.5;
		const flickUp = vy < -0.5;
		vy = 0;
		const half = snapPx('half');

		if (ondismiss) {
			if ((flickDown && target < snapPx('full')) || target < half * 0.6) {
				haptic(12);
				ondismiss();
				return;
			}
			const next = flickUp ? 'full' : flickDown ? 'half' : closest(target, ['half', 'full']);
			commit(next);
			return;
		}
		const next = flickUp
			? snap === 'peek'
				? 'half'
				: 'full'
			: flickDown
				? snap === 'full'
					? 'half'
					: 'peek'
				: closest(target, ['peek', 'half', 'full']);
		commit(next);
	}

	function commit(next: Snap) {
		const changed = next !== snap;
		snap = next; // triggers the rest $effect to animate home
		if (changed) haptic();
		else animateRest(); // same snap: spring back from a partial drag
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
		haptic();
	}

	function animateRest() {
		applyTranslate(snapPx(snap));
	}

	// Rest position: animate to the committed snap whenever it (or vh) changes and we're
	// not actively dragging. Imperative so it never fights inline styles.
	$effect(() => {
		snap;
		vh;
		if (dragging) return;
		applyTranslate(snapPx(snap));
	});

	$effect(() => {
		if (!browser) return;
		const onResize = () => (vh = window.innerHeight);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});
</script>

{#if ondismiss}
	<button
		bind:this={scrimEl}
		class="scrim"
		class:dragging
		style="opacity:{scrimFor(snapPx(snap))}"
		aria-label="Lukk panel"
		onclick={() => ondismiss?.()}
	></button>
{/if}
<section bind:this={sheetEl} class="sheet" class:dragging style="height:{maxH}px">
	<div
		class="handle-area"
		role="slider"
		tabindex="0"
		aria-label="Dra for å utvide eller lukke panelet"
		aria-valuenow={snap === 'peek' ? 0 : snap === 'half' ? 1 : 2}
		aria-valuemin="0"
		aria-valuemax="2"
		onpointerdown={handleDown}
		onpointermove={move}
		onpointerup={endDrag}
		onpointercancel={endDrag}
		onclick={toggle}
		onkeydown={(e) => {
			if (e.key === 'Escape' && ondismiss) ondismiss();
			if (e.key === 'ArrowUp') snap = snap === 'peek' ? 'half' : 'full';
			if (e.key === 'ArrowDown') snap = snap === 'full' ? 'half' : 'peek';
		}}
	>
		<span class="grab"></span>
	</div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={contentEl}
		class="content"
		class:scroll={snap !== 'peek'}
		onpointerdown={contentDown}
		onpointermove={contentMove}
		onpointerup={endDrag}
		onpointercancel={endDrag}
	>
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
		opacity: 0;
		will-change: opacity;
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
		will-change: transform;
		transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
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
		touch-action: pan-y;
	}
</style>
