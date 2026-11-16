/*
 * model.js — the simulation behind the "switch for a neuron" demo.
 *
 * Two published models, wired together:
 *
 *   1. Channelrhodopsin-2 as a four-state photocycle (Nikolic et al. 2009).
 *      Light drives the closed state C1 into the open state O1; O1 relaxes into
 *      a second, lower-conductance open state O2; O2 closes into C2, a
 *      light-adapted closed state that takes seconds to return to C1. That slow
 *      C2 -> C1 step is the whole reason fast light pulse trains stop working:
 *      the protein runs out of available channels before the neuron runs out of
 *      patience.
 *
 *   2. The neuron as the Hodgkin-Huxley membrane (Hodgkin & Huxley 1952), with
 *      the usual Q10 temperature factor so spikes are of mammalian width rather
 *      than the 6.3 degC squid-axon original.
 *
 * What is tuned and what is not:
 *   - Every photocycle rate constant and every HH rate equation is as published.
 *   - gChR2 (how much opsin a cell happened to make) is a free parameter in a
 *     real experiment too. The default is chosen so that one light pulse makes
 *     one spike at low rates; it is exposed as `expression`.
 *   - LIGHT_K sets the photoactivation rate at full power so the channel opens
 *     with a ~0.2 ms time constant, the figure the Nobel Committee quotes.
 *
 * This reproduces the published qualitative result — reliable following at
 * 5-10 Hz, failure part-way through a 20-30 Hz train — from the mechanism
 * rather than by scripting it. It is a model, not a refit of anyone's data.
 */

/* ---------------------------------------------------------------- *
 * Channelrhodopsin-2 photocycle (Nikolic et al. 2009). Rates in ms^-1.
 * ---------------------------------------------------------------- */
export const CHR2 = {
  Gd1: 0.117,      // O1 -> C1   (tau 8.5 ms)
  Gd2: 0.0193,     // O2 -> C2   (tau 52 ms)
  e12: 0.053,      // O1 -> O2
  e21: 0.023,      // O2 -> O1
  Gr: 4.34e-4,     // C2 -> C1   (tau ~2.3 s, the slow recovery)
  gamma: 0.1,      // conductance of O2 relative to O1
  eps1: 0.8535,    // quantum efficiency, C1 -> O1
  eps2: 0.14,      // quantum efficiency, C2 -> O2
  EChR2: 0,        // reversal potential, mV (non-selective cation channel)
  LIGHT_K: 6.0,    // eps1 * K = 5.1 /ms  =>  tau_on = 0.20 ms at full power
  peakNm: 470,     // action spectrum peak, nm (blue)
};

/* ---------------------------------------------------------------- *
 * Hodgkin-Huxley membrane (1952).
 * ---------------------------------------------------------------- */
export const HH = {
  Cm: 1.0,                       // uF/cm^2
  gNa: 120, ENa: 50,             // mS/cm^2, mV
  gK: 36, EK: -77,
  gL: 0.3, EL: -54.387,
  Vrest: -65,
  T: 20,                         // degC — sets gating speed via Q10 below
};

/** Hodgkin & Huxley's own temperature correction, Q10 = 3 from a 6.3 degC base. */
export function phi(T = HH.T) {
  return Math.pow(3, (T - 6.3) / 10);
}

/* --- HH rate functions. The three with a 0/0 point are guarded. ---------- */

export function alphaM(V) {
  const d = V + 40;
  if (Math.abs(d) < 1e-6) return 1.0;            // limit of 0.1*d/(1-exp(-d/10))
  return (0.1 * d) / (1 - Math.exp(-d / 10));
}
export function betaM(V) {
  return 4 * Math.exp(-(V + 65) / 18);
}
export function alphaH(V) {
  return 0.07 * Math.exp(-(V + 65) / 20);
}
export function betaH(V) {
  return 1 / (1 + Math.exp(-(V + 35) / 10));
}
export function alphaN(V) {
  const d = V + 55;
  if (Math.abs(d) < 1e-6) return 0.1;            // limit of 0.01*d/(1-exp(-d/10))
  return (0.01 * d) / (1 - Math.exp(-d / 10));
}
export function betaN(V) {
  return 0.125 * Math.exp(-(V + 65) / 80);
}

/** Steady-state gating values at a holding potential — used to start at rest. */
export function restingGates(V = HH.Vrest) {
  const g = (a, b) => a / (a + b);
  return {
    m: g(alphaM(V), betaM(V)),
    h: g(alphaH(V), betaH(V)),
    n: g(alphaN(V), betaN(V)),
  };
}

/**
 * Schematic ChR2 action spectrum, normalised to 1 at the peak.
 * A skewed Gaussian centred on 470 nm: broad on the blue side, falling steeply
 * past ~520 nm, which is why green and red light leave ChR2 alone. Shape is
 * illustrative; the peak wavelength is the published one.
 */
export function actionSpectrum(nm) {
  const d = nm - CHR2.peakNm;
  const width = d < 0 ? 52 : 38;                 // nm, blue side is broader
  return Math.exp(-(d * d) / (2 * width * width));
}

/**
 * Approximate sRGB for a visible wavelength (Bruton's piecewise fit).
 * Used only to colour the spectrum control honestly rather than decoratively.
 */
export function wavelengthToRGB(nm) {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 780) { r = 1; }
  // dim the far ends of the visible range, where the eye is insensitive
  let f = 1;
  if (nm >= 380 && nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40;
  else if (nm > 700 && nm <= 780) f = 0.3 + (0.7 * (780 - nm)) / 80;
  const ch = (v) => Math.round(255 * Math.pow(Math.max(0, v) * f, 0.8));
  return [ch(r), ch(g), ch(b)];
}

/* ---------------------------------------------------------------- *
 * Light pulse train
 * ---------------------------------------------------------------- */

/**
 * Pulse onsets (ms) for a train. Pulses that would start after `trainMs` are
 * dropped, so the readouts count only pulses the cell was actually given.
 */
export function pulseTrain({ freqHz, pulseMs, trainMs, startMs = 100 }) {
  const period = 1000 / freqHz;
  const out = [];
  for (let t = startMs; t <= startMs + trainMs - pulseMs + 1e-9; t += period) {
    out.push(t);
  }
  return out;
}

/** 1 while a pulse is on, 0 otherwise. */
function lightAt(t, onsets, pulseMs, cursor) {
  // onsets is sorted; cursor.i walks forward so this stays O(1) per step
  while (cursor.i < onsets.length - 1 && t >= onsets[cursor.i + 1]) cursor.i++;
  const s = onsets[cursor.i];
  return t >= s && t < s + pulseMs ? 1 : 0;
}

/* ---------------------------------------------------------------- *
 * The simulation
 * ---------------------------------------------------------------- */

export const DEFAULTS = {
  freqHz: 10,
  pulseMs: 5,
  power: 1.0,          // 0..1, fraction of saturating irradiance
  // gChR2 in mS/cm^2 — how much opsin this particular cell happened to make.
  // At 0.20 the model lands on the published panel: reliable following at
  // 5 and 10 Hz, collapse part-way through a 20 or 30 Hz train. Cells that
  // express more (0.3-0.6) follow faster trains; below ~0.15 the light never
  // reaches threshold at all.
  expression: 0.20,
  opsin: true,         // false = control cell, no channelrhodopsin
  trainMs: 1000,
  tailMs: 250,
  startMs: 100,
  dt: 0.01,            // ms
  sampleMs: 0.05,      // trace resolution kept for drawing
};

/**
 * Integrate one trial.
 *
 * Gating variables use exponential Euler (unconditionally stable); the membrane
 * voltage and the photocycle use forward Euler at dt = 0.01 ms, where the
 * fastest rate in the system (5.1 /ms) gives a step of 0.05 — comfortably small.
 *
 * Returns the sampled trace plus the derived numbers the UI reports.
 */
export function simulate(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { dt } = o;
  const totalMs = o.startMs + o.trainMs + o.tailMs;
  const steps = Math.round(totalMs / dt);
  const every = Math.max(1, Math.round(o.sampleMs / dt));
  const nOut = Math.floor(steps / every) + 1;

  const onsets = pulseTrain(o);
  const cursor = { i: 0 };
  const P = phi(HH.T);

  // state
  let V = HH.Vrest;
  const gates = restingGates(V);
  let m = gates.m, h = gates.h, n = gates.n;
  let C1 = 1, O1 = 0, O2 = 0, C2 = 0;

  // output buffers
  const tArr = new Float32Array(nOut);
  const vArr = new Float32Array(nOut);
  const iArr = new Float32Array(nOut);   // photocurrent, uA/cm^2 (negative = inward)
  const oArr = new Float32Array(nOut);   // effective open fraction
  const lArr = new Uint8Array(nOut);     // light on/off
  const spikes = [];

  const gMax = o.opsin ? o.expression : 0;
  const k1 = CHR2.eps1 * CHR2.LIGHT_K * o.power;
  const k2 = CHR2.eps2 * CHR2.LIGHT_K * o.power;

  let prevV = V;
  let w = 0;

  for (let s = 0; s <= steps; s++) {
    const t = s * dt;
    const light = lightAt(t, onsets, o.pulseMs, cursor);

    // --- channelrhodopsin photocycle ---------------------------------
    const p1 = light * k1;
    const p2 = light * k2;
    const dC1 = -p1 * C1 + CHR2.Gd1 * O1 + CHR2.Gr * C2;
    const dO1 = p1 * C1 - (CHR2.Gd1 + CHR2.e12) * O1 + CHR2.e21 * O2;
    const dO2 = p2 * C2 + CHR2.e12 * O1 - (CHR2.e21 + CHR2.Gd2) * O2;
    const dC2 = CHR2.Gd2 * O2 - (p2 + CHR2.Gr) * C2;
    C1 += dC1 * dt; O1 += dO1 * dt; O2 += dO2 * dt; C2 += dC2 * dt;

    const open = O1 + CHR2.gamma * O2;
    const iChR2 = gMax * open * (V - CHR2.EChR2);   // uA/cm^2

    // --- Hodgkin-Huxley membrane -------------------------------------
    const iNa = HH.gNa * m * m * m * h * (V - HH.ENa);
    const iK = HH.gK * n * n * n * n * (V - HH.EK);
    const iL = HH.gL * (V - HH.EL);

    prevV = V;
    V += (dt / HH.Cm) * (-iNa - iK - iL - iChR2);

    // gating, exponential Euler at the reference voltage
    const am = alphaM(prevV), bm = betaM(prevV);
    const ah = alphaH(prevV), bh = betaH(prevV);
    const an = alphaN(prevV), bn = betaN(prevV);
    const step = (x, a, b) => {
      const sum = (a + b) * P;
      const inf = a / (a + b);
      return inf + (x - inf) * Math.exp(-sum * dt);
    };
    m = step(m, am, bm);
    h = step(h, ah, bh);
    n = step(n, an, bn);

    // --- spike detection: upward crossing of 0 mV ---------------------
    if (prevV < 0 && V >= 0) spikes.push(t);

    if (s % every === 0 && w < nOut) {
      tArr[w] = t; vArr[w] = V; iArr[w] = iChR2; oArr[w] = open; lArr[w] = light;
      w++;
    }
  }

  // --- how well did the cell follow the light? ------------------------
  // A pulse "worked" if a spike began within 25 ms of its onset.
  const WINDOW = 25;
  let followed = 0;
  let firstFailure = null;
  let si = 0;
  for (const on of onsets) {
    while (si < spikes.length && spikes[si] < on) si++;
    const hit = si < spikes.length && spikes[si] < on + WINDOW;
    if (hit) { followed++; si++; }
    else if (firstFailure === null) firstFailure = on;
  }

  return {
    opts: o,
    t: tArr.subarray(0, w),
    V: vArr.subarray(0, w),
    I: iArr.subarray(0, w),
    open: oArr.subarray(0, w),
    light: lArr.subarray(0, w),
    spikes,
    onsets,
    pulses: onsets.length,
    followed,
    fidelity: onsets.length ? followed / onsets.length : 0,
    firstFailure,
    totalMs,
  };
}
