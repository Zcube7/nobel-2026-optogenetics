/*
 * viz-neuron.js — Act III: the recording.
 *
 * Three stacked panels sharing one time axis, laid out the way a real figure
 * from this literature is laid out:
 *
 *   1. the light pulse train that was delivered
 *   2. the photocurrent channelrhodopsin-2 produced in response
 *   3. the membrane potential, with the action potentials it did or did not fire
 *
 * The trace is pre-computed by model.simulate() and then revealed left to
 * right, like a sweep on an oscilloscope. Drawing uses min/max binning per
 * pixel column: an action potential is about 1 ms wide and the sweep is over
 * a second, so naive sampling would miss spikes entirely between pixels.
 */

import { fit, loop, onResize, label, clamp } from './canvas.js';

const COL = {
  light: '77,166,255',
  current: '143,208,255',
  volt: '255,157,92',
  spike: '255,210,120',
  grid: 'rgba(255,255,255,.055)',
  dead: '108,118,137',
};

export function createNeuron(canvas, opts = {}) {
  let W = 0, H = 0, ctx = null;
  let res = null;              // latest simulate() result
  let sweep = 0;               // seconds of model time revealed so far
  let speed = 1 / 2.2;         // 1 s of model time takes 2.2 s on screen
  let playing = true;

  function setResult(r) {
    res = r;
    sweep = 0;
    playing = true;
  }

  function step(dt) {
    if (!res || !playing) return;
    sweep += dt * speed * 1000;                 // ms of model time
    if (sweep >= res.totalMs) {
      sweep = res.totalMs;
      playing = false;
      if (opts.onComplete) opts.onComplete(res);
    }
    if (opts.onProgress) opts.onProgress(sweep, res);
  }

  function replay() { if (res) { sweep = 0; playing = true; } }

  /* ----------------------------- drawing ----------------------------- */

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, W, H);
    if (!res) return;

    const padL = Math.max(44, W * 0.075);
    const padR = 14;
    const plotW = W - padL - padR;
    const topPad = 16, botPad = 26;
    const usable = H - topPad - botPad;

    // panel heights: light thin, current medium, voltage tallest
    const hL = usable * 0.12;
    const hI = usable * 0.26;
    const hV = usable * 0.52;
    const gap = usable * 0.05;
    const yL = topPad;
    const yI = yL + hL + gap;
    const yV = yI + hI + gap;

    const t2x = (t) => padL + (t / res.totalMs) * plotW;
    const revealX = t2x(sweep);

    drawTimeAxis(padL, plotW, yV + hV, botPad);
    drawLight(padL, plotW, yL, hL, t2x);
    drawCurrent(padL, plotW, yI, hI, t2x);
    drawVoltage(padL, plotW, yV, hV, t2x);

    // the sweep cursor
    if (playing && sweep > 0 && sweep < res.totalMs) {
      ctx.strokeStyle = 'rgba(255,255,255,.3)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(revealX, yL - 4); ctx.lineTo(revealX, yV + hV + 4); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.arc(revealX, yL - 7, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawTimeAxis(padL, plotW, yBase, botPad) {
    const y = yBase + 12;
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
    const stepMs = res.totalMs > 900 ? 250 : 100;
    for (let t = 0; t <= res.totalMs; t += stepMs) {
      const x = padL + (t / res.totalMs) * plotW;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 4); ctx.stroke();
      label(ctx, (t / 1000).toFixed(2).replace(/0$/, '') + 's', x, y + 7,
        { color: '#4a5467', size: 9, align: 'center', baseline: 'top' });
    }
  }

  function panelFrame(padL, plotW, y, h, title, colour) {
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y); ctx.lineTo(padL, y + h);
    ctx.stroke();
    label(ctx, title, padL - 7, y + 1, { color: colour, size: 9.5, align: 'right', baseline: 'top' });
  }

  function drawLight(padL, plotW, y, h, t2x) {
    panelFrame(padL, plotW, y, h, 'LIGHT', `rgba(${COL.light},.9)`);
    const pw = res.opts.pulseMs;
    for (const on of res.onsets) {
      if (on > sweep) break;
      const x0 = t2x(on);
      const x1 = t2x(Math.min(on + pw, sweep));
      if (x1 <= x0) continue;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, `rgba(${COL.light},.85)`);
      g.addColorStop(1, `rgba(${COL.light},.35)`);
      ctx.fillStyle = g;
      ctx.fillRect(x0, y + 1, Math.max(1.1, x1 - x0), h - 2);
    }
    const dutyTxt = `${res.opts.freqHz} Hz · ${pw} ms`;
    label(ctx, dutyTxt, padL + plotW, y + 1,
      { color: '#4a5467', size: 9, align: 'right', baseline: 'top' });
  }

  function drawCurrent(padL, plotW, y, h, t2x) {
    panelFrame(padL, plotW, y, h, 'CURRENT', `rgba(${COL.current},.9)`);
    // scale to the largest photocurrent this trial produced, with a floor so a
    // silent control cell does not get amplified into noise
    let peak = 0;
    for (let i = 0; i < res.I.length; i++) peak = Math.max(peak, -res.I[i]);
    const scale = Math.max(peak, 4);
    const base = y + 2;

    ctx.beginPath();
    let started = false;
    binned(padL, plotW, t2x, (x, lo, hi) => {
      // current is negative (inward); plot downward from the top of the panel
      const yl = base + (-lo / scale) * (h - 6);
      const yh = base + (-hi / scale) * (h - 6);
      if (!started) { ctx.moveTo(x, clamp(yl, y, y + h)); started = true; }
      ctx.lineTo(x, clamp(yl, y, y + h));
      ctx.lineTo(x, clamp(yh, y, y + h));
    }, res.I);
    ctx.strokeStyle = `rgba(${COL.current},.95)`;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Bottom-right, not top-right: the top of this panel is the zero line,
    // where the trace sits between pulses, so a label there lands on the data.
    // The deepest currents are at the start of the train, so the lower right
    // corner is reliably empty.
    if (peak > 0.5) {
      label(ctx, `peak ${peak.toFixed(1)} µA/cm²`, padL + plotW, y + h - 1,
        { color: '#4a5467', size: 9, align: 'right', baseline: 'bottom' });
    } else {
      label(ctx, 'no photocurrent', padL + plotW, y + h - 1,
        { color: `rgba(${COL.dead},.9)`, size: 9, align: 'right', baseline: 'bottom' });
    }
  }

  function drawVoltage(padL, plotW, y, h, t2x) {
    panelFrame(padL, plotW, y, h, 'Vm', `rgba(${COL.volt},.9)`);
    const vmin = -90, vmax = 45;
    const v2y = (v) => y + h - ((v - vmin) / (vmax - vmin)) * h;

    // reference lines: rest and the 0 mV spike-detection level
    for (const [v, txt, col] of [[-65, '−65 mV', 'rgba(255,255,255,.1)'], [0, '0', 'rgba(255,255,255,.07)']]) {
      const yy = v2y(v);
      ctx.strokeStyle = col;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(padL + plotW, yy); ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, txt, padL - 7, yy, { color: '#4a5467', size: 9, align: 'right', baseline: 'middle' });
    }

    ctx.beginPath();
    let started = false;
    binned(padL, plotW, t2x, (x, lo, hi) => {
      const yl = v2y(lo), yh = v2y(hi);
      if (!started) { ctx.moveTo(x, yl); started = true; }
      ctx.lineTo(x, yl);
      ctx.lineTo(x, yh);
    }, res.V);
    ctx.strokeStyle = `rgba(${COL.volt},.96)`;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // mark every action potential that has been revealed
    for (const s of res.spikes) {
      if (s > sweep) break;
      const x = t2x(s);
      ctx.fillStyle = `rgba(${COL.spike},.9)`;
      ctx.beginPath(); ctx.arc(x, y + 5, 2, 0, Math.PI * 2); ctx.fill();
    }

    if (res.spikes.length === 0 && sweep > res.totalMs * 0.4) {
      label(ctx, 'no action potentials', padL + plotW, y + 1,
        { color: `rgba(${COL.dead},.9)`, size: 9, align: 'right', baseline: 'top' });
    }
  }

  /**
   * Walk one pixel column at a time, giving the callback the min and max of the
   * samples that fall in it. Without this, 1 ms spikes vanish between pixels.
   */
  function binned(padL, plotW, t2x, emit, arr) {
    const n = res.t.length;
    if (!n) return;
    const maxX = Math.min(padL + plotW, t2x(sweep));
    let i = 0;
    for (let px = Math.floor(padL); px <= maxX; px++) {
      const tEnd = ((px + 1 - padL) / plotW) * res.totalMs;
      let lo = Infinity, hi = -Infinity, any = false;
      while (i < n && res.t[i] <= tEnd) {
        const v = arr[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
        any = true;
        i++;
      }
      if (!any) {
        const v = arr[Math.min(i, n - 1)];
        lo = hi = v;
      }
      emit(px, lo, hi);
    }
  }

  function resize() {
    // taller on narrow screens so the three panels stay legible
    const el = canvas.parentElement;
    const aspect = (el.clientWidth || 600) < 560 ? 1.05 : 2.15;
    const f = fit(canvas, aspect);
    ctx = f.ctx; W = f.w; H = f.h;
  }

  resize();
  onResize(canvas.parentElement, resize);
  loop((dt) => { step(dt); draw(); }, { visibleOnly: canvas });

  return {
    setResult,
    replay,
    get playing() { return playing; },
    get sweep() { return sweep; },
    get result() { return res; },
    /** Spikes that have been revealed so far — drives the Act IV whiskers. */
    spikesUpTo(t) {
      if (!res) return [];
      return res.spikes.filter((s) => s <= t);
    },
  };
}
