/*
 * main.js — populate the page from data.js and wire up the four demos.
 *
 * Every factual number on the page is injected from data.js here, rather than
 * typed into the HTML, so there is exactly one place where a fact can be wrong.
 * Elements opt in with data-fact / data-prize / data-epigraph / data-chr2.
 */

import {
  PRIZE, LAUREATES, FACTS, TIMELINE, CIRCUITS, BEYOND_BRAIN, SOURCES, EPIGRAPH,
} from './data.js';
import { simulate, DEFAULTS, CHR2, actionSpectrum, wavelengthToRGB } from './model.js';
import { createDish } from './viz-dish.js';
import { createChannel } from './viz-channel.js';
import { createNeuron } from './viz-neuron.js';
import { createMouse } from './viz-mouse.js';
import { createHero, createCausality } from './viz-small.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* ===================== 1. facts into the prose ====================== */

/** "around 90 billion", "0.5 ms", "at least 10 ms" — formatted from FACTS. */
function factText(f) {
  const n = `${f.value} ${f.unit}`;
  return f.comparator ? `${f.comparator} ${n}` : n;
}

function fillStaticText() {
  $$('[data-prize]').forEach((n) => { n.textContent = PRIZE[n.dataset.prize] ?? ''; });
  $$('[data-epigraph]').forEach((n) => { n.textContent = EPIGRAPH[n.dataset.epigraph] ?? ''; });
  $$('[data-chr2]').forEach((n) => { n.textContent = CHR2[n.dataset.chr2] ?? ''; });
  $$('[data-fact]').forEach((n) => {
    const f = FACTS[n.dataset.fact];
    if (!f) return;
    n.textContent = factText(f);
    if (f.note) n.title = f.note;
  });
  document.title = `A Switch for a Neuron — ${PRIZE.category} ${PRIZE.year}`;
}

/* ===================== 2. hero laureate chips ======================= */

function buildHeroLaureates() {
  const box = $('#heroLaureates');
  if (!box) return;
  for (const p of LAUREATES) {
    const card = el('div', 'lcard');
    const img = el('img');
    // A 96 px square, ~3 KB, rather than the 60-100 KB portrait: the chip is
    // 44 px across and sits on the critical path of the first screen.
    img.src = p.thumb || p.portrait;
    img.width = 44; img.height = 44;
    img.alt = '';                     // decorative here; named in the text beside it
    img.loading = 'eager';            // above the fold — lazy here just delays the hero
    img.fetchPriority = 'high';
    img.decoding = 'async';
    img.addEventListener('error', () => { img.style.display = 'none'; });
    card.append(img);
    card.append(el('div', null,
      `<div class="lcard__t">${p.name}</div><div class="lcard__s">b. ${p.born} · ${p.nationality}</div>`));
    box.append(card);
  }
}

/* ===================== 3. latency bars (Act I) ====================== */

function buildLatencyBars() {
  const box = $('#latencyBars');
  if (!box) return;
  const rows = [
    { f: FACTS.eyespotLatency, name: 'Chlamydomonas eyespot', slow: false },
    { f: FACTS.humanEyeLatency, name: 'Human eye (rod)', slow: true },
  ];
  const max = Math.max(...rows.map((r) => r.f.value));
  for (const r of rows) {
    const w = (r.f.value / max) * 100;
    const bar = el('div', `lbar${r.slow ? ' lbar--slow' : ''}`);
    bar.innerHTML =
      `<div class="lbar__top"><span>${r.name}</span>` +
      `<span class="lbar__v">${factText(r.f)}</span></div>` +
      `<div class="lbar__track"><div class="lbar__fill" style="width:${w}%"></div></div>`;
    box.append(bar);
  }
}

/* ===================== 4. timeline ================================== */

function buildTimeline() {
  const list = $('#timelineList');
  if (!list) return;
  const names = Object.fromEntries(LAUREATES.map((l) => [l.id, l.name]));
  for (const e of TIMELINE) {
    const li = el('li', `tl${e.key ? ' tl--key' : ''}`);
    li.innerHTML =
      `<span class="tl__y">${e.year}</span>` +
      `<h3 class="tl__t">${e.title}</h3>` +
      `<p class="tl__b">${e.body}</p>` +
      (e.actor && names[e.actor] ? `<span class="tl__who">${names[e.actor]}</span>` : '');
    list.append(li);
  }
}

/* ===================== 5. impact ==================================== */

const ICONS = {
  pain: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  social: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M15 20c0-2 1-3.4 3-3.4S21 18 21 20"/>',
  thirst: '<path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3z"/>',
  feeding: '<path d="M6 3v8a2 2 0 0 0 4 0V3"/><path d="M8 11v10"/><path d="M17 3c-1.5 2-2 4-2 6s.7 3 2 3 2-1 2-3-.5-4-2-6z"/><path d="M17 12v9"/>',
  reward: '<circle cx="12" cy="9" r="5.5"/><path d="M9 14.5 7.5 21l4.5-2.4L16.5 21 15 14.5"/>',
  attention: '<path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.3 2"/>',
  fever: '<path d="M10 14.8V5a2 2 0 1 1 4 0v9.8a4.5 4.5 0 1 1-4 0z"/><circle cx="12" cy="18" r="1.6" fill="currentColor" stroke="none"/>',
};

function buildImpact() {
  const list = $('#circuitsList');
  if (list) {
    for (const c of CIRCUITS) {
      const li = el('li');
      li.innerHTML =
        `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[c.icon] || ICONS.attention}</svg>` +
        `<span>${c.label}</span>`;
      list.append(li);
    }
  }
  const beyond = $('#beyondList');
  if (beyond) {
    for (const b of BEYOND_BRAIN) {
      beyond.append(el('article', 'card', `<h4>${b.title}</h4><p>${b.body}</p>`));
    }
  }
}

/* ===================== 6. people & sources ========================== */

function buildPeople() {
  const box = $('#peopleList');
  if (!box) return;
  for (const p of LAUREATES) {
    const card = el('article', 'person');
    const img = el('img', 'person__img');
    img.src = p.portrait;
    img.alt = `Portrait of ${p.name}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => { img.remove(); });
    card.append(img);
    card.append(el('div', 'person__b',
      `<h3 class="person__n">${p.name}</h3>` +
      `<p class="person__m">b. ${p.born} · ${p.affiliation}</p>` +
      `<p class="person__r">${p.role}</p>` +
      `<p class="person__c">${p.contribution}</p>` +
      `<p class="person__credit">Prize-winning work done at ${p.workDoneAt}.<br>` +
      `Portrait: ${p.portraitCredit}.</p>`));
    box.append(card);
  }
}

function buildSources() {
  const box = $('#sourcesList');
  if (!box) return;
  const groups = [
    ['official', 'The Nobel Committee’s own 2026 material'],
    ['paper', 'The research, and the models used in the simulations'],
  ];
  for (const [kind, heading] of groups) {
    const entries = Object.values(SOURCES).filter((s) => s.kind === kind);
    if (!entries.length) continue;
    const g = el('div', 'srcgroup');
    g.append(el('h3', null, heading));
    for (const s of entries) {
      g.append(el('p', 'src',
        `<a class="src__t" href="${s.url}" target="_blank" rel="noopener">${s.text}</a>` +
        `<span class="src__p">${s.publisher}</span>`));
    }
    box.append(g);
  }
  const repo = $('#repoLine');
  if (repo) {
    repo.innerHTML = 'Source code: <a href="https://github.com/Zcube7/nobel-2026-optogenetics" ' +
      'target="_blank" rel="noopener">github.com/Zcube7/nobel-2026-optogenetics</a>';
  }
}

/* ===================== 7. Act I — the dish ========================== */

function wireDish() {
  const canvas = $('#dishCanvas');
  if (!canvas) return;
  const countOut = $('#dishCountOut');
  const countEl = $('#dishCount');
  const lightEl = $('#dishLight');

  const dish = createDish(canvas, {
    hud: $('#dishHud'),
    count: Number(countEl.value),
    onLampMove: () => { lightEl.checked = true; },
  });

  const syncCount = () => { countOut.textContent = countEl.value; };
  countEl.addEventListener('input', () => {
    syncCount();
    dish.setCount(Number(countEl.value));
  });
  lightEl.addEventListener('change', () => dish.setLight(lightEl.checked));
  $('#dishReset').addEventListener('click', () => dish.scatter());
  syncCount();
}

/* ===================== 8. Act II — the channel ====================== */

function wireChannel() {
  const canvas = $('#channelCanvas');
  if (!canvas) return;
  const slider = $('#nmSlider');
  const out = $('#nmOut');
  const aux = $('#nmEff');
  const onEl = $('#channelLight');

  const ch = createChannel(canvas);

  function sync() {
    const nm = Number(slider.value);
    ch.setWavelength(nm);
    out.textContent = `${nm} nm`;
    const [r, g, b] = wavelengthToRGB(nm);
    out.style.color = `rgb(${r},${g},${b})`;
    const eff = Math.round(actionSpectrum(nm) * 100);
    aux.textContent = eff >= 85 ? `${eff}% absorbed — peak sensitivity`
      : eff >= 25 ? `${eff}% absorbed`
      : eff >= 5 ? `${eff}% — barely responds`
      : `${eff}% — invisible to the opsin`;
  }
  slider.addEventListener('input', sync);
  onEl.addEventListener('change', () => ch.setOn(onEl.checked));
  $('#channelFlash').addEventListener('click', () => {
    onEl.checked = true;
    ch.setOn(true);
    ch.darkAdapt();
  });
  // Replay the transient the first time this section is scrolled into view.
  // The trace window is only a few seconds wide, so a reader arriving later
  // would otherwise find the channel already sitting at its plateau and never
  // see the peak that the whole section is about.
  const section = document.querySelector('#act-2');
  if (section && 'IntersectionObserver' in window) {
    let fired = false;
    const io = new IntersectionObserver((entries) => {
      if (fired || !entries.some((e) => e.isIntersecting)) return;
      fired = true;
      io.disconnect();
      ch.darkAdapt();
    }, { threshold: 0.2 });
    io.observe(section);
  }

  sync();
  return ch;
}

/* ===================== 9. Act III — the neuron ====================== */

const PRESETS = {
  published: { freqHz: 10, pulseMs: 5, power: 100, expression: 20, opsin: true },
  // 20 Hz rather than something faster: the cell follows the first few pulses
  // and *then* gives out, which is the point. A preset that fails on pulse one
  // just looks broken.
  block:     { freqHz: 20, pulseMs: 5, power: 100, expression: 20, opsin: true },
  dim:       { freqHz: 10, pulseMs: 5, power: 100, expression: 8, opsin: true },
};

function wireNeuron(onNewResult) {
  const canvas = $('#neuronCanvas');
  if (!canvas) return null;

  const freq = $('#freqSlider'), pw = $('#pwSlider');
  const power = $('#powerSlider'), expr = $('#exprSlider');
  const opsin = $('#opsinToggle');
  const readout = $('#neuronReadout');

  const viz = createNeuron(canvas);

  function opts() {
    return {
      freqHz: Number(freq.value),
      pulseMs: Number(pw.value),
      power: Number(power.value) / 100,
      expression: Number(expr.value) / 100,
      opsin: opsin.checked,
    };
  }

  function syncLabels(o) {
    $('#freqOut').textContent = `${o.freqHz} Hz`;
    $('#pwOut').textContent = `${o.pulseMs} ms`;
    $('#powerOut').textContent = `${Math.round(o.power * 100)}%`;
    $('#exprOut').textContent = o.opsin ? o.expression.toFixed(2) : 'none';
    // disable the opsin-only controls when running a control cell
    for (const c of [power, expr]) c.disabled = !o.opsin;
  }

  function run({ instant = false } = {}) {
    const o = opts();
    syncLabels(o);
    const res = simulate(o);
    viz.setResult(res, { instant });
    renderReadout(readout, res);
    if (onNewResult) onNewResult(res);
    // mark which preset, if any, matches the current settings
    for (const b of $$('[data-preset]')) {
      const p = PRESETS[b.dataset.preset];
      const match = p && p.freqHz === o.freqHz && p.pulseMs === o.pulseMs
        && p.power === Math.round(o.power * 100)
        && p.expression === Math.round(o.expression * 100) && p.opsin === o.opsin;
      b.dataset.active = match ? 'true' : 'false';
    }
  }

  // While a slider is dragged, re-run on the leading edge and then at most once
  // per THROTTLE ms, always finishing on the final value. A run takes a few ms
  // on a laptop (the gating table in model.js), so the trace follows the thumb;
  // on a slow phone the throttle keeps input from queueing up behind it.
  const THROTTLE = 40;
  let timer = null, queued = false;
  function runLive() {
    if (timer) { queued = true; return; }
    run({ instant: true });
    timer = setTimeout(() => {
      timer = null;
      if (queued) { queued = false; runLive(); }
    }, THROTTLE);
  }

  for (const c of [freq, pw, power, expr]) c.addEventListener('input', runLive);
  opsin.addEventListener('change', () => run());

  for (const b of $$('[data-preset]')) {
    b.addEventListener('click', () => {
      const p = PRESETS[b.dataset.preset];
      freq.value = p.freqHz; pw.value = p.pulseMs;
      power.value = p.power; expr.value = p.expression;
      opsin.checked = p.opsin;
      run();
    });
  }

  run();
  return viz;
}

/** The numbers under the recording, plus a sentence saying what happened. */
function renderReadout(box, res) {
  const fid = Math.round(res.fidelity * 100);
  const tone = !res.opts.opsin ? '' : fid >= 95 ? 'stat--good' : fid >= 40 ? 'stat--warn' : 'stat--bad';

  let peak = 0;
  for (let i = 0; i < res.I.length; i++) peak = Math.max(peak, -res.I[i]);

  const stats = [
    { k: 'Light pulses', v: res.pulses, note: `${res.opts.freqHz} Hz for 1 s` },
    { k: 'Action potentials', v: res.spikes.length, cls: tone },
    { k: 'Followed', v: `${fid}<small>%</small>`, cls: tone, note: 'one spike per pulse' },
    { k: 'Peak photocurrent', v: `${peak.toFixed(1)}<small>µA/cm²</small>` },
  ];

  box.innerHTML = stats.map((s) =>
    `<div class="stat ${s.cls || ''}"><span class="stat__k">${s.k}</span>` +
    `<span class="stat__v">${s.v}</span>` +
    (s.note ? `<div class="stat__note">${s.note}</div>` : '') + '</div>'
  ).join('') + `<div class="verdict">${verdict(res)}</div>`;
}

function verdict(res) {
  const o = res.opts;
  if (!o.opsin) {
    return '<b>Control cell.</b> No channelrhodopsin, so the light passes straight through and ' +
      'nothing happens — the check that rules out light itself, or heat, doing the work.';
  }
  if (res.spikes.length === 0) {
    return '<b>Below threshold.</b> The channel is opening and current is flowing, but not enough ' +
      'of it to reach the voltage where sodium channels regenerate. More opsin, or more light.';
  }
  if (res.fidelity >= 0.95) {
    return `<b>Clean one-for-one control.</b> Every one of the ${res.pulses} pulses produced exactly ` +
      'one action potential — the result that made optogenetics a tool rather than a curiosity.';
  }
  if (res.firstFailure !== null) {
    const n = res.followed;
    return `<b>The cell gave out.</b> It followed the first ${n} pulse${n === 1 ? '' : 's'}, then stopped ` +
      `at ${(res.firstFailure / 1000).toFixed(2)} s. Current left over between pulses holds the membrane ` +
      'slightly depolarised, sodium channels stay inactivated, and the neuron falls into depolarisation ' +
      'block. Driving harder makes this worse, not better.';
  }
  return '<b>Partial following.</b> Some pulses produced a spike and some did not.';
}

/* ===================== 10. Act IV — the mouse ======================= */

function wireMouse(getResult) {
  const canvas = $('#mouseCanvas');
  if (!canvas) return null;
  const btn = $('#mousePlay');
  const status = $('#mouseStatus');

  const mouse = createMouse(canvas, {
    onEnd: () => {
      btn.textContent = 'Deliver the pulse train';
      btn.dataset.state = 'play';
      const r = getResult();
      if (r) {
        status.textContent = r.spikes.length === 0
          ? 'No spikes — the whiskers never moved.'
          : `${r.spikes.length} spikes delivered.`;
      }
    },
    onTick: (t, spikes, r) => {
      status.textContent = `${(t / 1000).toFixed(2)} s · ${spikes} spike${spikes === 1 ? '' : 's'}`;
    },
  });

  btn.addEventListener('click', () => {
    const r = getResult();
    if (!r) return;
    if (btn.dataset.state === 'play') {
      mouse.setResult(r);
      mouse.play();
      btn.textContent = 'Stop';
      btn.dataset.state = 'stop';
    } else {
      mouse.stop();
      btn.textContent = 'Deliver the pulse train';
      btn.dataset.state = 'play';
    }
  });

  status.textContent = 'Uses whatever settings you left in Act III.';
  return mouse;
}

/* ===================== 11. boot ===================================== */

function boot() {
  fillStaticText();
  buildHeroLaureates();
  buildLatencyBars();
  buildTimeline();
  buildImpact();
  buildPeople();
  buildSources();

  const heroCanvas = $('#heroCanvas');
  if (heroCanvas) createHero(heroCanvas);
  for (const c of $$('[data-causality]')) createCausality(c, c.dataset.causality);

  wireDish();
  const channel = wireChannel();

  let latest = null;
  let mouse = null;
  const neuron = wireNeuron((res) => {
    latest = res;
    if (mouse) mouse.setResult(res);      // keep Act IV in step with Act III
  });
  mouse = wireMouse(() => latest);

  // expose a small handle for debugging and for the automated checks
  window.__nobel = {
    get result() { return latest; },
    neuron, mouse, channel,
    simulate, PRESETS, FACTS, PRIZE,
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
