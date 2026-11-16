/*
 * viz-dish.js — Act I: Chlamydomonas swimming towards the light.
 *
 * Each cell swims forward and rotates about its own long axis. The eyespot
 * sits on the side, so as the cell rolls it sweeps the surroundings and sees
 * the lamp brighten and dim once per turn. Comparing light across that sweep
 * is how the real alga works out which way to steer — it has no second eye to
 * compare with, only itself a moment earlier.
 *
 * The model here keeps that idea: a cell measures what its eyespot sees, and
 * turns toward the heading that was brightest during its last roll. The result
 * is the slightly wobbly, spiralling approach the real organisms show, rather
 * than dots sliding along straight lines.
 */

import { fit, loop, onResize, glow, label, clamp, rng } from './canvas.js';

const ALGA = '95,201,138';
const EYE = '255,150,60';

export function createDish(canvas, opts = {}) {
  const hud = opts.hud || null;
  let W = 0, H = 0, ctx = null;
  let cells = [];
  let lamp = { x: 0.88, y: 0.5 };      // normalised to the canvas box
  let lampOn = true;
  let count = opts.count || 220;
  const rand = rng(20261005);

  // one cell is drawn magnified in the inset so the anatomy is visible
  const inset = { r: 0, cx: 0, cy: 0, roll: 0 };

  function dish() {
    const cx = W * 0.47, cy = H * 0.5;
    const r = Math.min(W * 0.43, H * 0.45);
    return { cx, cy, r };
  }

  function spawn() {
    const { cx, cy, r } = dish();
    cells = [];
    for (let i = 0; i < count; i++) {
      // uniform over the disc
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * r * 0.93;
      cells.push({
        x: cx + Math.cos(a) * rr,
        y: cy + Math.sin(a) * rr,
        th: rand() * Math.PI * 2,
        roll: rand() * Math.PI * 2,
        rollRate: 1.6 + rand() * 1.1,        // revolutions-ish per second
        speed: 16 + rand() * 12,             // px/s
        best: 0,                             // brightest reading this roll
        bestTh: 0,                           // heading at that moment
        wob: rand() * Math.PI * 2,
        // Cells in a real population are not equally phototactic: some steer
        // hard toward the light, some barely bother. Without that spread the
        // whole population collapses into a single point at the lit edge,
        // which is not what a dish of Chlamydomonas looks like.
        sens: 0.25 + rand() * rand() * 1.5,
      });
    }
  }

  function lampXY() {
    return { x: lamp.x * W, y: lamp.y * H };
  }

  /** What the eyespot sees: how squarely it faces the lamp, times falloff. */
  function sense(c, L) {
    if (!lampOn) return 0;
    const dx = L.x - c.x, dy = L.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const toLamp = Math.atan2(dy, dx);
    // the eyespot points sideways from the swimming axis and sweeps as it rolls
    const eyeDir = c.th + Math.PI / 2 + Math.sin(c.roll) * 1.5;
    const facing = Math.cos(eyeDir - toLamp);
    const shade = clamp(1 - d / (Math.max(W, H) * 1.15), 0.08, 1);
    return Math.max(0, facing) * shade;
  }

  function step(dt) {
    const { cx, cy, r } = dish();
    const L = lampXY();
    for (const c of cells) {
      c.roll += c.rollRate * dt * Math.PI * 2;
      const s = sense(c, L);

      // remember the brightest heading seen during this roll
      if (s > c.best) { c.best = s; c.bestTh = Math.atan2(L.y - c.y, L.x - c.x); }

      // once per roll, commit: turn toward that heading, then forget
      if (c.roll > Math.PI * 2) {
        c.roll -= Math.PI * 2;
        if (c.best > 0.02) {
          let diff = c.bestTh - c.th;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          c.th += diff * clamp(c.best * 0.62 * c.sens, 0, 0.34);
        }
        c.best *= 0.25;
      }

      // Rotational diffusion. Scaled by sqrt(dt), not dt, because a random
      // walk's spread grows with the square root of time — getting this wrong
      // makes the noise frame-rate dependent and lets the attraction win.
      const D = lampOn ? 1.0 : 2.6;          // rad^2 per second
      c.th += (rand() - 0.5) * 3.46 * Math.sqrt(2 * D * dt);
      c.wob += dt * 7;

      const sp = c.speed * (lampOn ? 1 : 0.65);
      c.x += Math.cos(c.th) * sp * dt + Math.cos(c.wob) * 3 * dt;
      c.y += Math.sin(c.th) * sp * dt + Math.sin(c.wob) * 3 * dt;

      // keep them inside the dish: turn back rather than bounce off hard
      const dx = c.x - cx, dy = c.y - cy;
      const d = Math.hypot(dx, dy);
      if (d > r * 0.94) {
        const inward = Math.atan2(-dy, -dx);
        let diff = inward - c.th;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        c.th += diff * 0.22;
        const k = (r * 0.94) / d;
        c.x = cx + dx * k;
        c.y = cy + dy * k;
      }
    }
    inset.roll += dt * 2.0 * Math.PI * 2;
  }

  /** Fraction of cells in the half of the dish nearest the lamp. */
  function nearFraction() {
    const { cx, cy } = dish();
    const L = lampXY();
    const ax = L.x - cx, ay = L.y - cy;
    const n = Math.hypot(ax, ay) || 1;
    let near = 0;
    for (const c of cells) {
      if (((c.x - cx) * ax + (c.y - cy) * ay) / n > 0) near++;
    }
    return cells.length ? near / cells.length : 0;
  }

  function draw() {
    const { cx, cy, r } = dish();
    const L = lampXY();

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, W, H);

    // --- the lamp and its wash across the dish ---------------------------
    if (lampOn) {
      glow(ctx, L.x, L.y, Math.max(W, H) * 0.78, '255,238,190', 0.17);
      glow(ctx, L.x, L.y, 26, '255,245,210', 0.95);
      ctx.fillStyle = '#fff6da';
      ctx.beginPath(); ctx.arc(L.x, L.y, 7, 0, Math.PI * 2); ctx.fill();
    }

    // --- the dish --------------------------------------------------------
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = lampOn ? 'rgba(14,22,20,.92)' : 'rgba(11,15,20,.95)';
    ctx.fill();
    ctx.clip();

    // a faint gradient so the lit side of the dish reads as lit
    if (lampOn) {
      const g = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      const t = clamp((L.x - (cx - r)) / (2 * r), 0, 1);
      g.addColorStop(0, `rgba(255,236,180,${0.012 + 0.03 * (1 - t)})`);
      g.addColorStop(1, `rgba(255,236,180,${0.012 + 0.03 * t})`);
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    // --- the algae -------------------------------------------------------
    ctx.globalCompositeOperation = 'lighter';
    for (const c of cells) {
      const s = sense(c, L);
      const a = 0.42 + s * 0.5;
      ctx.fillStyle = `rgba(${ALGA},${a})`;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 2.5, 1.9, c.th, 0, Math.PI * 2);
      ctx.fill();
      // the eyespot catches the light as it sweeps past
      if (s > 0.45) {
        ctx.fillStyle = `rgba(${EYE},${(s - 0.45) * 1.5})`;
        ctx.beginPath(); ctx.arc(c.x, c.y, 1.15, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // dish rim
    ctx.strokeStyle = 'rgba(160,180,200,.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,180,200,.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r - 4, 0, Math.PI * 2); ctx.stroke();

    drawInset();

    if (hud) {
      const pct = Math.round(nearFraction() * 100);
      hud.textContent = lampOn
        ? `${pct}% of cells on the lit side`
        : 'lamp off — swimming at random';
    }
  }

  /** Magnified schematic of a single cell, bottom-left. */
  function drawInset() {
    const r = Math.min(54, W * 0.13);
    const cx = r + 14, cy = H - r - 14;
    inset.r = r; inset.cx = cx; inset.cy = cy;

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(5,7,12,.88)'; ctx.fill();
    ctx.strokeStyle = 'rgba(100,120,140,.3)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.clip();

    const bodyR = r * 0.44;
    // eyespot angle sweeps as the cell rolls; it is "lit" when facing right
    const ang = inset.roll % (Math.PI * 2);
    const facing = Math.max(0, Math.cos(ang));
    const lit = lampOn ? facing : 0;

    // flagella
    ctx.strokeStyle = 'rgba(150,210,175,.75)';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    const beat = Math.sin(inset.roll * 2.2) * 0.35;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx - bodyR * 0.75, cy + sgn * bodyR * 0.25);
      ctx.quadraticCurveTo(
        cx - bodyR * 1.9, cy + sgn * (bodyR * 0.8 + beat * 10),
        cx - bodyR * 2.6, cy + sgn * (bodyR * 0.45 - beat * 14)
      );
      ctx.stroke();
    }

    // cell body
    const bg = ctx.createRadialGradient(cx - bodyR * 0.3, cy - bodyR * 0.35, bodyR * 0.1, cx, cy, bodyR);
    bg.addColorStop(0, 'rgba(130,225,165,.95)');
    bg.addColorStop(1, 'rgba(46,120,80,.95)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(cx, cy, bodyR, bodyR * 0.82, 0, 0, Math.PI * 2); ctx.fill();

    // eyespot: rides around the body as it rolls
    const ex = cx + Math.cos(ang) * bodyR * 0.72;
    const ey = cy + Math.sin(ang) * bodyR * 0.42;
    if (lit > 0.05) glow(ctx, ex, ey, 11, EYE, lit * 0.85);
    ctx.fillStyle = `rgba(${EYE},${0.55 + lit * 0.45})`;
    ctx.beginPath(); ctx.ellipse(ex, ey, 3.1, 2.4, 0, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    label(ctx, 'eyespot', cx + r + 8, cy - 4, { color: 'rgba(255,150,60,.85)', size: 9.5 });
    label(ctx, lampOn && Math.cos(ang) > 0.35 ? 'sees light' : 'in shadow',
      cx + r + 8, cy + 8, { color: '#6c7689', size: 9.5 });
  }

  function resize() {
    const f = fit(canvas, 4 / 3);
    ctx = f.ctx;
    const first = W === 0;
    const oldW = W, oldH = H;
    W = f.w; H = f.h;
    if (first) spawn();
    else if (oldW > 0) {
      const sx = W / oldW, sy = H / oldH;
      for (const c of cells) { c.x *= sx; c.y *= sy; }
    }
  }

  // --- pointer: move the lamp -------------------------------------------
  function pointer(ev) {
    const rect = canvas.getBoundingClientRect();
    const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
    const py = (ev.touches ? ev.touches[0].clientY : ev.clientY) - rect.top;
    lamp.x = clamp(px / rect.width, 0.03, 0.97);
    lamp.y = clamp(py / rect.height, 0.03, 0.97);
    lampOn = true;
    if (opts.onLampMove) opts.onLampMove();
  }
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); pointer(e); });
  canvas.style.touchAction = 'manipulation';
  canvas.style.cursor = 'crosshair';

  resize();
  onResize(canvas.parentElement, resize);
  loop((dt) => { step(dt); draw(); }, { visibleOnly: canvas });

  return {
    setLight(on) { lampOn = on; },
    setCount(n) { count = n; spawn(); },
    scatter() { spawn(); },
    get count() { return count; },
  };
}
