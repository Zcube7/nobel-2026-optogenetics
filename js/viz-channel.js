/*
 * viz-channel.js — Act II: channelrhodopsin-2 in a membrane.
 *
 * Top half: a cross-section of the cell membrane with the protein in it. When
 * light of a wavelength the opsin can absorb hits it, the pore opens and
 * positive ions fall inwards down their gradient.
 *
 * Bottom half: the photocurrent, plotted live. It is produced by the same
 * four-state photocycle used in Act III (js/model.js), integrated here in real
 * time rather than pre-computed — so the characteristic shape appears on its
 * own: a sharp peak as every available channel opens at once, then a sag to a
 * lower plateau as part of the population slips into the light-adapted closed
 * state, then a slow recovery in the dark.
 */

import { fit, loop, onResize, glow, label, clamp, roundRect, rng } from './canvas.js';
import { CHR2, actionSpectrum, wavelengthToRGB } from './model.js';

export function createChannel(canvas, opts = {}) {
  let W = 0, H = 0, ctx = null;
  let nm = 470;
  let on = true;

  // photocycle state
  let C1 = 1, O1 = 0, O2 = 0, C2 = 0;
  const HIST = 260;                       // samples in the trace
  const hist = new Float32Array(HIST);
  let histT = 0;
  /*
   * Model-milliseconds per second of wall clock, and wall-seconds per trace
   * sample. These two have to be chosen together.
   *
   * At real speed the whole transient — rise, peak, sag to plateau — is over in
   * well under 100 ms, which is one or two trace samples: the viewer sees a
   * flat line and learns nothing. Running the channel at 1/20 speed with a
   * ~1.2 ms sampling interval puts the peak about four samples in and spreads
   * the decay across half the window, which is what the published photocurrent
   * traces actually look like. The axis is labelled with real channel time so
   * the slowdown cannot be mistaken for the real kinetics.
   */
  const TIME_SCALE = 50;
  const SAMPLE = 0.023;
  let acc = 0;

  const ions = [];
  const rand = rng(470);

  function open() { return O1 + CHR2.gamma * O2; }

  /**
   * Put the protein back in its dark-adapted ground state — what actually
   * happens if you leave it in the dark for a few seconds. Lets the viewer
   * replay the peak-then-plateau transient instead of only ever arriving to
   * find it already settled.
   */
  function darkAdapt() {
    C1 = 1; O1 = 0; O2 = 0; C2 = 0;
    hist.fill(0);
    histT = 0;
    acc = 0;
    ions.length = 0;
    // Hold the light off for a moment first. Without this baseline the rise is
    // pinned to the left edge of the plot and reads as no rise at all — the
    // same reason a real recording is always shown with some pre-stimulus
    // trace in front of it.
    preRollMs = 25;
  }
  let preRollMs = 0;

  function step(dt) {
    const dark = preRollMs > 0;
    const eff = on && !dark ? actionSpectrum(nm) : 0;
    const p1 = eff * CHR2.eps1 * CHR2.LIGHT_K;
    const p2 = eff * CHR2.eps2 * CHR2.LIGHT_K;

    // integrate the photocycle in model-milliseconds
    let ms = Math.min(dt, 0.1) * TIME_SCALE;
    if (dark) preRollMs -= ms;
    const h = 0.05;
    while (ms > 0) {
      const s = Math.min(h, ms);
      const dC1 = -p1 * C1 + CHR2.Gd1 * O1 + CHR2.Gr * C2;
      const dO1 = p1 * C1 - (CHR2.Gd1 + CHR2.e12) * O1 + CHR2.e21 * O2;
      const dO2 = p2 * C2 + CHR2.e12 * O1 - (CHR2.e21 + CHR2.Gd2) * O2;
      const dC2 = CHR2.Gd2 * O2 - (p2 + CHR2.Gr) * C2;
      C1 += dC1 * s; O1 += dO1 * s; O2 += dO2 * s; C2 += dC2 * s;
      ms -= s;
    }

    acc += dt;
    while (acc >= SAMPLE) {
      acc -= SAMPLE;
      hist[histT % HIST] = open();
      histT++;
    }

    // ions: spawned at a rate set by how open the channel is
    const o = open();
    if (o > 0.01 && rand() < o * dt * 70) {
      ions.push({ p: 0, v: 0.55 + rand() * 0.5, off: (rand() - 0.5) * 0.9, kind: rand() });
    }
    for (let i = ions.length - 1; i >= 0; i--) {
      ions[i].p += ions[i].v * dt;
      if (ions[i].p > 1.25) ions.splice(i, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, W, H);

    const memY = H * 0.40;                 // membrane centre line
    const memH = Math.max(30, H * 0.135);  // bilayer thickness
    const cx = W * 0.5;
    const lit = on && preRollMs <= 0;
    const eff = lit ? actionSpectrum(nm) : 0;
    const [r, g, b] = wavelengthToRGB(nm);
    const rgb = `${r},${g},${b}`;
    const o = open();

    // --- outside / inside wash -------------------------------------------
    ctx.fillStyle = 'rgba(30,45,70,.35)';
    ctx.fillRect(0, 0, W, memY - memH / 2);
    const ing = ctx.createLinearGradient(0, memY + memH / 2, 0, H * 0.72);
    ing.addColorStop(0, 'rgba(70,35,45,.45)');
    ing.addColorStop(1, 'rgba(70,35,45,0)');
    ctx.fillStyle = ing;
    ctx.fillRect(0, memY + memH / 2, W, H * 0.72 - (memY + memH / 2));

    // --- the light beam ---------------------------------------------------
    if (lit) {
      const beamW = W * 0.34;
      const bg = ctx.createLinearGradient(0, 0, 0, memY);
      bg.addColorStop(0, `rgba(${rgb},${0.02 + 0.16 * (0.35 + eff * 0.65)})`);
      bg.addColorStop(1, `rgba(${rgb},${0.05 + 0.3 * (0.35 + eff * 0.65)})`);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(cx - beamW * 0.34, 0);
      ctx.lineTo(cx + beamW * 0.34, 0);
      ctx.lineTo(cx + beamW * 0.5, memY);
      ctx.lineTo(cx - beamW * 0.5, memY);
      ctx.closePath();
      ctx.fill();
    }

    // --- the bilayer ------------------------------------------------------
    const top = memY - memH / 2, bot = memY + memH / 2;
    ctx.fillStyle = 'rgba(190,200,215,.10)';
    ctx.fillRect(0, top, W, memH);
    ctx.strokeStyle = 'rgba(190,200,215,.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(W, top); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, bot); ctx.lineTo(W, bot); ctx.stroke();

    // phospholipid heads
    const spacing = 11;
    const poreHalf = Math.max(30, W * 0.085);
    for (let x = spacing / 2; x < W; x += spacing) {
      if (Math.abs(x - cx) < poreHalf + 7) continue;
      for (const [y, dir] of [[top + 3.2, 1], [bot - 3.2, -1]]) {
        ctx.fillStyle = 'rgba(190,205,225,.3)';
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(190,205,225,.13)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + dir * 3);
        ctx.lineTo(x + 1.1, y + dir * (memH / 2 - 3));
        ctx.stroke();
      }
    }

    // --- the protein ------------------------------------------------------
    drawProtein(cx, memY, memH, poreHalf, o, rgb, eff);

    // --- ions -------------------------------------------------------------
    // Set once: assigning ctx.font re-parses the font string every time.
    ctx.font = '7px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const ion of ions) {
      const t = ion.p;
      const y = top - memH * 0.9 + t * (memH * 2.5);
      const squeeze = t > 0.3 && t < 0.72 ? 0.25 : 1;
      const x = cx + ion.off * poreHalf * (1.9 - 1.3 * (1 - squeeze));
      const a = t < 0.08 ? t / 0.08 : t > 1.05 ? Math.max(0, (1.25 - t) / 0.2) : 1;
      ctx.fillStyle = `rgba(255,120,120,${0.85 * a})`;
      ctx.beginPath(); ctx.arc(x, y, 2.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
      ctx.fillText('+', x, y + 0.4);
    }

    label(ctx, 'OUTSIDE', 10, 15, { color: 'rgba(160,180,210,.65)', size: 9.5, baseline: 'top' });
    label(ctx, 'INSIDE (cytoplasm)', 10, bot + 9, { color: 'rgba(210,160,170,.6)', size: 9.5, baseline: 'top' });

    const stateTxt = preRollMs > 0 ? 'dark-adapted — waiting'
      : !on ? 'dark — channel shut'
      : eff < 0.06 ? 'wrong colour — the opsin cannot absorb this'
      : o > 0.25 ? 'open — cations flowing in'
      : o > 0.05 ? 'partly open' : 'shut';
    label(ctx, stateTxt, cx, top - memH * 1.35, {
      color: eff < 0.06 && on ? '#ff8f6b' : o > 0.25 ? '#8fd0ff' : '#a7b0c0',
      size: 11, align: 'center', baseline: 'bottom',
    });

    drawTrace(H * 0.74, H * 0.26, rgb, eff);
  }

  /** Seven-helix bundle, opening as `o` rises. */
  function drawProtein(cx, memY, memH, half, o, rgb, eff) {
    const top = memY - memH / 2;
    const gap = 1.2 + o * 5.2;             // pore half-width
    ctx.save();

    if (o > 0.02) {
      glow(ctx, cx, memY, 34 + o * 26, rgb, 0.1 + o * 0.3);
    }

    for (const side of [-1, 1]) {
      const x0 = cx + side * (gap + 1);
      const x1 = cx + side * half;
      const grad = ctx.createLinearGradient(x0, 0, x1, 0);
      grad.addColorStop(0, `rgba(${rgb},${0.22 + o * 0.4})`);
      grad.addColorStop(1, 'rgba(96,126,170,.72)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = `rgba(150,185,235,${0.5 + o * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      // flared at both mouths, narrow in the middle
      ctx.moveTo(x0 - side * 2.5, top - 5);
      ctx.lineTo(x1 + side * 3.5, top - 5);
      ctx.lineTo(x1, memY + memH / 2 + 5);
      ctx.lineTo(x0 - side * 1.0, memY + memH / 2 + 5);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    // retinal, the light-catching cofactor, sits in the middle
    const rr = 0.55 + eff * 0.45;
    ctx.strokeStyle = `rgba(255,${Math.round(150 + 60 * eff)},90,${rr})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const ry = memY + 1;
    if (o > 0.15) {                        // all-trans: straightened
      ctx.moveTo(cx - 7, ry - 3); ctx.lineTo(cx - 2, ry + 1); ctx.lineTo(cx + 3, ry - 2); ctx.lineTo(cx + 8, ry + 2);
    } else {                               // 13-cis: kinked
      ctx.moveTo(cx - 7, ry - 2); ctx.lineTo(cx - 2, ry + 2); ctx.lineTo(cx + 1, ry - 3); ctx.lineTo(cx + 7, ry - 1);
    }
    ctx.stroke();
    ctx.restore();

    label(ctx, 'retinal', cx + half + 9, memY + 3, { color: 'rgba(255,170,110,.8)', size: 9 });
  }

  /** Width of `text` as label() would draw it. */
  function textW(text, size) {
    ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    return ctx.measureText(text).width;
  }

  /**
   * Lay the footer captions out in as few rows as fit the plot width: all
   * three on one line on a wide canvas, the centre one dropped to its own line
   * when that would collide, and one per line on the narrowest phones. Fixed
   * positions put all three on top of each other below about 480 px.
   */
  function footerRows(items, x0, w) {
    const gap = 12;
    const [L, C, R] = items.map((it) => ({ ...it, w: textW(it.text, it.size) }));
    const mid = x0 + w / 2;
    if (mid - C.w / 2 >= x0 + L.w + gap && mid + C.w / 2 <= x0 + w - R.w - gap) {
      return [[{ ...L, x: x0, align: 'left' }, { ...C, x: mid, align: 'center' }, { ...R, x: x0 + w, align: 'right' }]];
    }
    if (L.w + R.w + gap <= w) {
      return [
        [{ ...L, x: x0, align: 'left' }, { ...R, x: x0 + w, align: 'right' }],
        [{ ...C, x: C.w <= w ? mid : x0, align: C.w <= w ? 'center' : 'left' }],
      ];
    }
    return [L, R, C].map((it) => [{ ...it, x: x0, align: 'left' }]);
  }

  /** Photocurrent trace. Downward is inward current, as in the literature. */
  function drawTrace(y0, h, rgb, eff) {
    const axisSize = 9;
    const padL = Math.max(42, Math.ceil(textW('current', axisSize)) + 12), padR = 12;
    const w = W - padL - padR;
    const maxI = 1.0;

    // Footer captions first, so the plot gets whatever height is left.
    const spanMs = Math.round(HIST * SAMPLE * TIME_SCALE);
    const ROW = 13;
    const rows = footerRows([
      { text: `absorption at ${nm} nm: ${Math.round(actionSpectrum(nm) * 100)}%`, size: 9.5,
        color: eff < 0.06 ? '#ff8f6b' : '#6c7689' },
      // Say what the axis really is: well under a second of channel time,
      // replayed far slower than real speed.
      { text: `${spanMs} ms of channel time, slowed ~${Math.round(1000 / TIME_SCALE)}×`, size: 9,
        color: '#4a5467' },
      { text: `channels open ${Math.round(open() * 100)}%`, size: 9.5, color: '#6c7689' },
    ], padL, w);
    const footTop = H - rows.length * ROW - 4;
    // Keep the plot at least MIN_PLOT tall: when the captions take two or three
    // lines on a phone, start the trace higher (the strip above it is empty —
    // the ions have faded out by then) rather than squash it to a sliver.
    const MIN_PLOT = 56;
    const base = Math.min(y0, footTop - 6 - MIN_PLOT - 6) + 6;
    const plotH = footTop - 6 - base;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, base); ctx.lineTo(padL + w, base); ctx.stroke();
    label(ctx, '0', padL - 6, base, { color: '#4a5467', size: axisSize, align: 'right', baseline: 'middle' });
    label(ctx, 'inward', padL - 6, base + plotH - 12, { color: '#4a5467', size: axisSize, align: 'right', baseline: 'middle' });
    label(ctx, 'current', padL - 6, base + plotH - 2, { color: '#4a5467', size: axisSize, align: 'right', baseline: 'middle' });

    ctx.beginPath();
    const n = Math.min(histT, HIST);
    for (let i = 0; i < n; i++) {
      const idx = (histT - n + i) % HIST;
      const v = hist[(idx + HIST) % HIST];
      const x = padL + (i / (HIST - 1)) * w;
      const yy = base + (v / maxI) * plotH;
      if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.strokeStyle = `rgba(${rgb},.95)`;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // fill under the curve — closed at the last sample, not at the right edge:
    // right after a dark-adapt the trace only reaches part way across, and
    // closing at the edge drew a stray triangle over the empty part.
    if (n > 1) {
      ctx.lineTo(padL + ((n - 1) / (HIST - 1)) * w, base);
      ctx.lineTo(padL, base);
      ctx.closePath();
      ctx.fillStyle = `rgba(${rgb},.12)`;
      ctx.fill();
    }

    // Annotate the two features that matter: the peak, where every available
    // channel is open at once, and the plateau it sags to as part of the
    // population slips into the light-adapted closed state.
    if (n > 20) {
      let pk = 0, pkI = 0;
      for (let i = 0; i < n; i++) {
        const v = hist[((histT - n + i) % HIST + HIST) % HIST];
        if (v > pk) { pk = v; pkI = i; }
      }
      const nowV = hist[((histT - 1) % HIST + HIST) % HIST];
      if (pk > nowV * 1.25 && pk > 0.1) {
        const px = padL + (pkI / (HIST - 1)) * w;
        const py = base + (pk / maxI) * plotH;
        // Beside the trough rather than under it: a near-full peak sits on the
        // floor of the plot, and a label hung below it landed in the captions.
        // Right of the trough is empty, because the trace sags back up there.
        const right = px < padL + w * 0.72;
        const dir = right ? 1 : -1;
        ctx.strokeStyle = 'rgba(255,255,255,.28)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px + dir * 3, py); ctx.lineTo(px + dir * 10, py); ctx.stroke();
        label(ctx, `peak ${Math.round(pk * 100)}%`, px + dir * 13, Math.min(py, base + plotH - 5),
          { color: 'rgba(255,255,255,.7)', size: 9, baseline: 'middle', align: right ? 'left' : 'right' });

        const ly = base + (nowV / maxI) * plotH;
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(padL + w, ly); ctx.stroke();
        ctx.setLineDash([]);
        label(ctx, `plateau ${Math.round(nowV * 100)}%`, padL + w - 4, ly - 5,
          { color: 'rgba(255,255,255,.5)', size: 9, align: 'right', baseline: 'bottom' });
      }
    }

    rows.forEach((row, r) => {
      for (const it of row) {
        label(ctx, it.text, it.x, footTop + (r + 1) * ROW - 3,
          { color: it.color, size: it.size, align: it.align });
      }
    });
    ctx.restore();
  }

  function resize() {
    // Squarer on a phone: the footer captions need a second line there, and
    // the trace would otherwise be squeezed to a sliver.
    const el = canvas.parentElement;
    const f = fit(canvas, (el.clientWidth || 600) < 480 ? 1 : 4 / 3.2);
    ctx = f.ctx; W = f.w; H = f.h;
  }

  resize();
  onResize(canvas.parentElement, resize);
  loop((dt) => { step(dt); draw(); }, { visibleOnly: canvas });

  return {
    setWavelength(v) { nm = v; },
    setOn(v) { on = v; },
    darkAdapt,
    get open() { return open(); },
    /** Trace buffer in draw order — used by tests/checks, not by the page. */
    get trace() {
      const n = Math.min(histT, HIST);
      const out = [];
      for (let i = 0; i < n; i++) out.push(hist[((histT - n + i) % HIST + HIST) % HIST]);
      return out;
    },
    get efficiency() { return actionSpectrum(nm); },
  };
}
