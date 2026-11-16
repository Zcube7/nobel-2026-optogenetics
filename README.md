# A switch for a neuron

An interactive explainer on the **2026 Nobel Prize in Physiology or Medicine**, awarded to
**Peter Hegemann**, **Georg Nagel** and **Karl Deisseroth**
*"for their discoveries concerning light-gated ion channels and optogenetics"*.

**→ [Read it](https://zcube7.github.io/nobel-2026-optogenetics/)**

It follows one thread: a pond alga that swims toward light, the protein that explains why it is
so fast, and what happened when that protein was put into a nerve cell. Four demos run live in
the browser — the last one is a real Hodgkin–Huxley neuron driven by a real channelrhodopsin
photocycle, not an animation of one.

---

## The demos

| Act | What you can do | What it is underneath |
|---|---|---|
| **I — The alga** | Move the lamp and watch *Chlamydomonas* accumulate on the lit side | Phototaxis by eyespot sampling: each cell rolls, sees the lamp brighten and dim, and steers toward the brightest part of its own last turn. Rotational diffusion and a spread of per-cell sensitivity keep the population a gradient rather than a single clump |
| **II — The channel** | Drag the wavelength; dark-adapt and flash | The four-state channelrhodopsin-2 photocycle, integrated live. The peak-then-plateau shape falls out of the kinetics |
| **III — The neuron** | Set pulse rate, pulse width, light power and how much opsin the cell made | Hodgkin–Huxley membrane + the same photocycle. Three stacked panels: light, photocurrent, membrane potential |
| **IV — The living brain** | Deliver the train you built in Act III | Schematic head and fibre, driven by the spikes Act III actually produced |

### Act III is the one worth playing with

At the default settings every light pulse produces exactly one action potential. Three things
break that, and all three are real:

- **Too little opsin** — below about 0.15 the photocurrent never reaches threshold.
- **The channel runs down** — part of the protein population sits in a light-adapted closed
  state that takes seconds to recover, so each pulse has fewer channels available than the last.
  Watch the photocurrent trace shrink along the train.
- **The cell gets stuck** — past a certain rate the leftover current never fully decays between
  pulses, sodium channels stay inactivated, and the neuron enters **depolarisation block**: it
  stops firing rather than firing faster.

At the default expression level the model lands on the published panel on its own: clean
one-for-one following at 5 and 10 Hz, collapse part-way through a 20 Hz train. That was not
tuned to match — the only thing chosen was how much opsin the cell made, which varies cell to
cell in a real experiment too.

---

## What is modelled, and what is just drawn

Being clear about this matters more than the pictures.

**Real models, published constants:**

- **Hodgkin–Huxley** (1952) membrane equations, standard squid-axon constants, with the authors'
  own Q10 = 3 temperature factor. `js/model.js`
- **Channelrhodopsin-2** as a four-state photocycle (Nikolic et al. 2009). Every rate constant
  is as published. `js/model.js`
- Free parameters, and the only ones: `expression` (how much opsin the cell made — genuinely
  per-cell in an experiment) and `LIGHT_K`, set so the channel opens with the ~0.2 ms time
  constant the Nobel Committee quotes.

**Schematic, not simulated:** the phototaxis dish (plausible behaviour, not a fluid or
flagellar model), the membrane cross-section, the mouse head and whiskers, and the
watching-vs-driving panels. The ChR2 action spectrum uses the published peak wavelength with an
illustrative shape.

Two places where the display is deliberately slowed, and says so on screen: the Act II channel
runs at about 1/20 of real speed (the whole transient is otherwise over in under one trace
sample), and the Act III sweep replays 1 s of model time over about 2 s.

---

## Running it

Nothing to install, no build step, no dependencies, no network calls at runtime.

```bash
node serve.mjs
```

Then open <http://127.0.0.1:4192/>. Opening `index.html` directly from disk works too.

Tests:

```bash
node --test tests/*.mjs
```

30 checks over two files. They are not snapshots of current behaviour — each pins a claim the
page makes to the reader, so if the model drifts the page stops being true and a test goes red.
`tests/data.test.mjs` additionally checks that every fact has a named source, that the timeline
is ordered and matches its own headline, that no figure is hard-coded into the prose instead of
being read from `js/data.js`, and that every portrait file referenced actually exists.

---

## Layout

```
index.html           the narrative; all factual values are data-bound placeholders
css/style.css        one accent colour per act, no web fonts, works offline
js/data.js           every factual claim, each with a source id — the single source of truth
js/model.js          Hodgkin-Huxley + the ChR2 photocycle
js/canvas.js         DPR-aware sizing, and an animation loop that survives a hidden panel
js/viz-dish.js       Act I
js/viz-channel.js    Act II
js/viz-neuron.js     Act III
js/viz-mouse.js      Act IV
js/viz-small.js      hero background, watching-vs-driving
js/main.js           binds data.js into the page and wires the controls
tests/               node --test
assets/portraits/    three photographs, under their own licences — see CREDITS.md
```

Nothing on the page types a number into the prose. `index.html` carries
`<span data-fact="eyespotLatency">`, `main.js` fills it from `js/data.js`, and a test fails if
anyone hard-codes the value instead. There is exactly one place for a fact to be wrong.

---

## Sources

The narrative and every quoted figure follow the Nobel Committee's own 2026 material:

- [Press release](https://www.nobelprize.org/prizes/medicine/2026/press-release/)
- [Popular information: "A light-sensitive algal protein energised neuroscience"](https://www.nobelprize.org/prizes/medicine/2026/popular-information/)
- [Scientific background: "Optogenetics. Discovery of a neuronal switch"](https://www.nobelprize.org/prizes/medicine/2026/advanced-information/)

The underlying research, and the models used here, are listed in full on the page itself and in
`js/data.js` — Harz & Hegemann 1992, Nagel et al. 2002 and 2003, Boyden et al. 2005, Aravanis
et al. 2007, Crick 1979 and 1999, Hodgkin & Huxley 1952, Nikolic et al. 2009.

## Licence and credits

Code and text: **MIT** (see `LICENSE`).

**No illustration from nobelprize.org is reproduced here.** The Committee's figures by Mattias
Karlén are free for non-commercial use with attribution, which is not compatible with an
MIT-licensed repository, so every diagram and animation on this page was drawn from scratch in
code. The page links out to the official figures instead.

The three portraits are from Wikimedia Commons under their own licences (CC BY-SA 4.0 and CC0)
and are **not** covered by the MIT licence — see
[`assets/portraits/CREDITS.md`](assets/portraits/CREDITS.md) for per-file attribution.

This is an independent explainer. It is not affiliated with, or endorsed by, the Nobel
Foundation or the Nobel Assembly at Karolinska Institutet. "Nobel Prize" is a registered
trademark of the Nobel Foundation.
