/*
 * canvas.js — shared canvas plumbing.
 *
 * Two things here are less obvious than they look:
 *
 * 1. requestAnimationFrame does not fire at all when the surrounding panel is
 *    hidden, and is throttled to a few Hz in a background tab. Anything that
 *    advances a simulation on frame count would freeze or crawl. So the loop
 *    races rAF against a setTimeout and steps on whichever arrives first, and
 *    every animation is driven by wall-clock dt rather than by frames.
 *
 * 2. Canvases are sized in CSS pixels but drawn in device pixels. fit() keeps
 *    the backing store matched to the element's real size and hands back a
 *    context already scaled, so all drawing code works in CSS pixels.
 */

/** Device-pixel-ratio-aware sizing. Returns {ctx, w, h} in CSS pixels. */
export function fit(canvas, aspect = 4 / 3, maxDpr = 2) {
  const parent = canvas.parentElement || canvas;
  const cssW = Math.max(1, Math.round(parent.clientWidth || canvas.clientWidth || 320));
  const cssH = Math.max(1, Math.round(cssW / aspect));
  const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
  const bw = Math.round(cssW * dpr);
  const bh = Math.round(cssH * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: cssW, h: cssH, dpr };
}

/**
 * Animation loop. fn(dt, t) gets seconds since the previous step and seconds
 * since the loop started. Returns a handle with stop()/start().
 *
 * `visibleOnly` pauses stepping while the element is scrolled out of view —
 * with half a dozen live canvases on one page that matters.
 */
export function loop(fn, { visibleOnly = null } = {}) {
  let stopped = false;
  let last = performance.now();
  const t0 = last;
  let visible = true;

  if (visibleOnly && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => { visible = entries[entries.length - 1].isIntersecting; },
      { rootMargin: '120px' }
    );
    io.observe(visibleOnly);
  }

  function step() {
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    // A long gap means the tab or panel was hidden. Don't let the simulation
    // teleport; take one ordinary step instead.
    if (dt > 0.25 || dt < 0) dt = 1 / 60;
    if (visible) fn(dt, (now - t0) / 1000);
    schedule();
  }

  function schedule() {
    if (stopped) return;
    let fired = false;
    const run = () => {
      if (fired) return;
      fired = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      step();
    };
    const raf = requestAnimationFrame(run);
    const timer = setTimeout(run, 60);   // fallback when rAF is asleep
  }

  schedule();
  return {
    stop() { stopped = true; },
    start() { if (stopped) { stopped = false; last = performance.now(); schedule(); } },
  };
}

/** Re-run fn when the element's width changes (debounced to the next frame). */
export function onResize(el, fn) {
  if ('ResizeObserver' in window) {
    // Start from the current width: every caller has just sized itself, and a
    // ResizeObserver always fires once on observe(). Starting from -1 made that
    // first call rebuild each canvas again for nothing (re-scattering the hero
    // field and the watching/driving cells a frame after they first appeared).
    let w = el.clientWidth, queued = false;
    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth;
      if (nw === w || queued) return;
      w = nw;
      queued = true;
      requestAnimationFrame(() => { queued = false; fn(); });
    });
    ro.observe(el);
    return;
  }
  window.addEventListener('resize', fn, { passive: true });
}

/* --------------------------- drawing helpers ---------------------------- */

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** A soft radial glow, used for light sources and spiking cells. */
export function glow(ctx, x, y, r, rgb, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(0.45, `rgba(${rgb},${alpha * 0.28})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Monospace label, used for axis ticks and in-canvas annotation. */
export function label(ctx, text, x, y, {
  color = '#6c7689', size = 10, align = 'left', baseline = 'alphabetic', weight = '',
} = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.trim();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Rounded rectangle path (Safari lacks roundRect in older versions). */
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, rr); return; }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Deterministic pseudo-random so layouts are stable across reloads. */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
