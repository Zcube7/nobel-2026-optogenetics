/*
 * Checks on the content. Run with: node --test
 *
 * The point of data.js is that every factual claim on the page has exactly one
 * home and a named source. These tests enforce that, and catch the quiet ways
 * a page like this goes wrong: a fact with no source, a timeline out of order,
 * a laureate whose portrait file is missing, a source nothing refers to.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  PRIZE, LAUREATES, FACTS, TIMELINE, CIRCUITS, CIRCUITS_SRC,
  BEYOND_BRAIN, BEYOND_BRAIN_SRC, SOURCES, EPIGRAPH,
} from '../js/data.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

/* ------------------------------ the prize ---------------------------- */

test('the prize record matches the official announcement', () => {
  assert.equal(PRIZE.year, 2026);
  assert.equal(PRIZE.citation, 'for their discoveries concerning light-gated ion channels and optogenetics');
  assert.equal(PRIZE.awarder, 'The Nobel Assembly at Karolinska Institutet');
  assert.match(PRIZE.amount, /12 million Swedish kronor/);
  assert.match(PRIZE.announced, /2026/);
});

test('there are exactly three laureates, each complete', () => {
  assert.equal(LAUREATES.length, 3);
  const names = LAUREATES.map((l) => l.name).sort();
  assert.deepEqual(names, ['Georg Nagel', 'Karl Deisseroth', 'Peter Hegemann']);
  for (const l of LAUREATES) {
    for (const k of ['id', 'name', 'born', 'affiliation', 'workDoneAt', 'role',
      'contribution', 'portrait', 'portraitCredit', 'src']) {
      assert.ok(l[k], `${l.name} is missing ${k}`);
    }
    assert.ok(l.born > 1900 && l.born < 2000, `${l.name}: implausible birth year`);
    assert.ok(existsSync(join(ROOT, l.portrait)), `portrait file missing: ${l.portrait}`);
    assert.ok(/CC0|CC BY/.test(l.portraitCredit),
      `${l.name}: portrait credit must name a licence`);
  }
});

/* ------------------------------- sourcing ---------------------------- */

test('every sourced record points at a source that exists', () => {
  const ids = new Set(Object.keys(SOURCES));
  const used = new Set();
  const check = (src, where) => {
    assert.ok(src, `${where} has no src`);
    assert.ok(ids.has(src), `${where} cites unknown source "${src}"`);
    used.add(src);
  };
  check(PRIZE.src, 'PRIZE');
  check(EPIGRAPH.src, 'EPIGRAPH');
  check(CIRCUITS_SRC, 'CIRCUITS');
  check(BEYOND_BRAIN_SRC, 'BEYOND_BRAIN');
  for (const l of LAUREATES) check(l.src, `laureate ${l.name}`);
  for (const [k, f] of Object.entries(FACTS)) check(f.src, `fact ${k}`);
  for (const e of TIMELINE) check(e.src, `timeline ${e.year}`);

  // The reference list is rendered from SOURCES, so an unused entry is a
  // reference the reader is shown but which supports nothing on the page.
  // Two are deliberate: they back the simulations rather than a sentence.
  const allowedUnused = new Set(['nobel-advanced', 'hodgkin-1952', 'nikolic-2009']);
  for (const id of ids) {
    assert.ok(used.has(id) || allowedUnused.has(id), `source "${id}" is never cited`);
  }
});

test('every source has a usable reference and link', () => {
  for (const [id, s] of Object.entries(SOURCES)) {
    assert.ok(s.text && s.text.length > 10, `${id}: no text`);
    assert.ok(s.publisher, `${id}: no publisher`);
    assert.match(s.url, /^https:\/\//, `${id}: url must be https`);
    assert.ok(['official', 'paper'].includes(s.kind), `${id}: unknown kind ${s.kind}`);
  }
});

test('the official sources really are nobelprize.org', () => {
  for (const [id, s] of Object.entries(SOURCES)) {
    if (s.kind !== 'official') continue;
    assert.match(s.url, /^https:\/\/www\.nobelprize\.org\//, `${id} is not a Nobel source`);
    assert.match(s.url, /\/2026\//, `${id} should be the 2026 material`);
  }
});

/* ------------------------------- timeline ---------------------------- */

test('the timeline is in order and spans the whole story', () => {
  for (let i = 1; i < TIMELINE.length; i++) {
    assert.ok(TIMELINE[i].year >= TIMELINE[i - 1].year,
      `timeline out of order at ${TIMELINE[i].year}`);
  }
  assert.equal(TIMELINE[TIMELINE.length - 1].year, 2026, 'should end with the prize');
  const years = TIMELINE.map((e) => e.year);
  // the discoveries the page is built around must each be on the timeline
  for (const y of [1992, 2003, 2005, 2007]) {
    assert.ok(years.includes(y), `the timeline is missing ${y}`);
  }
  for (const e of TIMELINE) {
    assert.ok(e.title && e.body, `timeline ${e.year} is incomplete`);
    if (e.actor) {
      assert.ok(LAUREATES.some((l) => l.id === e.actor),
        `timeline ${e.year} credits unknown person "${e.actor}"`);
    }
  }
});

test('the timeline headline matches the span it describes', () => {
  // The heading says "Thirty-four years": Hegemann's measurement to the prize.
  const first = TIMELINE.find((e) => e.actor)?.year;
  assert.equal(first, 1992);
  assert.equal(2026 - first, 34);
  assert.match(html, /Thirty-four years/);
});

/* -------------------------------- facts ------------------------------ */

test('the quoted figures are the ones the Nobel material gives', () => {
  assert.equal(FACTS.eyespotLatency.value, 0.5);
  assert.equal(FACTS.eyespotLatency.unit, 'ms');
  assert.equal(FACTS.humanEyeLatency.value, 10);
  assert.equal(FACTS.channelOpening.value, 0.2);
  assert.equal(FACTS.neuronCount.value, 90);
  assert.equal(FACTS.brainMass.value, 1.3);
  // the page's "more than twenty times longer" claim has to hold
  assert.ok(FACTS.humanEyeLatency.value / FACTS.eyespotLatency.value >= 20,
    'the alga-vs-eye comparison no longer supports "twenty times"');
  for (const [k, f] of Object.entries(FACTS)) {
    assert.ok(typeof f.value === 'number' && f.unit && f.label, `fact ${k} incomplete`);
  }
});

/* --------------------------- page wiring ----------------------------- */

test('every data-bound placeholder in the HTML has something to bind to', () => {
  const grab = (attr) => [...html.matchAll(new RegExp(`data-${attr}="([^"]+)"`, 'g'))]
    .map((m) => m[1]);
  for (const k of grab('fact')) {
    assert.ok(FACTS[k], `index.html asks for fact "${k}", which data.js does not have`);
  }
  for (const k of grab('prize')) {
    assert.ok(PRIZE[k] !== undefined, `index.html asks for prize field "${k}"`);
  }
  for (const k of grab('epigraph')) {
    assert.ok(EPIGRAPH[k] !== undefined, `index.html asks for epigraph field "${k}"`);
  }
  // and the containers main.js fills must exist
  for (const id of ['heroLaureates', 'latencyBars', 'timelineList', 'circuitsList',
    'beyondList', 'peopleList', 'sourcesList']) {
    assert.ok(html.includes(`id="${id}"`), `index.html is missing #${id}`);
  }
});

test('the page does not hard-code numbers that belong to data.js', () => {
  // Strip the places where these strings are legitimately prose or markup.
  const body = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<meta[^>]*>/g, '');
  // These would be stale copies of FACTS values typed into the prose.
  const forbidden = [
    [/0\.5\s*ms/, 'eyespot latency'],
    [/90\s*billion/, 'neuron count'],
    [/1\.3\s*kg/, 'brain mass'],
  ];
  for (const [re, what] of forbidden) {
    assert.ok(!re.test(body), `${what} is hard-coded in index.html; use data-fact instead`);
  }
});

test('the impact lists are populated and sourced', () => {
  assert.ok(CIRCUITS.length >= 6);
  for (const c of CIRCUITS) assert.ok(c.label && c.icon, 'circuit entry incomplete');
  assert.ok(BEYOND_BRAIN.length >= 3);
  for (const b of BEYOND_BRAIN) assert.ok(b.title && b.body, 'beyond-brain entry incomplete');
});

test('the page says plainly that it is not affiliated with the Nobel bodies', () => {
  assert.match(html, /[Nn]ot affiliated with/);
  assert.match(html, /registered trademark/);
});
