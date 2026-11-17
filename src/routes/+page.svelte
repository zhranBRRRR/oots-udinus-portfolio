<script lang="ts">
	import { flushSync } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { projects } from '$lib/data';

	type Theme = 'light' | 'dark';

	let theme: Theme = $state('light');
	let now = $state<Date | null>(null);
	let cursor = $state({ x: -100, y: -100, nx: 0, ny: 0, big: false });
	let hero: HTMLElement;

	// progres scroll tiap bab, 0 → 1
	let heroP = $state(0);
	let aboutP = $state(0);
	let bandP = $state(0);
	let tunnelP = $state(0);
	let footP = $state(0);
	let chapter = $state(0);
	// status formulir kontak: idle | loading | success | error
	let status = $state<'idle' | 'loading' | 'success' | 'error'>('idle');

	const chapters = ['INTRO', 'TENTANG', 'LAB', 'PROYEK', 'KONTAK'];
	const story = [
		{ line: 'Siswa SMK jurusan RPL.', face: 'RPL', look: 'bg-primary text-on-primary' },
		{ line: 'Membangun antarmuka web yang cepat,', face: 'CEPAT', look: 'bg-ink text-bg' },
		{ line: 'rapi,', face: 'RAPI', look: 'face-grid bg-bg text-ink' },
		{ line: 'dan mudah dipakai.', face: 'MUDAH', look: 'bg-surface text-primary' }
	];
	const ticker = [
		'za.bruh',
		'Siswa RPL',
		...projects.map((p) => p.stack),
		'Cepat',
		'Rapi',
		'Mudah dipakai'
	];
	const glyphs = '!<>-_\\/[]{}=+*^?#01';
	const SPACING = 1600; // jarak antar kartu proyek di sumbu Z (px)
	const FRAME_GAP = 600;
	const frames = Array.from({ length: 10 }, (_, k) => k);
	const layers = Array.from({ length: 14 }, (_, k) => 13 - k); // dirender belakang → depan

	const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
	const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
	const ease = (t: number) => 1 - (1 - t) ** 3;
	const smooth = (t: number) => t * t * (3 - 2 * t);
	// kamera terowongan diam di tiap kartu selama 30% pertama jatahnya, lalu terbang ke kartu berikutnya
	const dwell = (t: number) => Math.floor(t) + smooth(seg(t - Math.floor(t), 0.3, 1));

	const clock = $derived(
		now?.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false }) ?? '--.--.--'
	);
	const burstE = $derived(seg(heroP, 0.05, 0.9) ** 2);
	const heroFade = $derived(1 - seg(heroP, 0.55, 0.9));
	const uiFade = $derived(seg(heroP, 0, 0.25));
	const step = $derived(Math.round(aboutP * (story.length - 1)));
	const bandE = $derived(ease(seg(bandP, 0, 0.55)));
	const cam = $derived(dwell(tunnelP * (projects.length - 1)));
	const activeCard = $derived(Math.round(cam));
	// ekstrusi huruf: 12 bayangan bertumpuk, arahnya melawan posisi kursor
	const extrude = $derived(
		Array.from({ length: 12 }, (_, k) => {
			const d = k + 1;
			const x = (d * (0.003 - cursor.nx * 0.01)).toFixed(4);
			const y = (d * (0.005 - cursor.ny * 0.01)).toFixed(4);
			return `${x}em ${y}em 0 color-mix(in oklab, var(--primary), #000 ${k * 5}%)`;
		}).join(', ')
	);

	$effect(() => {
		now = new Date();
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});

	const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

	// p = 0 → 1. pinned: selama section di-scroll melewati stage sticky-nya.
	// Tidak pinned: seberapa jauh elemen sudah masuk dari bawah layar.
	function scrolly(
		onProgress: (p: number, r: DOMRect) => void,
		pinned = true
	): Attachment<HTMLElement> {
		return (node) => {
			let raf = 0;
			const update = () => {
				raf = 0;
				const r = node.getBoundingClientRect();
				const raw = pinned
					? -r.top / Math.max(1, r.height - innerHeight)
					: (innerHeight - r.top) / r.height;
				onProgress(clamp01(raw), r);
			};
			const queue = () => (raf ||= requestAnimationFrame(update));
			update();
			addEventListener('scroll', queue, { passive: true });
			addEventListener('resize', queue);
			return () => {
				cancelAnimationFrame(raf);
				removeEventListener('scroll', queue);
				removeEventListener('resize', queue);
			};
		};
	}

	const mark = (n: number, r: DOMRect) => {
		if (r.top <= innerHeight / 2 && r.bottom > innerHeight / 2) chapter = n;
	};

	// arah ledakan tiap huruf: sudut menyebar, huruf belakang terbang lebih dekat ke kamera
	function burst(i: number, e: number) {
		const a = i * 2.4 + 0.6;
		return `translate3d(${Math.cos(a) * 55 * e}vw, ${Math.sin(a) * 45 * e}vh, ${(350 + i * 90) * e}px) rotateX(${(i % 2 ? 140 : -110) * e}deg) rotateY(${(i - 2.5) * 45 * e}deg)`;
	}

	// kartu i tepat di depan kamera (z = -150) saat posisi kamera = i
	function card(i: number, cam: number) {
		const z = (cam - i) * SPACING - 150;
		const side = i % 2 ? 1 : -1;
		const far = clamp01((-150 - z) / 2000);
		const past = clamp01((z + 150) / 500);
		const opacity = Math.min(1 - past, 1 - clamp01((-z - 1350) / 1600));
		return {
			transform: `translate3d(${side * (24 * far - 45 * past)}vw, ${-8 * far}vh, ${z}px) rotateY(${side * (20 * past - 28 * far)}deg)`,
			opacity: opacity.toFixed(3),
			hidden: opacity < 0.02
		};
	}

	// bingkai terowongan berulang: muncul dari jauh, hilang sebelum menembus kamera
	function frame(k: number, p: number) {
		const span = frames.length * FRAME_GAP;
		const z = ((k * FRAME_GAP + p * (projects.length - 1) * SPACING) % span) - span + 400;
		const opacity = Math.min(clamp01((z + span - 400) / 1500), 1 - clamp01(z / 400));
		return {
			transform: `translateZ(${z}px) rotateZ(${k * 9 + p * 120}deg)`,
			opacity: opacity.toFixed(3)
		};
	}

	// Ganti tema dengan lingkaran yang membesar dari tombol; browser lama langsung ganti.
	function toggleTheme(e: MouseEvent & { currentTarget: HTMLButtonElement }) {
		const next: Theme = theme === 'dark' ? 'light' : 'dark';
		if (reducedMotion() || !('startViewTransition' in document)) {
			theme = next;
			return;
		}
		const r = e.currentTarget.getBoundingClientRect();
		const x = r.left + r.width / 2;
		const y = r.top + r.height / 2;
		const s = document.documentElement.style;
		s.setProperty('--vt-x', `${x}px`);
		s.setProperty('--vt-y', `${y}px`);
		s.setProperty(
			'--vt-r',
			`${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`
		);
		document.startViewTransition(() => {
			theme = next;
			flushSync();
		});
	}

	function trackCursor(e: PointerEvent) {
		cursor = {
			x: e.clientX,
			y: e.clientY,
			nx: e.clientX / innerWidth - 0.5,
			ny: e.clientY / innerHeight - 0.5,
			big: !!(e.target as Element).closest?.('a, button, article')
		};
		// lampu sorot di hero mengikuti kursor
		const r = hero.getBoundingClientRect();
		hero.style.setProperty('--mx', `${e.clientX - r.left}px`);
		hero.style.setProperty('--my', `${e.clientY - r.top}px`);
	}

	// Judul "terurai" dari karakter acak saat kartu di-hover. Aman karena data proyek statis.
	const scramble: Attachment<HTMLElement> = (node) => {
		const text = (node.textContent ?? '').trim();
		const row = node.closest('article') ?? node;
		let raf = 0;

		const run = () => {
			if (reducedMotion()) return;
			cancelAnimationFrame(raf);
			let frame = 0;
			const tick = () => {
				node.textContent = [...text]
					.map((c, i) =>
						c === ' ' || i < frame / 2 ? c : glyphs[Math.floor(Math.random() * glyphs.length)]
					)
					.join('');
				if (frame++ < text.length * 2) raf = requestAnimationFrame(tick);
			};
			tick();
		};

		row.addEventListener('pointerenter', run);
		return () => {
			row.removeEventListener('pointerenter', run);
			cancelAnimationFrame(raf);
			node.textContent = text;
		};
	};
</script>

<svelte:window onpointermove={trackCursor} />

{#snippet tickerRow()}
	{#each [0, 1] as copy (copy)}
		<div class="flex shrink-0 items-center">
			{#each ticker as word (word)}
				<span class="px-5 lg:px-8">{word}</span>
				<span class="text-[0.55em]">✦</span>
			{/each}
		</div>
	{/each}
{/snippet}

{#snippet arrow(cls: string)}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		class={cls}
		aria-hidden="true"
	>
		<path d="M7 17 17 7M9 7h8v8" />
	</svg>
{/snippet}

{#snippet label(text: string, right: string)}
	<div class="flex items-center gap-4 font-mono text-[11px] tracking-[1.1px]">
		<span>{text}</span>
		<span class="h-px flex-1 bg-line"></span>
		<span class="text-muted tabular-nums">{right}</span>
	</div>
{/snippet}

<div class="page min-h-dvh overflow-x-clip bg-bg text-ink {theme === 'dark' ? 'dark' : ''}">
	<!-- tirai pembuka, progres scroll, grain, kursor, penanda bab -->
	<div
		class="curtain pointer-events-none fixed inset-0 z-[70] flex items-end justify-between bg-ink p-6 text-bg lg:p-24"
		aria-hidden="true"
	>
		<span class="font-mono text-[11px] tracking-[1.1px]">ZA.BRUH — PORTOFOLIO 2026</span>
		<span class="count text-[72px] leading-none font-medium tracking-[-0.04em] lg:text-[180px]"
		></span>
	</div>
	<div class="progress fixed inset-x-0 top-0 z-50 h-[3px] bg-primary" aria-hidden="true"></div>
	<div class="grain pointer-events-none fixed inset-[-50%] z-[60]" aria-hidden="true"></div>
	<div
		class="cursor"
		class:big={cursor.big}
		style:translate="{cursor.x}px {cursor.y}px"
		aria-hidden="true"
	></div>
	<ol
		class="hud fixed top-1/2 right-6 z-30 hidden -translate-y-1/2 flex-col gap-2.5 font-mono text-[10px] tracking-[1.1px] xl:flex"
		aria-hidden="true"
	>
		{#each chapters as name, i (name)}
			<li class="flex items-center justify-end gap-2" class:on={i === chapter}>
				<span>0{i} {name}</span>
			</li>
		{/each}
	</ol>

	<!-- nav -->
	<header class="sticky top-0 z-40 border-b border-line bg-bg/75 backdrop-blur-md">
		<div
			class="mx-auto flex h-[60px] max-w-[1440px] items-center justify-between px-6 lg:h-[72px] lg:px-24"
		>
			<a href={resolve('/')} class="text-[15px] font-semibold lg:text-base">
				za.bruh<span class="caret text-primary" aria-hidden="true">_</span>
			</a>

			<div class="flex items-center gap-2 lg:gap-8">
				<nav class="hidden items-center gap-7 lg:flex">
					<a href="#proyek" class="u-link text-sm text-muted hover:text-ink">
						<sup class="font-mono text-[10px] text-primary">01</sup> Proyek
					</a>
					<a href="#tentang" class="u-link text-sm text-muted hover:text-ink">
						<sup class="font-mono text-[10px] text-primary">02</sup> Tentang
					</a>
					<a href="#kontak" class="u-link text-sm text-muted hover:text-ink">
						<sup class="font-mono text-[10px] text-primary">03</sup> Kontak
					</a>
				</nav>

				<button
					type="button"
					aria-label="Ganti tema"
					onclick={toggleTheme}
					class="group/theme flex h-11 w-11 items-center justify-center border border-line transition-colors hover:border-ink"
				>
					<svg
						width="17"
						height="17"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="transition-transform duration-500 group-hover/theme:-rotate-[30deg] dark:hidden"
					>
						<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
					</svg>
					<svg
						width="17"
						height="17"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						class="hidden transition-transform duration-700 group-hover/theme:rotate-90 dark:block"
					>
						<circle cx="12" cy="12" r="4" />
						<path
							d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
						/>
					</svg>
				</button>

				<button
					type="button"
					aria-label="Buka menu"
					class="flex h-11 w-11 items-center justify-center border border-line lg:hidden"
				>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
					>
						<path d="M4 7h16M4 12h16M4 17h16" />
					</svg>
				</button>
			</div>
		</div>
	</header>

	<!-- bab 00: hero — huruf meledak ke arah kamera, matahari tenggelam di balik lantai grid -->
	<section
		class="scrolly relative h-[220vh]"
		{@attach scrolly((p, r) => {
			heroP = p;
			mark(0, r);
		})}
	>
		<div
			bind:this={hero}
			class="stage hero"
			style="perspective: 1000px; perspective-origin: 50% 55%"
		>
			<div class="fx sun-clip" aria-hidden="true">
				<div class="sun" style:transform="translateY({35 + heroP * 65}%)"></div>
			</div>
			<div class="fx floor-wrap" style:transform="rotateX({76 + heroP * 8}deg)" aria-hidden="true">
				<div class="floor"></div>
			</div>

			<div
				class="relative mx-auto flex h-full max-w-[1440px] flex-col px-6 pt-8 pb-8 transform-3d lg:px-24 lg:pt-10"
				style:transform="translateZ({heroP * 200}px)"
			>
				<div style:opacity={1 - uiFade}>
					{@render label('[ 00 ] PORTOFOLIO', 'INDEX — 2026')}
				</div>

				<h1
					class="mt-6 text-[30vw] leading-[0.85] font-medium tracking-[-0.05em] transform-3d lg:text-[length:clamp(160px,19vw,280px)]"
					style:transform="rotateX({-cursor.ny * 16}deg) rotateY({cursor.nx * 24}deg)"
					style:text-shadow={extrude}
				>
					<span class="sr-only">za bruh</span>
					{#each ['Zahran', 'Naufal'] as word, w (word)}
						<span class="block transform-3d" aria-hidden="true">
							{#each [...word] as char, i (i)}
								{@const n = i + w * 2}
								<span
									class="char inline-block {w ? 'outline-text' : ''}"
									style:transform={burst(n, burstE)}
									style:opacity={heroFade}
								>
									<span class="char-in inline-block" style:--i={n}>{char}</span>
								</span>
							{/each}
						</span>
					{/each}
				</h1>

				<svg
					viewBox="0 0 200 200"
					class="absolute top-24 right-6 h-28 w-28 lg:top-28 lg:right-24 lg:h-44 lg:w-44"
					style:transform="translate3d({burstE * 30}vw, {burstE * -30}vh, {burstE * 300}px) rotate({burstE *
						270}deg)"
					style:opacity={heroFade}
					aria-hidden="true"
				>
					<defs>
						<path id="badge-path" d="M100 100m-78 0a78 78 0 1 1 156 0a78 78 0 1 1-156 0" />
					</defs>
					<g class="badge-spin">
						<text class="fill-current font-mono text-[14px] tracking-[2px]">
							<textPath href="#badge-path" textLength="488">
								TERSEDIA UNTUK PROYEK BARU ✦ 2026 ✦
							</textPath>
						</text>
					</g>
					<circle cx="100" cy="100" r="36" class="fill-primary" />
					<path
						d="M88 112 112 88M94 88h18v18"
						fill="none"
						stroke-width="3"
						stroke-linecap="square"
						class="stroke-on-primary"
					/>
				</svg>

				<div
					class="mt-auto flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"
					style:opacity={1 - uiFade}
					style:transform="translateY({uiFade * 60}px)"
				>
					<div class="flex flex-wrap items-center gap-4">
						<a
							href="#proyek"
							class="cta flex h-14 items-center gap-3 bg-primary px-7 text-[15px] font-medium text-on-primary"
						>
							<span class="roll">
								<span>Lihat proyek</span>
								<span aria-hidden="true">Lihat proyek</span>
							</span>
							{@render arrow('h-4 w-4 rotate-90')}
						</a>
						<a
							href="#kontak"
							class="cta-ghost relative flex h-14 items-center border border-ink bg-bg px-7 text-[15px]"
						>
							<span class="roll">
								<span>Hubungi saya</span>
								<span aria-hidden="true">Hubungi saya</span>
							</span>
						</a>
					</div>

					<dl
						class="grid grid-cols-2 gap-x-8 gap-y-3 font-mono text-[11px] tracking-[1.1px] lg:flex lg:gap-10"
					>
						<div class="col-span-2">
							<dt class="text-muted">STATUS</dt>
							<dd class="mt-1.5 flex items-center gap-2.5">
								<span class="pulse h-2 w-2 rounded-full bg-success"></span>
								TERSEDIA UNTUK PROYEK BARU — 2026
							</dd>
						</div>
						<div>
							<dt class="text-muted">WAKTU</dt>
							<dd class="mt-1.5 tabular-nums">{clock} WIB</dd>
						</div>
						<div>
							<dt class="text-muted">SCROLL</dt>
							<dd class="mt-1.5 flex items-center gap-1.5 tabular-nums">
								{String(Math.round(heroP * 100)).padStart(3, '0')}% <span class="bob">↓</span>
							</dd>
						</div>
					</dl>
				</div>
			</div>
		</div>
	</section>

	<!-- pita silang -->
	<div class="relative border-t border-line py-14 lg:py-24" aria-hidden="true">
		<div
			class="tape relative -left-[10vw] w-[120vw] -rotate-3 bg-primary py-3 text-[26px] font-medium tracking-[-0.02em] whitespace-nowrap text-on-primary uppercase lg:py-4 lg:text-[52px]"
		>
			<div class="marquee flex w-max">{@render tickerRow()}</div>
		</div>
		<div
			class="tape absolute top-1/2 -left-[10vw] w-[120vw] -translate-y-1/2 rotate-2 bg-ink py-3 text-[26px] font-medium tracking-[-0.02em] whitespace-nowrap text-bg uppercase lg:py-4 lg:text-[52px]"
		>
			<div class="marquee marquee-rev flex w-max">{@render tickerRow()}</div>
		</div>
	</div>

	<!-- bab 01: tentang — kubus berputar satu sisi per kalimat -->
	<section
		id="tentang"
		class="scrolly relative h-[400vh] border-t border-line"
		{@attach scrolly((p, r) => {
			aboutP = p;
			mark(1, r);
		})}
	>
		<div class="stage grid grid-rows-[1fr_auto] lg:grid-cols-2 lg:grid-rows-1">
			<div class="relative grid place-items-center lg:order-2" style="perspective: 900px">
				<div
					class="orbit relative grid place-items-center transform-3d"
					style:transform="rotateX({-14 - cursor.ny * 24}deg) rotateY({cursor.nx * 36}deg)"
				>
					<div class="fx ring" aria-hidden="true"></div>
					<div class="fx ring-b ring" aria-hidden="true"></div>
					<div class="cube" style:transform="rotateY({-aboutP * 270}deg)" aria-hidden="true">
						{#each story as s, i (s.face)}
							<div
								class="face {s.look}"
								style:transform="rotateY({i * 90}deg) translateZ(calc(var(--s) / 2))"
							>
								<span class="font-mono text-[10px] tracking-[1.1px]">0{i + 1} / 04</span>
								<span class="face-word">{s.face}</span>
							</div>
						{/each}
						<div
							class="face face-top"
							style:transform="rotateX(90deg) translateZ(calc(var(--s) / 2))"
						></div>
						<div
							class="face face-bottom bg-ink"
							style:transform="rotateX(-90deg) translateZ(calc(var(--s) / 2))"
						></div>
					</div>
				</div>
			</div>

			<div class="flex flex-col justify-center gap-8 px-6 pb-12 lg:order-1 lg:pr-0 lg:pl-24">
				{@render label('[ 01 ] TENTANG', `0${step + 1} / 04`)}
				<ol class="flex flex-col gap-3 lg:gap-5">
					{#each story as s, i (s.face)}
						<li
							class="step text-[24px] leading-[1.1] font-medium tracking-[-0.02em] lg:text-[44px] lg:tracking-[-1px]"
							class:active={i === step}
						>
							{s.line}
						</li>
					{/each}
				</ol>
				<div class="h-px bg-line">
					<div class="h-px origin-left bg-primary" style:transform="scaleX({aboutP})"></div>
				</div>
			</div>
		</div>
	</section>

	<!-- bab 02: lab — foto bangkit dari posisi rebah -->
	<section
		class="scrolly relative h-[220vh] border-t border-line"
		{@attach scrolly((p, r) => {
			bandP = p;
			mark(2, r);
		})}
	>
		<div class="stage flex flex-col items-center justify-center" style="perspective: 1200px">
			<p
				class="fx outline-text pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[24vw] leading-none font-medium tracking-[-0.05em] whitespace-nowrap opacity-50 select-none"
				style:transform="translateX({(0.5 - bandP) * 40}vw)"
				aria-hidden="true"
			>
				LAB RPL
			</p>

			<figure
				class="group relative w-[min(90vw,1100px)]"
				style:transform="translateZ({(1 - bandE) * -250 + seg(bandP, 0.7, 1) * 120}px) rotateX({(1 -
					bandE) *
					65 -
					cursor.ny * 6}deg) rotateZ({(1 - bandE) * -8}deg) rotateY({cursor.nx * 8}deg)"
			>
				<div class="relative overflow-hidden">
					<img
						src="/images/band.jpeg"
						alt="Foto kegiatan lab RPL"
						class="h-[44vh] w-full object-cover contrast-125 grayscale transition duration-1000 ease-out group-hover:scale-[1.03] group-hover:grayscale-0 lg:h-[56vh]"
					/>
					<div
						class="pointer-events-none absolute inset-0 bg-primary mix-blend-multiply transition-opacity duration-1000 group-hover:opacity-0"
						aria-hidden="true"
					></div>
					<div class="scanlines pointer-events-none absolute inset-0" aria-hidden="true"></div>
					<div class="pointer-events-none absolute inset-4 lg:inset-8" aria-hidden="true">
						<span class="corner top-0 left-0 border-t border-l"></span>
						<span class="corner top-0 right-0 border-t border-r"></span>
						<span class="corner bottom-0 left-0 border-b border-l"></span>
						<span class="corner right-0 bottom-0 border-r border-b"></span>
						<span
							class="absolute top-4 left-5 font-mono text-[11px] tracking-[1.1px] text-white mix-blend-difference lg:top-6 lg:left-7"
						>
							FIG. 02
						</span>
						<span
							class="absolute right-5 bottom-4 flex items-center gap-2 font-mono text-[11px] tracking-[1.1px] text-white lg:right-7 lg:bottom-6"
						>
							<span class="caret h-2 w-2 rounded-full bg-danger"></span>REC
						</span>
					</div>
				</div>
				<figcaption
					class="flex justify-between bg-bg py-4 font-mono text-[11px] tracking-[1.1px] text-muted"
				>
					<span>LAB RPL — SMK NEGERI 1 · 2026</span>
					<span>[ 02 ] LAB</span>
				</figcaption>
			</figure>
		</div>
	</section>

	<!-- bab 03: proyek — terbang menembus terowongan, satu kartu per proyek -->
	<section
		id="proyek"
		class="scrolly relative border-t border-line"
		style:height="{(projects.length + 0.5) * 100}vh"
		{@attach scrolly((p, r) => {
			tunnelP = p;
			mark(3, r);
		})}
	>
		<div class="stage flex flex-col" style="perspective: 900px">
			<div class="world absolute inset-0 grid place-items-center transform-3d">
				{#each frames as k (k)}
					{@const f = frame(k, tunnelP)}
					<div class="fx frame" style:transform={f.transform} style:opacity={f.opacity}></div>
				{/each}

				{#each projects as project, i (project.title)}
					{@const c = card(i, cam)}
					<article
						class="card group relative isolate w-[min(88vw,860px)] overflow-hidden border border-line bg-bg p-6 lg:p-10"
						style:transform={c.transform}
						style:opacity={c.opacity}
						style:visibility={c.hidden ? 'hidden' : null}
						style:pointer-events={i === activeCard ? null : 'none'}
					>
						<span class="wipe absolute inset-0 -z-10 bg-primary" aria-hidden="true"></span>
						<div class="transition-colors duration-500 group-hover:text-on-primary">
							<div class="flex items-start justify-between gap-6">
								<span
									class="outline-text text-[64px] leading-[0.8] font-medium tracking-[-0.04em] lg:text-[120px]"
								>
									{String(i + 1).padStart(2, '0')}
								</span>
								<div class="flex flex-col items-end gap-3 font-mono text-[11px] tracking-[1.1px]">
									<span class="border border-current px-2 py-1 uppercase">{project.stack}</span>
									<span>{project.year}</span>
									{@render arrow(
										'h-8 w-8 text-primary transition duration-500 group-hover:rotate-45 group-hover:text-on-primary lg:h-12 lg:w-12'
									)}
								</div>
							</div>
							<h2
								{@attach scramble}
								class="mt-8 text-[30px] leading-[1.05] font-medium tracking-[-0.5px] transition-transform duration-500 group-hover:translate-x-3 lg:mt-12 lg:text-[60px] lg:tracking-[-1.5px]"
							>
								{project.title}
							</h2>
							<p
								class="mt-3 max-w-[520px] text-[15px] leading-[1.55] text-muted transition-colors duration-500 group-hover:text-on-primary lg:text-[17px]"
							>
								{project.description}
							</p>
						</div>
					</article>
				{/each}
			</div>

			<div class="relative mx-auto w-full max-w-[1440px] px-6 pt-6 lg:px-24 lg:pt-8">
				{@render label('[ 03 ] PROYEK', `(${String(projects.length).padStart(2, '0')})`)}
			</div>

			<div
				class="relative mx-auto mt-auto flex w-full max-w-[1440px] items-end justify-between gap-6 px-6 pb-8 font-mono text-[11px] tracking-[1.1px] lg:px-24"
			>
				<span class="text-[48px] leading-none font-medium tracking-[-0.04em] lg:text-[72px]">
					0{activeCard + 1}<span class="text-muted">/0{projects.length}</span>
				</span>
				<div class="flex w-40 flex-col gap-2 lg:w-64">
					<span class="flex justify-between text-muted">
						<span>KEDALAMAN</span>
						<span class="tabular-nums">
							{String(Math.round(cam * SPACING)).padStart(4, '0')} PX
						</span>
					</span>
					<span class="h-px bg-line">
						<span class="block h-px origin-left bg-primary" style:transform="scaleX({tunnelP})"
						></span>
					</span>
				</div>
			</div>
		</div>
	</section>

	<!-- bab 04: kontak — formulir pesan, tanpa animasi scroll -->
	<section
		id="kontak"
		class="relative border-t border-line"
		{@attach scrolly((p, r) => mark(4, r), false)}
	>
		<div class="mx-auto max-w-[1440px] px-6 pt-5 pb-14 lg:px-24 lg:pb-24">
			{@render label('[ 04 ] KONTAK', 'FORMULIR')}

			<div class="mt-7 flex flex-col gap-8 lg:mt-10 lg:flex-row lg:gap-24">
				<p class="max-w-[420px] text-[17px] leading-[1.6] text-muted lg:text-xl">
					Punya pertanyaan atau ingin bekerja sama? Kirim pesan.
				</p>

				<form
					method="POST"
					action="?/kirim"
					use:enhance={() => {
						status = 'loading';
						return async ({ result, update }) => {
							await update({ reset: result.type === 'success' });
							status = result.type === 'success' ? 'success' : 'error';
						};
					}}
					class="flex w-full flex-col gap-4 lg:w-[440px] lg:shrink-0"
				>
					<label class="flex flex-col gap-2">
						<span class="font-mono text-[11px] tracking-[1.1px] text-muted">NAMA</span>
						<input
							name="nama"
							required
							autocomplete="name"
							placeholder="Nama lengkap kamu"
							class="h-12 w-full border border-line bg-bg px-3.5 text-[15px] outline-none placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary"
						/>
					</label>

					<label class="flex flex-col gap-2">
						<span class="font-mono text-[11px] tracking-[1.1px] text-muted">EMAIL</span>
						<input
							name="email"
							type="email"
							required
							autocomplete="email"
							placeholder="nama@email.com"
							class="h-12 w-full border border-line bg-bg px-3.5 text-[15px] outline-none placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary"
						/>
					</label>

					<label class="flex flex-col gap-2">
						<span class="font-mono text-[11px] tracking-[1.1px] text-muted">PESAN</span>
						<textarea
							name="pesan"
							required
							rows="5"
							placeholder="Tulis pesan kamu di sini"
							class="min-h-[120px] w-full border border-line bg-bg px-3.5 py-3 text-[15px] outline-none placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary"
						></textarea>
					</label>

					<button
						type="submit"
						disabled={status === 'loading'}
						class="flex h-12 items-center justify-center gap-2 border px-6 text-[15px] font-medium transition-colors {status ===
						'loading'
							? 'cursor-not-allowed border-line bg-surface text-muted'
							: 'cta border-transparent bg-primary text-on-primary'}"
					>
						{#if status === 'loading'}
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								class="animate-spin"
								aria-hidden="true"
							>
								<path d="M12 3a9 9 0 1 0 9 9" />
							</svg>
							Mengirim...
						{:else}
							Kirim pesan
						{/if}
					</button>

					{#if status !== 'idle'}
						<div class="flex items-center gap-3 border border-line px-4 py-3.5" role="status">
							{#if status === 'loading'}
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									class="animate-spin text-muted"
									aria-hidden="true"
								>
									<path d="M12 3a9 9 0 1 0 9 9" />
								</svg>
								<span class="text-sm text-muted">Mengirim pesan...</span>
							{:else if status === 'success'}
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-success"
									aria-hidden="true"
								>
									<path d="M20 6 9 17l-5-5" />
								</svg>
								<span class="text-sm text-success">Pesan terkirim. Terima kasih!</span>
							{:else}
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-danger"
									aria-hidden="true"
								>
									<circle cx="12" cy="12" r="9" />
									<path d="M12 8v5M12 16.5v.01" />
								</svg>
								<span class="text-sm text-danger">Gagal mengirim. Coba lagi.</span>
							{/if}
						</div>
					{/if}
				</form>
			</div>
		</div>
	</section>

	<!-- bab 04½: penutup — wordmark 3D berlapis yang berdiri saat masuk layar -->
	<footer
		class="relative overflow-hidden border-t border-line"
		{@attach scrolly((p, r) => {
			footP = p;
			mark(4, r);
		}, false)}
	>
		<div class="mx-auto flex max-w-[1440px] flex-col gap-10 px-6 pt-5 pb-10 lg:px-24">
			{@render label('[ 04 ] KONTAK', '↓')}

			<p
				class="shimmer mt-6 max-w-[1100px] text-[15vw] leading-[0.9] font-medium tracking-[-0.05em] lg:text-[136px]"
			>
				Mari membangun sesuatu.
			</p>

			<a
				href="mailto:zhrannr13@gmail.com"
				class="group/mail flex w-fit items-center gap-3 text-[22px] font-medium tracking-[-0.02em] text-primary lg:text-[40px]"
			>
				<span class="u-link">zhrannr13@gmail.com</span>
				{@render arrow(
					'h-6 w-6 transition-transform duration-500 group-hover/mail:rotate-45 lg:h-10 lg:w-10'
				)}
			</a>

			<div
				class="flex flex-col items-start gap-4 border-t border-line pt-6 font-mono text-[11px] tracking-[1.1px] text-muted lg:flex-row lg:items-center lg:justify-between lg:gap-6"
			>
				<span>© 2026 ZA.BRUH</span>
				<div class="flex items-center gap-6">
					<a href="#proyek" class="u-link hover:text-ink">PROYEK</a>
					<a href="https://github.com/nama-kamu" class="u-link hover:text-ink">GITHUB</a>
					<a href="mailto:zhrannr13@gmail.com" class="u-link hover:text-ink">EMAIL</a>
					<a href="#top" class="u-link text-ink">↑ ATAS</a>
				</div>
			</div>
		</div>

		<div class="pb-[3vw]" style="perspective: 900px" aria-hidden="true">
			<div
				class="stack grid place-items-center transform-3d"
				style:transform="rotateX({(1 - ease(footP)) * 75 + 8 - cursor.ny * 20}deg) rotateY({cursor.nx *
					30}deg)"
			>
				{#each layers as k (k)}
					<span
						class="layer text-[26vw] leading-[0.8] font-medium tracking-[-0.06em] whitespace-nowrap select-none"
						style:transform="translateZ({-k * 0.012}em)"
						style:color={k
							? `color-mix(in oklab, var(--primary), #000 ${k * 5}%)`
							: 'var(--primary)'}
					>
						za.bruh
					</span>
				{/each}
			</div>
		</div>
	</footer>
</div>

<style>
	@property --pct {
		syntax: '<integer>';
		inherits: false;
		initial-value: 0;
	}

	/* ---------- global kecil ---------- */
	:global(::selection) {
		background: var(--primary);
		color: var(--on-primary);
	}
	:global(html) {
		scroll-padding-top: 72px;
	}
	@media (prefers-reduced-motion: no-preference) {
		:global(html) {
			scroll-behavior: smooth;
		}
	}

	/* transisi tema: lingkaran dari tombol */
	:global(::view-transition-old(root)),
	:global(::view-transition-new(root)) {
		animation: none;
		mix-blend-mode: normal;
	}
	:global(::view-transition-new(root)) {
		animation: vt-reveal 0.8s cubic-bezier(0.7, 0, 0.2, 1);
	}
	@keyframes -global-vt-reveal {
		from {
			clip-path: circle(0 at var(--vt-x) var(--vt-y));
		}
		to {
			clip-path: circle(var(--vt-r) at var(--vt-x) var(--vt-y));
		}
	}

	/* ---------- tirai, grain, kursor, progres, penanda bab ---------- */
	.curtain {
		translate: 0 -100%;
		animation: lift 0.9s cubic-bezier(0.8, 0, 0.15, 1) 0.9s both;
	}
	.count {
		counter-reset: pct var(--pct);
		animation: count 0.8s cubic-bezier(0.5, 0, 0.2, 1) both;
	}
	.count::after {
		content: counter(pct) '%';
	}

	.grain {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
		opacity: 0.1;
		animation: grain 0.6s steps(1) infinite;
	}
	.dark .grain {
		opacity: 0.06;
	}

	.cursor {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 65;
		display: none;
		width: 16px;
		height: 16px;
		margin: -8px 0 0 -8px;
		border-radius: 50%;
		background: #fff;
		mix-blend-mode: difference;
		pointer-events: none;
		transition:
			translate 0.15s cubic-bezier(0.2, 0.8, 0.2, 1),
			scale 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.cursor.big {
		scale: 4;
	}
	@media (hover: hover) and (pointer: fine) {
		.cursor {
			display: block;
		}
	}

	.progress {
		display: none;
		transform-origin: 0 50%;
	}
	@supports (animation-timeline: scroll()) {
		.progress {
			display: block;
			animation: grow linear both;
			animation-timeline: scroll(root);
		}
	}

	.hud {
		color: #fff;
		mix-blend-mode: difference;
	}
	.hud li {
		opacity: 0.4;
		transition: opacity 0.3s;
	}
	.hud li::after {
		content: '';
		width: 10px;
		height: 1px;
		background: currentColor;
		transition: width 0.4s cubic-bezier(0.7, 0, 0.2, 1);
	}
	.hud li.on {
		opacity: 1;
	}
	.hud li.on::after {
		width: 40px;
	}

	/* ---------- tipografi ---------- */
	/* Geologica Variable punya kontur bertumpuk; isi warna latar di atas stroke 2x menutup sambungannya */
	.outline-text {
		color: var(--fill, var(--bg));
		-webkit-text-stroke: 3px var(--stroke, var(--ink));
		paint-order: stroke fill;
	}
	.group:hover .outline-text {
		--stroke: var(--on-primary);
		--fill: var(--primary);
	}

	.caret {
		animation: blink 1s steps(1) infinite;
	}
	.pulse {
		animation: pulse 1.8s ease-out infinite;
	}
	.bob {
		animation: bob 1.2s ease-in-out infinite;
	}

	.u-link {
		padding-bottom: 2px;
		background: linear-gradient(currentColor, currentColor) 0 100% / 0 1px no-repeat;
		transition:
			background-size 0.4s cubic-bezier(0.7, 0, 0.2, 1),
			color 0.3s;
	}
	.u-link:hover,
	a:hover > .u-link {
		background-size: 100% 1px;
	}

	/* ---------- panggung yang di-pin, tepat di bawah header ---------- */
	.page {
		--nav: 60px;
	}
	@media (width >= 64rem) {
		.page {
			--nav: 72px;
		}
	}
	.stage {
		position: sticky;
		top: var(--nav);
		height: calc(100dvh - var(--nav));
		overflow: hidden;
	}

	/* ---------- bab 00: hero ---------- */
	.hero::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(
			520px circle at var(--mx, 75%) var(--my, 30%),
			color-mix(in oklab, var(--primary) 16%, transparent),
			transparent 70%
		);
	}

	.sun-clip {
		position: absolute;
		inset: 0 0 45% 0;
		overflow: hidden;
		pointer-events: none;
	}
	.sun {
		position: absolute;
		bottom: 0;
		left: 50%;
		width: min(85vw, 640px);
		aspect-ratio: 1;
		translate: -50% 0;
		border-radius: 50%;
		background: linear-gradient(to bottom, var(--primary) 15%, transparent 95%);
		mask-image: repeating-linear-gradient(to bottom, #000 0 26px, transparent 26px 34px);
		opacity: 0.3;
	}

	.floor-wrap {
		position: absolute;
		right: -60%;
		bottom: 0;
		left: -60%;
		height: 220%;
		transform-origin: 50% 100%;
		pointer-events: none;
	}
	.floor {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(var(--primary) 2px, transparent 2px),
			linear-gradient(90deg, var(--primary) 2px, transparent 2px);
		background-size: 90px 90px;
		mask-image: linear-gradient(to top, #000 0%, transparent 60%);
		opacity: 0.5;
		animation: floor 1.6s linear infinite;
	}

	.char {
		transition: color 0.3s;
	}
	.char:hover {
		--fill: var(--primary);
		color: var(--primary);
	}
	.char-in {
		transform-origin: 50% 100%;
		animation: flip-up 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) both;
		animation-delay: calc(1.25s + var(--i) * 70ms);
	}

	.badge-spin {
		transform-origin: 100px 100px;
		animation: spin 16s linear infinite;
	}

	.cta {
		box-shadow: 5px 5px 0 var(--ink);
		transition:
			translate 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
			box-shadow 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.cta:hover {
		translate: -3px -3px;
		box-shadow: 8px 8px 0 var(--ink);
	}
	.cta-ghost {
		isolation: isolate;
		color: var(--ink);
		transition: color 0.5s;
	}
	.cta-ghost::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background: var(--ink);
		scale: 1 0;
		transform-origin: bottom;
		transition: scale 0.5s cubic-bezier(0.7, 0, 0.2, 1);
	}
	.cta-ghost:hover {
		color: var(--bg);
	}
	.cta-ghost:hover::before {
		scale: 1 1;
	}

	.roll {
		display: grid;
		height: 1.25em;
		overflow: hidden;
		line-height: 1.25;
	}
	.roll > span {
		grid-area: 1 / 1;
		transition: translate 0.5s cubic-bezier(0.7, 0, 0.2, 1);
	}
	.roll > span + span {
		translate: 0 110%;
	}
	a:hover .roll > span:first-child {
		translate: 0 -110%;
	}
	a:hover .roll > span + span {
		translate: 0 0;
	}

	.marquee {
		animation: slide 40s linear infinite;
	}
	.marquee-rev {
		animation-direction: reverse;
	}
	.tape:hover .marquee {
		animation-play-state: paused;
	}

	/* ---------- bab 01: kubus ---------- */
	.orbit {
		--s: min(58vw, 34vh, 360px);
	}
	.cube {
		position: relative;
		width: var(--s);
		height: var(--s);
		transform-style: preserve-3d;
	}
	.face {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: calc(var(--s) * 0.07);
		border: 1.5px solid var(--primary);
		backface-visibility: hidden;
	}
	.face-word {
		font-size: calc(var(--s) * 0.24);
		font-weight: 500;
		line-height: 0.9;
		letter-spacing: -0.04em;
	}
	.face-grid {
		background-image:
			linear-gradient(color-mix(in oklab, var(--primary) 25%, transparent) 1px, transparent 1px),
			linear-gradient(
				90deg,
				color-mix(in oklab, var(--primary) 25%, transparent) 1px,
				transparent 1px
			);
		background-size: calc(var(--s) / 8) calc(var(--s) / 8);
	}
	.face-top {
		background:
			repeating-linear-gradient(45deg, var(--primary) 0 2px, transparent 2px 14px), var(--bg);
	}

	.ring {
		position: absolute;
		top: 50%;
		left: 50%;
		width: calc(var(--s) * 1.75);
		aspect-ratio: 1;
		translate: -50% -50%;
		border: 1px dashed var(--primary);
		border-radius: 50%;
		pointer-events: none;
		animation: orbit 14s linear infinite;
	}
	.ring::after {
		content: '';
		position: absolute;
		top: -6px;
		left: calc(50% - 6px);
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--primary);
	}
	.ring-b {
		--tilt: 62deg;
		width: calc(var(--s) * 2.15);
		border-style: solid;
		opacity: 0.5;
		animation-duration: 24s;
		animation-direction: reverse;
	}

	.step {
		color: var(--muted);
		opacity: 0.3;
		filter: blur(1.5px);
		transition:
			opacity 0.5s,
			filter 0.5s,
			color 0.5s,
			translate 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.step.active {
		color: var(--ink);
		opacity: 1;
		filter: none;
		translate: 12px 0;
	}

	/* ---------- bab 02: lab ---------- */
	.scanlines {
		background: repeating-linear-gradient(to bottom, rgb(0 0 0 / 0.2) 0 1px, transparent 1px 3px);
		mix-blend-mode: multiply;
	}
	.corner {
		position: absolute;
		width: 22px;
		height: 22px;
		border-color: #fff;
		mix-blend-mode: difference;
	}

	/* ---------- bab 03: terowongan ---------- */
	.world > * {
		grid-area: 1 / 1;
	}
	.frame {
		width: 94vw;
		height: 80vh;
		border: 1px solid color-mix(in oklab, var(--primary) 45%, transparent);
		pointer-events: none;
	}
	.card {
		box-shadow: 0 60px 140px -60px var(--primary);
	}
	.wipe {
		transform: scaleX(0);
		transform-origin: right;
		transition: transform 0.6s cubic-bezier(0.7, 0, 0.2, 1);
	}
	.group:hover .wipe {
		transform: scaleX(1);
		transform-origin: left;
	}

	/* ---------- bab 04: kontak ---------- */
	.shimmer {
		color: transparent;
		background: linear-gradient(100deg, var(--ink) 40%, var(--primary) 50%, var(--ink) 60%) 0 0 /
			300% 100%;
		-webkit-background-clip: text;
		background-clip: text;
		animation: shimmer 6s linear infinite;
	}
	.stack > .layer {
		grid-area: 1 / 1;
	}

	/* Gerak dikurangi: bab tidak di-pin, semua 3D diratakan jadi tata letak biasa. */
	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			animation: none !important;
			transition: none !important;
		}
		.cursor,
		.progress,
		.fx {
			display: none !important;
		}
		.scrolly {
			height: auto !important;
		}
		.stage {
			position: relative !important;
			height: auto !important;
		}
		.stage *,
		.stack,
		.stack * {
			transform: none !important;
			opacity: 1 !important;
			visibility: visible !important;
		}
		.world {
			position: relative !important;
			display: flex !important;
			flex-direction: column;
			gap: 1.5rem;
			padding: 1.5rem;
		}
		.card {
			pointer-events: auto !important;
		}
		.step {
			filter: none !important;
		}
		.cube .face:not(:first-child),
		.stack .layer:not(:last-child) {
			display: none;
		}
	}

	/* ---------- keyframes ---------- */
	@keyframes lift {
		from {
			translate: 0 0;
		}
		to {
			translate: 0 -100%;
		}
	}
	@keyframes count {
		to {
			--pct: 100;
		}
	}
	@keyframes grain {
		0% {
			transform: translate(0, 0);
		}
		20% {
			transform: translate(-7%, 4%);
		}
		40% {
			transform: translate(5%, -6%);
		}
		60% {
			transform: translate(-3%, 8%);
		}
		80% {
			transform: translate(8%, -2%);
		}
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
	@keyframes pulse {
		from {
			box-shadow: 0 0 0 0 var(--success);
		}
		to {
			box-shadow: 0 0 0 8px transparent;
		}
	}
	@keyframes bob {
		50% {
			translate: 0 3px;
		}
	}
	@keyframes flip-up {
		from {
			opacity: 0;
			transform: perspective(600px) translateY(0.25em) rotateX(-100deg);
		}
		to {
			transform: perspective(600px) translateY(0) rotateX(0);
		}
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes floor {
		to {
			background-position: 0 90px;
		}
	}
	@keyframes orbit {
		from {
			transform: rotateX(var(--tilt, 76deg)) rotateZ(0deg);
		}
		to {
			transform: rotateX(var(--tilt, 76deg)) rotateZ(360deg);
		}
	}
	@keyframes slide {
		to {
			transform: translateX(-50%);
		}
	}
	@keyframes shimmer {
		from {
			background-position: 100% 0;
		}
	}
	@keyframes grow {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}
</style>
