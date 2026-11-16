/*
 * Checks on how the page is put together. Run with: node --test tests/*.mjs
 *
 * These catch drift between files that have to agree with each other but that
 * nothing else ties together: the preload hints and the real import graph, the
 * address the start-up notice tells people to open and the port the server
 * actually uses, and the text alternatives on the demo canvases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const html = read('index.html');

/** Every module reachable from js/main.js, as root-relative paths. */
function moduleGraph(entry = 'js/main.js') {
  const seen = new Set();
  const visit = (p) => {
    if (seen.has(p)) return;
    assert.ok(existsSync(join(ROOT, p)), `${p} is imported but does not exist`);
    seen.add(p);
    const src = read(p);
    for (const m of src.matchAll(/^\s*import\s[^'"]*?from\s+['"](\.[^'"]+)['"]/gm)) {
      visit(normalize(join(dirname(p), m[1])).replace(/\\/g, '/'));
    }
  };
  visit(entry);
  return seen;
}

test('every module the page loads is preloaded, and nothing else is', () => {
  // Without the hints the browser only discovers the viz-* modules after it
  // has fetched and parsed main.js: two round trips instead of one.
  const graph = moduleGraph();
  const preloaded = new Set([...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]));
  for (const p of graph) assert.ok(preloaded.has(p), `${p} is imported but not preloaded`);
  for (const p of preloaded) assert.ok(graph.has(p), `${p} is preloaded but nothing imports it`);
  assert.ok(html.includes('<script type="module" src="js/main.js">'), 'main.js is no longer the entry point');
});

test('the start-up notice sends people to the port the server really uses', () => {
  const port = read('serve.mjs').match(/process\.env\.PORT \|\| (\d+)/)?.[1];
  assert.ok(port, 'could not find the default port in serve.mjs');
  assert.ok(html.includes(`http://127.0.0.1:${port}/`), `index.html should point at port ${port}`);
  assert.ok(html.includes('window.__nobel'), 'the notice must key off the handle main.js publishes');
  assert.match(read('js/main.js'), /window\.__nobel\s*=/, 'main.js no longer publishes window.__nobel');
});

test('each demo canvas says in words what it shows', () => {
  for (const id of ['dishCanvas', 'channelCanvas', 'neuronCanvas', 'mouseCanvas']) {
    const tag = html.match(new RegExp(`<canvas id="${id}"[^>]*>`))?.[0];
    assert.ok(tag, `#${id} is missing`);
    assert.match(tag, /role="img"/, `#${id} needs role="img"`);
    const label = tag.match(/aria-label="([^"]+)"/)?.[1] || '';
    assert.ok(label.length > 40, `#${id} needs a real description, got "${label}"`);
  }
});
