/*
 * Checks on the simulation. Run with: node --test
 *
 * These are not snapshot tests of whatever the code happens to do today. Each
 * one pins a claim the page makes to the reader, so that if the model drifts,
 * the page stops being true and a test goes red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simulate, DEFAULTS, CHR2, HH, phi, restingGates,
  alphaM, alphaN, betaM, alphaH, betaH, betaN, actionSpectrum, wavelengthToRGB, pulseTrain,
  gatingTable,
} from '../js/model.js';

/* --------------------- Hodgkin-Huxley internals --------------------- */

test('the removable singularities in the HH rate functions are handled', () => {
  // alphaM is 0/0 at V = -40, alphaN at V = -55. Naive code returns NaN.
  assert.ok(Number.isFinite(alphaM(-40)), 'alphaM(-40) must be finite');
  assert.ok(Number.isFinite(alphaN(-55)), 'alphaN(-55) must be finite');
  assert.ok(Math.abs(alphaM(-40) - 1.0) < 1e-3, 'alphaM(-40) -> 1.0');
  assert.ok(Math.abs(alphaN(-55) - 0.1) < 1e-4, 'alphaN(-55) -> 0.1');
  // and they are continuous through the hole
  assert.ok(Math.abs(alphaM(-40.001) - alphaM(-39.999)) < 1e-3);
  assert.ok(Math.abs(alphaN(-55.001) - alphaN(-54.999)) < 1e-4);
});

test('the cell sits still when nothing is done to it', () => {
  const g = restingGates(HH.Vrest);
  for (const k of ['m', 'h', 'n']) {
    assert.ok(g[k] > 0 && g[k] < 1, `${k} gate should be a fraction`);
  }
  // no light at all: a resting cell must not drift or fire
  const r = simulate({ opsin: false });
  assert.equal(r.spikes.length, 0);
  let maxDrift = 0;
  for (let i = 0; i < r.V.length; i++) maxDrift = Math.max(maxDrift, Math.abs(r.V[i] - HH.Vrest));
  assert.ok(maxDrift < 0.5, `resting potential drifted ${maxDrift.toFixed(2)} mV`);
});

test('the temperature factor is Hodgkin and Huxley\'s own Q10 = 3', () => {
  assert.ok(Math.abs(phi(6.3) - 1) < 1e-9, 'phi is 1 at the reference temperature');
  assert.ok(Math.abs(phi(16.3) - 3) < 1e-9, 'phi triples per 10 degrees');
});

/* ------------------------- channelrhodopsin ------------------------- */

test('the channel opens with the ~0.2 ms time constant the page quotes', () => {
  // the page states 0.2 ms; that comes from eps1 * LIGHT_K at full power
  const tauOn = 1 / (CHR2.eps1 * CHR2.LIGHT_K);
  assert.ok(Math.abs(tauOn - 0.2) < 0.02, `tau_on = ${tauOn.toFixed(3)} ms, expected ~0.2`);
});

test('the action spectrum peaks in the blue and ignores red', () => {
  assert.equal(actionSpectrum(CHR2.peakNm), 1);
  assert.ok(actionSpectrum(470) > actionSpectrum(430));
  assert.ok(actionSpectrum(470) > actionSpectrum(540));
  assert.ok(actionSpectrum(620) < 0.02, 'red light should barely drive ChR2');
  // monotonic away from the peak in both directions
  for (let nm = 400; nm < CHR2.peakNm; nm += 5) {
    assert.ok(actionSpectrum(nm) <= actionSpectrum(nm + 5) + 1e-9);
  }
  for (let nm = CHR2.peakNm; nm < 650; nm += 5) {
    assert.ok(actionSpectrum(nm) >= actionSpectrum(nm + 5) - 1e-9);
  }
});

test('wavelength-to-colour stays in gamut and is blue at 470 nm', () => {
  for (let nm = 380; nm <= 780; nm += 5) {
    const c = wavelengthToRGB(nm);
    assert.equal(c.length, 3);
    for (const v of c) {
      assert.ok(Number.isFinite(v) && v >= 0 && v <= 255, `channel ${v} out of range at ${nm}`);
    }
  }
  const [r, g, b] = wavelengthToRGB(470);
  assert.ok(b > g && g > r, '470 nm should read as blue');
  const [rr, , bb] = wavelengthToRGB(650);
  assert.ok(rr > bb, '650 nm should read as red');
});

test('a sustained flash gives a peak that sags to a lower plateau', () => {
  // The peak/plateau ratio is the signature of channelrhodopsin-2 and the
  // thing Act II is built to show. Published steady-state is a third to a
  // half of peak; anything outside that means the photocycle is wrong.
  const r = simulate({ freqHz: 1, pulseMs: 1000, trainMs: 1000, tailMs: 50 });
  let peak = 0;
  for (let i = 0; i < r.open.length && r.t[i] < 300; i++) peak = Math.max(peak, r.open[i]);
  let plateau = 0;
  for (let i = 0; i < r.open.length; i++) if (r.t[i] > 1050 && r.t[i] < 1090) plateau = Math.max(plateau, r.open[i]);
  assert.ok(peak > 0.8, `peak open fraction ${peak.toFixed(2)} should be most of the population`);
  const ratio = plateau / peak;
  assert.ok(ratio > 0.25 && ratio < 0.55, `plateau/peak = ${ratio.toFixed(2)}, expected 0.25-0.55`);
});

/* ----------------------------- the train ---------------------------- */

test('pulse trains do not run past the end of the stimulus window', () => {
  for (const freqHz of [1, 5, 10, 20, 37, 60]) {
    const onsets = pulseTrain({ freqHz, pulseMs: 5, trainMs: 1000, startMs: 100 });
    assert.ok(onsets.length > 0);
    const last = onsets[onsets.length - 1];
    assert.ok(last + 5 <= 100 + 1000 + 1e-6, `${freqHz} Hz: a pulse ran past the train`);
    assert.equal(onsets.length, freqHz, `${freqHz} Hz over 1 s should give ${freqHz} pulses`);
  }
});

/* ----------------- the three claims Act III makes ------------------- */

test('claim 1: a control cell with no opsin does nothing', () => {
  const r = simulate({ opsin: false, freqHz: 10, power: 1 });
  assert.equal(r.spikes.length, 0);
  assert.equal(r.fidelity, 0);
  // abs(), not === 0: with gChR2 at zero the product is a negative zero, which
  // assert.strict treats as a different value from 0.
  for (let i = 0; i < r.I.length; i++) {
    assert.ok(Math.abs(r.I[i]) < 1e-12, 'no opsin means no photocurrent');
  }
});

test('claim 2: at the default settings every pulse gives exactly one spike', () => {
  const r = simulate();                        // page defaults
  assert.equal(r.pulses, DEFAULTS.freqHz);
  assert.equal(r.spikes.length, r.pulses, 'one spike per pulse');
  assert.equal(r.fidelity, 1);
  assert.equal(r.firstFailure, null);
  // and the spike follows the light closely — this is the millisecond-timescale
  // control the 2005 paper was named for
  for (let i = 0; i < r.onsets.length; i++) {
    const lag = r.spikes[i] - r.onsets[i];
    assert.ok(lag > 0 && lag < 10, `spike ${i} lagged ${lag.toFixed(2)} ms`);
  }
});

test('claim 3: too little opsin leaves the cell below threshold', () => {
  const r = simulate({ expression: 0.08 });
  assert.equal(r.spikes.length, 0, 'should be subthreshold');
  let peak = 0;
  for (let i = 0; i < r.I.length; i++) peak = Math.max(peak, -r.I[i]);
  assert.ok(peak > 0, 'but current should still be flowing');
});

test('claim 4: driving too fast makes the cell give out part-way through', () => {
  // The page tells the reader the cell follows a while and then stops. If this
  // ever becomes "fails immediately" or "never fails", the copy is wrong.
  const r = simulate({ freqHz: 20, pulseMs: 5 });
  assert.ok(r.spikes.length >= 2, 'it should manage several spikes first');
  assert.ok(r.fidelity < 0.5, 'but not follow the whole train');
  assert.ok(r.firstFailure !== null && r.firstFailure > r.opts.startMs,
    'and the failure should come after it has been working');
});

test('following degrades monotonically as the drive gets faster', () => {
  let prev = 1.01;
  for (const freqHz of [5, 10, 20, 30, 50]) {
    const f = simulate({ freqHz, pulseMs: 5 }).fidelity;
    assert.ok(f <= prev + 1e-9, `fidelity rose from ${prev} to ${f} at ${freqHz} Hz`);
    prev = f;
  }
});

test('more opsin, or more light, never makes following worse', () => {
  let prev = -1;
  for (const expression of [0.1, 0.15, 0.2, 0.25, 0.3]) {
    const f = simulate({ freqHz: 10, expression }).fidelity;
    assert.ok(f >= prev - 1e-9, `fidelity fell at expression ${expression}`);
    prev = f;
  }
  prev = -1;
  for (const power of [0.05, 0.1, 0.3, 0.6, 1.0]) {
    const f = simulate({ freqHz: 10, power }).fidelity;
    assert.ok(f >= prev - 1e-9, `fidelity fell at power ${power}`);
    prev = f;
  }
});

/* ------------------------- numerical health ------------------------- */

test('the answer does not depend on the time step', () => {
  // If halving dt changed the result, the figure would be an artefact of the
  // integrator rather than of the biology.
  const at = (dt) => [5, 10, 20, 30].map((freqHz) => simulate({ freqHz, dt }).fidelity);
  const coarse = at(0.02);
  const fine = at(0.005);
  for (let i = 0; i < coarse.length; i++) {
    assert.ok(Math.abs(coarse[i] - fine[i]) < 0.12,
      `fidelity moved from ${coarse[i]} to ${fine[i]} when dt changed`);
  }
});

test('no NaNs, and the voltage stays in a physiological range', () => {
  for (const o of [{}, { freqHz: 60, pulseMs: 20 }, { power: 0.02 }, { expression: 0.6 }, { opsin: false }]) {
    const r = simulate(o);
    for (let i = 0; i < r.V.length; i++) {
      assert.ok(Number.isFinite(r.V[i]), `NaN voltage with ${JSON.stringify(o)}`);
      assert.ok(r.V[i] > -120 && r.V[i] < 80, `V = ${r.V[i]} with ${JSON.stringify(o)}`);
      assert.ok(Number.isFinite(r.I[i]), `NaN current with ${JSON.stringify(o)}`);
      assert.ok(r.open[i] >= -1e-6 && r.open[i] <= 1 + 1e-6,
        `open fraction ${r.open[i]} out of range`);
    }
  }
});

test('the photocycle conserves probability', () => {
  // C1 + O1 + O2 + C2 must stay at 1. It is not exposed directly, but the open
  // fraction can never exceed 1, and a long hard drive is where drift shows up.
  const r = simulate({ freqHz: 60, pulseMs: 15, trainMs: 1000, power: 1 });
  let maxOpen = 0;
  for (let i = 0; i < r.open.length; i++) maxOpen = Math.max(maxOpen, r.open[i]);
  assert.ok(maxOpen <= 1.0001, `open fraction reached ${maxOpen}`);
});

test('spike counting and the follow count agree with each other', () => {
  for (const freqHz of [5, 10, 20, 30]) {
    const r = simulate({ freqHz });
    assert.ok(r.followed <= r.spikes.length, 'cannot follow more pulses than there were spikes');
    assert.ok(r.followed <= r.pulses, 'cannot follow more pulses than were delivered');
    assert.ok(Math.abs(r.fidelity - r.followed / r.pulses) < 1e-9);
  }
});

/* ---------------------- the gating-rate table ------------------------ */

test('the gating table holds the published rate functions, not an approximation of them', () => {
  // Each grid point must be exactly what the HH equations give there; only the
  // values between grid points are interpolated.
  const dt = DEFAULTS.dt, P = phi(HH.T);
  const tab = gatingTable(dt, P);
  const pairs = [[alphaM, betaM], [alphaH, betaH], [alphaN, betaN]];
  for (const v of [-100, -77.5, -65, -55, -40, -12.34, 0, 30, 60]) {
    const i = Math.round((v + 100) / 0.01);
    pairs.forEach(([a, b], k) => {
      const A = a(-100 + i * 0.01), B = b(-100 + i * 0.01);
      assert.ok(Math.abs(tab[i * 6 + 2 * k] - A / (A + B)) < 1e-12, `steady state ${k} at ${v} mV`);
      assert.ok(Math.abs(tab[i * 6 + 2 * k + 1] - Math.exp(-(A + B) * P * dt)) < 1e-12,
        `decay factor ${k} at ${v} mV`);
    });
  }
});

test('interpolating the table changes no spike and no number on the page', () => {
  // The table exists only to make a run several times cheaper. It must not
  // move a single spike or any readout relative to evaluating the equations
  // exactly at every step. Covers the presets, both failure modes and a
  // control cell.
  const settings = [
    {}, { freqHz: 5 }, { freqHz: 20 }, { freqHz: 30 }, { freqHz: 60, pulseMs: 20 },
    { expression: 0.08 }, { expression: 0.15 }, { expression: 0.6, freqHz: 40 },
    { power: 0.1 }, { power: 0.5, pulseMs: 1 }, { opsin: false },
    { freqHz: 1, pulseMs: 1000, trainMs: 1000, tailMs: 50 },
  ];
  for (const o of settings) {
    const fast = simulate(o), exact = simulate({ ...o, rateTable: false });
    const what = JSON.stringify(o);
    assert.equal(fast.spikes.length, exact.spikes.length, `spike count differs for ${what}`);
    for (let i = 0; i < fast.spikes.length; i++) {
      assert.ok(Math.abs(fast.spikes[i] - exact.spikes[i]) <= DEFAULTS.dt + 1e-9,
        `spike ${i} moved for ${what}`);
    }
    assert.equal(fast.followed, exact.followed, `follow count differs for ${what}`);
    assert.equal(fast.firstFailure, exact.firstFailure, `failure time differs for ${what}`);
    let maxDV = 0;
    for (let i = 0; i < fast.V.length; i++) maxDV = Math.max(maxDV, Math.abs(fast.V[i] - exact.V[i]));
    assert.ok(maxDV < 0.5, `voltage trace moved by ${maxDV.toFixed(3)} mV for ${what}`);
  }
});
