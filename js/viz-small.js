/*
 * viz-small.js — two supporting animations.
 *
 *   createHero()     the drifting neural field behind the title
 *   createCausality() the "watching" vs "driving" pair in the problem section
 *
 * The causality pair carries an argument, so it is worth being precise about
 * what each panel shows. "Watching" fires cells at random and lights many of
 * them at once: activity you can record but cannot attribute. "Driving"
 * illuminates one marked subset on a steady beat and leaves the rest dark:
 * one cause, one effect, nothing else moving.
 */

import { fit, loop, onResize, glow, rng, clamp } from './canvas.js';

/* ------------------------------ hero ------------------------------- */

export function createHero(canvas) {
  let W = 0, H = 0, ctx = null;
  let nodes = [], edges = [];
  const rand = rng(1971);
  let tAcc = 0;

  function build() {
    const target = clamp(Math.round((W * H) / 26000), 18, 64);
    nodes = [];
    for (let i = 0; i < target; i++) {
      nodes.push({
        x: rand() * W,
        y: rand() * H,
        vx: (rand() - 0.5) * 5,
        vy: (rand() - 0.5) * 5,
        r: 1 + rand() * 1.6,
        lit: 0,
        next: rand() * 6,
      });
    }
    edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (d < Math.min(W, H) * 0.28) edges.push([i, j]);
      }
    }
  }

  function step(dt) {
    tAcc += dt;
    for (const n of nodes) {
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < -20) n.x = W + 20; if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20; if (n.y > H + 20) n.y = -20;
      n.next -= dt;
      if (n.next <= 0) { n.lit = 1; n.next = 2.5 + rand() * 7; }
      n.lit *= Math.exp(-dt * 1.9);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    for (const [i, j] of edges) {
      const a = nodes[i], b = nodes[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const fade = clamp(1 - d / (Math.min(W, H) * 0.28), 0, 1);
      const act = Math.max(a.lit, b.lit);
      ctx.strokeStyle = `rgba(110,150,210,${fade * (0.045 + act * 0.22)})`;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const n of nodes) {
      if (n.lit > 0.04) glow(ctx, n.x, n.y, 16 + n.lit * 24, '100,175,255', n.lit * 0.4);
      ctx.fillStyle = `rgba(${n.lit > 0.2 ? '170,215,255' : '110,140,180'},${0.25 + n.lit * 0.7})`;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + n.lit * 1.3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function resize() {
    const parent = canvas.parentElement;
    const cssW = parent.clientWidth, cssH = parent.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = cssW; H = cssH;
    build();
  }

  resize();
  onResize(canvas.parentElement, resize);
  loop((dt) => { step(dt); draw(); }, { visibleOnly: canvas });
}

/* --------------------------- causality ----------------------------- */

export function createCausality(canvas, mode) {
  let W = 0, H = 0, ctx = null;
  let cells = [];
  const rand = rng(mode === 'drive' ? 2005 : 1979);
  let beat = 0;

  function build() {
    cells = [];
    const cols = 9, rows = 5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const jx = (rand() - 0.5) * 7, jy = (rand() - 0.5) * 7;
        cells.push({
          x: ((c + 0.5) / cols) * W + jx,
          y: ((r + 0.5) / rows) * H + jy,
          lit: 0,
          next: rand() * 2,
          // in "drive" mode only this marked subset carries the opsin
          marked: mode === 'drive' ? rand() < 0.26 : false,
        });
      }
    }
  }

  function step(dt) {
    if (mode === 'watch') {
      for (const c of cells) {
        c.next -= dt;
        if (c.next <= 0) { c.lit = 1; c.next = 0.35 + rand() * 1.7; }
        c.lit *= Math.exp(-dt * 3.4);
      }
    } else {
      beat += dt;
      if (beat > 1.15) {
        beat = 0;
        for (const c of cells) if (c.marked) c.lit = 1;
      }
      for (const c of cells) c.lit *= Math.exp(-dt * 3.2);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, W, H);

    // in drive mode, a blue wash while the light is on
    if (mode === 'drive' && beat < 0.16) {
      const a = (1 - beat / 0.16) * 0.16;
      ctx.fillStyle = `rgba(77,166,255,${a})`;
      ctx.fillRect(0, 0, W, H);
    }

    for (const c of cells) {
      const col = mode === 'drive'
        ? (c.marked ? '143,208,255' : '90,100,120')
        : '170,190,215';
      if (c.lit > 0.05) glow(ctx, c.x, c.y, 13 + c.lit * 11, col, c.lit * 0.5);
      ctx.fillStyle = `rgba(${col},${mode === 'drive' && !c.marked ? 0.3 : 0.32 + c.lit * 0.66})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, 2.3 + c.lit * 1.5, 0, Math.PI * 2); ctx.fill();
      // mark the opsin-expressing cells with a ring so the subset is legible
      if (c.marked) {
        ctx.strokeStyle = `rgba(143,208,255,${0.3 + c.lit * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(c.x, c.y, 5.2, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || canvas.parentElement.clientWidth;
    const cssH = canvas.clientHeight || 118;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = cssW; H = cssH;
    build();
  }

  resize();
  onResize(canvas, resize);
  loop((dt) => { step(dt); draw(); }, { visibleOnly: canvas });
}
