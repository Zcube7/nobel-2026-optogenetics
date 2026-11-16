/*
 * viz-mouse.js — Act IV: the in vivo experiment, schematically.
 *
 * A head in profile, an optical fibre entering the motor cortex through a small
 * hole in the skull, and whiskers that deflect when the simulated neurons fire.
 * The spike train comes from Act III, so whatever the user did to the cell
 * there — drove it too fast, gave it too little opsin — shows up here as
 * whiskers that stop moving.
 *
 * Deliberately schematic: this is an explanatory diagram, not an anatomy plate.
 */

import { fit, loop, onResize, glow, label, clamp } from './canvas.js';

export function createMouse(canvas, opts = {}) {
  let W = 0, H = 0, ctx = null;
  let res = null;
  let t = 0;                    // model-ms along the train
  let playing = false;
  const speed = 1 / 2.2;        // matches the Act III sweep
  let lastSpikeIdx = 0;
  let whiskerKick = 0;          // decays after each spike
  let lightOn = 0;

  function setResult(r) { res = r; reset(); }
  function reset() { t = 0; lastSpikeIdx = 0; whiskerKick = 0; lightOn = 0; }
  function play() { if (!res) return; reset(); playing = true; }
  function stop() { playing = false; }

  function step(dt) {
    whiskerKick *= Math.exp(-dt * 7);
    lightOn *= Math.exp(-dt * 16);
    if (!res || !playing) return;

    const prev = t;
    t += dt * speed * 1000;

    // any light pulse in this interval?
    const pw = res.opts.pulseMs;
    for (const on of res.onsets) {
      if (on > t) break;
      if (on + pw > prev && on <= t) { lightOn = 1; break; }
    }
    // any spike?
    while (lastSpikeIdx < res.spikes.length && res.spikes[lastSpikeIdx] <= t) {
      whiskerKick = 1;
      lastSpikeIdx++;
    }

    if (t >= res.totalMs) {
      playing = false;
      t = res.totalMs;
      if (opts.onEnd) opts.onEnd();
    }
    if (opts.onTick) opts.onTick(t, lastSpikeIdx, res);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, W, H);

    // Fit the drawing to the box with room for the whisker labels on the left
    // and the body trailing off to the right.
    const S = Math.min(W / 400, H / 250);
    const ox = W * 0.45, oy = H * 0.56;
    const px = (x) => ox + x * S;
    const py = (y) => oy + y * S;

    // ---------------- head in profile, nose to the left ----------------
    ctx.save();

    // The body continues out of frame. Fade it out rather than letting a hard
    // ellipse edge get clipped by the canvas border, which reads as a mistake.
    const bodyG = ctx.createLinearGradient(px(40), 0, px(190), 0);
    bodyG.addColorStop(0, 'rgba(150,150,160,.13)');
    bodyG.addColorStop(1, 'rgba(150,150,160,0)');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.ellipse(px(110), py(40), 105 * S, 60 * S, 0, 0, Math.PI * 2);
    ctx.fill();

    // skull/head outline
    const headGrad = ctx.createLinearGradient(px(-110), py(-70), px(70), py(60));
    headGrad.addColorStop(0, 'rgba(196,196,206,.26)');
    headGrad.addColorStop(1, 'rgba(120,120,135,.2)');
    ctx.fillStyle = headGrad;
    ctx.strokeStyle = 'rgba(205,212,228,.6)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px(-112), py(10));                             // nose tip
    ctx.quadraticCurveTo(px(-104), py(-16), px(-70), py(-28)); // bridge
    ctx.quadraticCurveTo(px(-20), py(-50), px(30), py(-40));   // skull dome
    ctx.quadraticCurveTo(px(74), py(-30), px(86), py(2));      // back of head
    ctx.quadraticCurveTo(px(92), py(34), px(56), py(44));      // neck
    ctx.quadraticCurveTo(px(-20), py(56), px(-74), py(36));    // jaw
    ctx.quadraticCurveTo(px(-104), py(26), px(-112), py(10));
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // ear — sits on the skull, not straddling its edge
    ctx.fillStyle = 'rgba(190,160,170,.26)';
    ctx.strokeStyle = 'rgba(200,205,220,.4)';
    ctx.beginPath();
    ctx.ellipse(px(50), py(-20), 18 * S, 15 * S, -0.3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,205,220,.22)';
    ctx.beginPath();
    ctx.ellipse(px(50), py(-20), 10 * S, 8 * S, -0.3, 0, Math.PI * 2);
    ctx.stroke();

    // eye
    ctx.fillStyle = 'rgba(20,24,34,.9)';
    ctx.beginPath(); ctx.ellipse(px(-54), py(-4), 7 * S, 6 * S, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.arc(px(-56), py(-6), 1.8 * S, 0, Math.PI * 2); ctx.fill();

    // nose
    ctx.fillStyle = 'rgba(230,160,175,.6)';
    ctx.beginPath(); ctx.ellipse(px(-110), py(10), 4.5 * S, 3.5 * S, 0, 0, Math.PI * 2); ctx.fill();

    // ---------------- whiskers ----------------
    drawWhiskers(px, py, S);

    // ---------------- cortex, fibre, light ----------------
    drawCortex(px, py, S);

    ctx.restore();

    // caption strip
    const spikes = res ? lastSpikeIdx : 0;
    const total = res ? res.spikes.length : 0;
    label(ctx, res ? `spikes delivered: ${spikes}/${total}` : 'waiting for a pulse train',
      12, H - 12, { color: '#6c7689', size: 10, baseline: 'bottom' });
    if (res) {
      label(ctx, `${res.opts.freqHz} Hz · ${res.opts.pulseMs} ms pulses`, W - 12, H - 12,
        { color: '#6c7689', size: 10, align: 'right', baseline: 'bottom' });
    }
  }

  function drawWhiskers(px, py, S) {
    // whiskers fan out from the muzzle; a spike flicks them forward
    const kick = whiskerKick;
    const rootX = -86, rootY = 16;
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const f = i / 6;
      const baseAng = -0.62 + f * 1.15;                 // spread
      const ang = baseAng - kick * 0.42;                // protraction on a spike
      const len = (46 + Math.sin(f * Math.PI) * 26) * S;
      const sx = px(rootX + f * 6), sy = py(rootY - 14 + f * 17);
      const ex = sx - Math.cos(ang) * len;
      const ey = sy + Math.sin(ang) * len * 0.72;
      const mx = (sx + ex) / 2 + kick * 7 * S;
      const my = (sy + ey) / 2 - 7 * S + kick * 3 * S;
      ctx.strokeStyle = `rgba(${kick > 0.08 ? '255,210,150' : '210,215,230'},${0.3 + kick * 0.55})`;
      ctx.lineWidth = Math.max(0.8, 1.5 * S * (1 - f * 0.25));
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
    }
    if (kick > 0.12) {
      // motion arc in front of the whiskers
      ctx.strokeStyle = `rgba(255,200,130,${kick * 0.5})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(px(-96), py(16), 72 * S, -0.95, 0.5);
      ctx.stroke();
    }
  }

  function drawCortex(px, py, S) {
    // the targeted patch of motor cortex, just under the skull
    const cxv = px(6), cyv = py(-28);
    const lit = Math.max(lightOn, whiskerKick * 0.5);

    // fibre: comes down from above, through a small hole
    const fx = px(6);
    const fTop = py(-110), fBot = cyv + 4;
    ctx.strokeStyle = 'rgba(190,200,215,.55)';
    ctx.lineWidth = Math.max(2.4, 4.2 * S);
    ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(fx, fTop); ctx.lineTo(fx, fBot); ctx.stroke();
    ctx.strokeStyle = `rgba(143,208,255,${0.25 + lit * 0.7})`;
    ctx.lineWidth = Math.max(1, 1.8 * S);
    ctx.beginPath(); ctx.moveTo(fx, fTop); ctx.lineTo(fx, fBot); ctx.stroke();

    // light cone into the tissue
    if (lit > 0.02) {
      const g = ctx.createRadialGradient(fx, fBot, 0, fx, fBot, 46 * S);
      g.addColorStop(0, `rgba(120,190,255,${0.55 * lit})`);
      g.addColorStop(1, 'rgba(120,190,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(fx - 3 * S, fBot - 4 * S);
      ctx.lineTo(fx + 3 * S, fBot - 4 * S);
      ctx.lineTo(fx + 30 * S, fBot + 42 * S);
      ctx.lineTo(fx - 30 * S, fBot + 42 * S);
      ctx.closePath();
      ctx.fill();
      glow(ctx, fx, fBot + 6 * S, 30 * S, '120,190,255', lit * 0.7);
    }

    // the neurons that express the opsin
    const cells = [
      [-16, 14], [-4, 24], [10, 16], [20, 28], [-10, 36], [6, 38],
    ];
    for (const [dx, dy] of cells) {
      const x = fx + dx * S, y = fBot + dy * S;
      const on = lit > 0.1 ? lit : 0;
      if (on > 0.05) glow(ctx, x, y, 11 * S, '255,210,120', on * 0.8);
      ctx.fillStyle = `rgba(${on > 0.05 ? '255,220,150' : '150,160,180'},${0.45 + on * 0.5})`;
      ctx.beginPath(); ctx.arc(x, y, 2.6 * S, 0, Math.PI * 2); ctx.fill();
      // a couple of dendrites so they read as neurons
      ctx.strokeStyle = `rgba(${on > 0.05 ? '255,210,140' : '150,160,180'},${0.25 + on * 0.35})`;
      ctx.lineWidth = Math.max(0.6, 0.9 * S);
      for (const a of [-2.3, -0.7, 0.9]) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * 9 * S, y + Math.sin(a) * 9 * S);
        ctx.stroke();
      }
    }

    label(ctx, 'optical fibre', fx + 9 * S, fTop + 14 * S, { color: 'rgba(143,208,255,.85)', size: 10 });

    // "motor cortex" sits outside the head on a leader line. Placed beside the
    // cells it ran straight across the ear and the back of the skull.
    const lx0 = fx + 24 * S, ly0 = fBot + 26 * S;     // edge of the cell cluster
    const lx1 = px(98), ly1 = py(8);                  // just past the back of the head
    ctx.strokeStyle = 'rgba(138,148,168,.45)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lx0, ly0); ctx.lineTo(lx1 - 4, ly1); ctx.stroke();
    ctx.fillStyle = 'rgba(138,148,168,.7)';
    ctx.beginPath(); ctx.arc(lx0, ly0, 1.6, 0, Math.PI * 2); ctx.fill();
    label(ctx, 'motor cortex', lx1, ly1, { color: '#8a94a8', size: 10, baseline: 'middle' });
  }

  function resize() {
    // The drawing is much wider than it is tall (nose to body, skull to fibre),
    // so a squarer box just adds empty sky above the head.
    const el = canvas.parentElement;
    const f = fit(canvas, (el.clientWidth || 600) < 520 ? 4 / 3 : 1.7);
    ctx = f.ctx; W = f.w; H = f.h;
  }

  resize();
  onResize(canvas.parentElement, resize);
  loop((dt) => { step(dt); draw(); }, { visibleOnly: canvas });

  return { setResult, play, stop, reset, get playing() { return playing; } };
}
