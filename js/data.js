/*
 * data.js — the single source of truth for every factual claim on this page.
 *
 * Rules for this file:
 *   1. Nothing here is invented. Every entry carries a `src` key naming where it
 *      came from (see SOURCES at the bottom for the full references).
 *   2. If a number appears on screen, it is read from here — never typed into
 *      the HTML or into a drawing routine. tests/data.test.mjs enforces that
 *      every record has a source and that the timeline is ordered.
 *   3. Modelled values (things the simulations compute) live in js/model.js and
 *      are clearly labelled as a model, not as measurements.
 */

export const PRIZE = {
  year: 2026,
  category: 'The Nobel Prize in Physiology or Medicine',
  awarder: 'The Nobel Assembly at Karolinska Institutet',
  announced: '5 October 2026',
  // Quoted verbatim from the official press release.
  citation: 'for their discoveries concerning light-gated ion channels and optogenetics',
  amount: '12 million Swedish kronor',
  amountNote: 'shared equally between the three laureates',
  committeeChair: 'Per Svenningsson',
  src: 'nobel-press',
};

export const LAUREATES = [
  {
    id: 'hegemann',
    name: 'Peter Hegemann',
    born: 1954,
    nationality: 'Germany',
    affiliation: 'Humboldt University of Berlin, Germany',
    workDoneAt: 'Max Planck Institute for Biochemistry, Martinsried, Germany',
    role: 'Asked how an alga can react to light in half a millisecond — and proposed the answer nobody believed.',
    contribution:
      'Measured the ultrafast photocurrent of the Chlamydomonas eyespot, then argued in the early 1990s ' +
      'that a single protein must both catch the light and act as the ion channel. At the time no such ' +
      'protein was known, and the idea was met with scepticism.',
    portrait: 'assets/portraits/hegemann.jpg',
    thumb: 'assets/portraits/hegemann-96.jpg',     // square crop for the 44 px hero chip
    portraitCredit: 'Millencolin, CC BY-SA 4.0, via Wikimedia Commons',
    src: 'nobel-press',
  },
  {
    id: 'nagel',
    name: 'Georg Nagel',
    born: 1953,
    nationality: 'Germany',
    affiliation: 'University of Würzburg, Germany',
    workDoneAt: 'Max Planck Institute of Biophysics, Frankfurt, Germany',
    role: 'Put the algal genes into frog eggs and watched a channel open in the light.',
    contribution:
      'Expressed the two candidate Chlamydomonas genes in frog oocytes and showed directly that the ' +
      'proteins were light-gated ion channels — channelrhodopsin-1 and channelrhodopsin-2. The same ' +
      'proteins made mammalian cells light-sensitive too.',
    portrait: 'assets/portraits/nagel.jpg',
    thumb: 'assets/portraits/nagel-96.jpg',     // square crop for the 44 px hero chip
    portraitCredit: 'Christian Wiese, CC0, via Wikimedia Commons',
    src: 'nobel-press',
  },
  {
    id: 'deisseroth',
    name: 'Karl Deisseroth',
    born: 1971,
    nationality: 'USA',
    affiliation: 'Howard Hughes Medical Institute and Stanford University, USA',
    workDoneAt: 'Stanford University, USA',
    role: 'Turned an algal protein into a switch for a neuron, then for a living brain.',
    contribution:
      'A practising psychiatrist as well as a scientist. He put the channelrhodopsin-2 gene into rat ' +
      'neurons and triggered nerve impulses with blue light (2005); two years later he was steering ' +
      'neurons through an optical fibre in the brain of a living mouse.',
    portrait: 'assets/portraits/deisseroth.jpg',
    thumb: 'assets/portraits/deisseroth-96.jpg',     // square crop for the 44 px hero chip
    portraitCredit: 'Christopher Michel, CC BY-SA 4.0, via Wikimedia Commons',
    src: 'nobel-press',
  },
];

/* ------------------------------------------------------------------ *
 * Numbers that appear as callouts in the page.
 * ------------------------------------------------------------------ */
export const FACTS = {
  eyespotLatency: {
    value: 0.5,
    unit: 'ms',
    label: 'Alga: light → electrical impulse',
    note: 'Measured by Hegemann in the Chlamydomonas eyespot with microelectrodes.',
    src: 'nobel-popular',
  },
  humanEyeLatency: {
    value: 10,
    unit: 'ms',
    comparator: 'at least',
    label: 'Human eye: light → electrical signal',
    note: 'A multi-step chemical cascade ending in an ion channel — more than twenty times slower.',
    src: 'nobel-popular',
  },
  channelOpening: {
    value: 0.2,
    unit: 'ms',
    label: 'Channelrhodopsin-2 opens',
    note: 'Time for the channel to open after a pulse of light, measured in frog egg cells.',
    src: 'nobel-popular',
  },
  brainMass: {
    value: 1.3,
    unit: 'kg',
    label: 'Mass of a human brain',
    src: 'nobel-popular',
  },
  neuronCount: {
    value: 90,
    unit: 'billion',
    comparator: 'around',
    label: 'Nerve cells in an adult human brain',
    note: 'Each forms thousands of connections with other nerve cells.',
    src: 'nobel-popular',
  },
};

/* ------------------------------------------------------------------ *
 * Timeline. `year` drives the ordering; `key` marks the turning points.
 * ------------------------------------------------------------------ */
export const TIMELINE = [
  {
    year: 1979,
    title: 'Crick names the problem',
    body:
      'Francis Crick, a decade after the double helix, turns to consciousness and points out what ' +
      'neuroscience lacks: a way to control one type of neuron while leaving every other cell alone.',
    src: 'crick-1979',
  },
  {
    year: 1992,
    title: 'Half a millisecond',
    body:
      'Hegemann measures the photocurrent of the Chlamydomonas eyespot. The response begins about ' +
      '0.5 ms after the light arrives — far too fast for the multi-step cascade in a human eye. ' +
      'He proposes that one protein does both jobs: catching light and conducting ions.',
    actor: 'hegemann',
    key: true,
    src: 'harz-1992',
  },
  {
    year: 1999,
    title: 'Crick suggests light',
    body:
      'In a lecture and a review on the impact of molecular biology on neuroscience, Crick suggests ' +
      'light as the signal: fast enough to match a nerve impulse, if only cells could be made to ' +
      'respond to it. He admits it sounds far-fetched.',
    src: 'crick-1999',
  },
  {
    year: 2002,
    title: 'Channelrhodopsin-1',
    body:
      'Nagel expresses the first of two candidate algal genes in frog egg cells. The protein turns out ' +
      'to be a light-gated proton channel. Hegemann\'s decade-old hypothesis was right.',
    actor: 'nagel',
    src: 'nagel-2002',
  },
  {
    year: 2003,
    title: 'Channelrhodopsin-2 — the one that mattered',
    body:
      'The second gene gives a light-gated cation channel that opens within 0.2 ms. Put it into human ' +
      'kidney cells or hamster cells and they become light-sensitive. Nagel and Hegemann write that it ' +
      'could be used as a tool to generate electrical impulses in cells with light.',
    actor: 'nagel',
    key: true,
    src: 'nagel-2003',
  },
  {
    year: 2005,
    title: 'A neuron obeys the light',
    body:
      'Deisseroth asks Nagel for the DNA, puts it into cultured rat neurons, and flashes blue light. ' +
      'The cells fire — on command, on the millisecond timescale, and the signal propagates to other ' +
      'neurons.',
    actor: 'deisseroth',
    key: true,
    src: 'boyden-2005',
  },
  {
    year: 2006,
    title: 'The method gets a name',
    body: 'Optogenetics: optics plus genetics. Other opsins follow, driven by different colours of light — ' +
      'some to switch neurons on, some to switch them off.',
    src: 'nobel-popular',
  },
  {
    year: 2007,
    title: 'Into a living brain',
    body:
      'Deisseroth\'s group delivers channelrhodopsin-2 to one cell type in the motor cortex of a living ' +
      'mouse and threads an optical fibre through a small hole in the skull. Light in; whiskers move. ' +
      'The same year, optogenetics is used to wake sleeping mice on cue.',
    actor: 'deisseroth',
    key: true,
    src: 'aravanis-2007',
  },
  {
    year: 2012,
    title: 'Switching on a memory',
    body:
      'With Susumu Tonegawa, Deisseroth reactivates an engram — the pattern of neurons laid down when a ' +
      'mouse learned to fear a place. The mouse shows fear with nothing to fear. It is the first proof ' +
      'that a named set of cells is enough for a specific memory.',
    actor: 'deisseroth',
    src: 'nobel-popular',
  },
  {
    year: 2021,
    title: 'A blind patient sees shapes',
    body:
      'In a clinical trial, a channelrhodopsin-like protein is placed in the retina of a person blinded ' +
      'by retinitis pigmentosa. Wearing light-emitting goggles, they can locate and grasp objects on a ' +
      'table.',
    src: 'nobel-popular',
  },
  {
    year: 2026,
    title: 'The Nobel Prize',
    body:
      'Hegemann, Nagel and Deisseroth share the Nobel Prize in Physiology or Medicine "for their ' +
      'discoveries concerning light-gated ion channels and optogenetics".',
    key: true,
    src: 'nobel-press',
  },
];

/* ------------------------------------------------------------------ *
 * What optogenetics has been used to find. Straight from the Nobel
 * Committee's popular-science background — no extrapolation.
 * ------------------------------------------------------------------ */
export const CIRCUITS = [
  { label: 'Pain', icon: 'pain' },
  { label: 'Social behaviour', icon: 'social' },
  { label: 'Thirst', icon: 'thirst' },
  { label: 'Feeding', icon: 'feeding' },
  { label: 'Reward', icon: 'reward' },
  { label: 'Attention', icon: 'attention' },
  { label: 'Circadian rhythm', icon: 'clock' },
  { label: 'Fever', icon: 'fever' },
];

export const CIRCUITS_SRC = 'nobel-popular';

export const BEYOND_BRAIN = [
  {
    title: 'The heart talks back',
    body:
      'Deisseroth has shown that forcing the heart to work harder can reinforce feelings of anxiety — ' +
      'the traffic between body and brain runs both ways.',
  },
  {
    title: 'Why sugar beats sweetener',
    body:
      'Other groups have found specific cells in the gut that help explain why some people would rather ' +
      'eat sugar than a sweetener.',
  },
  {
    title: 'Caring, taken apart',
    body:
      'When mice look after their young, separate neural circuits turn out to govern separate parts of ' +
      'the behaviour: one for gathering pups into the nest, another for grooming them.',
  },
  {
    title: 'Towards the clinic',
    body:
      'Beyond the retina trial, there is hope that cochlear implants could one day stimulate the ' +
      'auditory nerve with light instead of electricity — far more precisely than current electrodes.',
  },
];

export const BEYOND_BRAIN_SRC = 'nobel-popular';

/* ------------------------------------------------------------------ *
 * Sources. `kind` drives how each is rendered in the reference list.
 * ------------------------------------------------------------------ */
export const SOURCES = {
  'nobel-press': {
    kind: 'official',
    text: 'Press release: The Nobel Prize in Physiology or Medicine 2026',
    publisher: 'The Nobel Assembly at Karolinska Institutet, 5 October 2026',
    url: 'https://www.nobelprize.org/prizes/medicine/2026/press-release/',
  },
  'nobel-popular': {
    kind: 'official',
    text: 'Popular information: “A light-sensitive algal protein energised neuroscience”',
    publisher: 'The Nobel Committee for Physiology or Medicine, 2026',
    url: 'https://www.nobelprize.org/prizes/medicine/2026/popular-information/',
  },
  'nobel-advanced': {
    kind: 'official',
    text: 'Scientific background: “Optogenetics. Discovery of a neuronal switch”',
    publisher: 'The Nobel Committee for Physiology or Medicine, 2026',
    url: 'https://www.nobelprize.org/prizes/medicine/2026/advanced-information/',
  },
  'harz-1992': {
    kind: 'paper',
    text: 'Harz H, Nonnengässer C, Hegemann P. “The photoreceptor current of the green alga Chlamydomonas.”',
    publisher: 'Philos. Trans. R. Soc. Lond. B 338:39–52 (1992)',
    url: 'https://doi.org/10.1098/rstb.1992.0127',
  },
  'nagel-2002': {
    kind: 'paper',
    text: 'Nagel G, Ollig D, Fuhrmann M, Kateriya S, Musti AM, Bamberg E, Hegemann P. “Channelrhodopsin-1: a light-gated proton channel in green algae.”',
    publisher: 'Science 296:2395–2398 (2002)',
    url: 'https://doi.org/10.1126/science.1072068',
  },
  'nagel-2003': {
    kind: 'paper',
    text: 'Nagel G, Szellas T, Huhn W, Kateriya S, Adeishvili N, Berthold P, Ollig D, Hegemann P, Bamberg E. “Channelrhodopsin-2, a directly light-gated cation-selective membrane channel.”',
    publisher: 'PNAS 100:13940–13945 (2003)',
    url: 'https://doi.org/10.1073/pnas.1936192100',
  },
  'boyden-2005': {
    kind: 'paper',
    text: 'Boyden ES, Zhang F, Bamberg E, Nagel G, Deisseroth K. “Millisecond-timescale, genetically targeted optical control of neural activity.”',
    publisher: 'Nature Neuroscience 8:1263–1268 (2005)',
    url: 'https://doi.org/10.1038/nn1525',
  },
  'aravanis-2007': {
    kind: 'paper',
    text: 'Aravanis AM, Wang L-P, Zhang F, Meltzer LA, Mogri MZ, Schneider MB, Deisseroth K. “An optical neural interface: in vivo control of rodent motor cortex with integrated fiberoptic and optogenetic technology.”',
    publisher: 'J. Neural Eng. 4:S143–S156 (2007)',
    url: 'https://doi.org/10.1088/1741-2560/4/3/S02',
  },
  'crick-1979': {
    kind: 'paper',
    text: 'Crick FHC. “Thinking about the brain.”',
    publisher: 'Scientific American 241:219–232 (1979)',
    url: 'https://doi.org/10.1038/scientificamerican0979-219',
  },
  'crick-1999': {
    kind: 'paper',
    text: 'Crick F. “The impact of molecular biology on neuroscience.”',
    publisher: 'Philos. Trans. R. Soc. Lond. B 354:2021–2025 (1999)',
    url: 'https://doi.org/10.1098/rstb.1999.0541',
  },
  'hodgkin-1952': {
    kind: 'paper',
    text: 'Hodgkin AL, Huxley AF. “A quantitative description of membrane current and its application to conduction and excitation in nerve.”',
    publisher: 'J. Physiol. 117:500–544 (1952) — the model behind the neuron simulation on this page',
    url: 'https://doi.org/10.1113/jphysiol.1952.sp004764',
  },
  'nikolic-2009': {
    kind: 'paper',
    text: 'Nikolic K, Grossman N, Grubb MS, Burrone J, Toumazou C, Degenaar P. “Photocycles of channelrhodopsin-2.”',
    publisher: 'Photochem. Photobiol. 85:400–411 (2009) — the photocycle scheme used on this page',
    url: 'https://doi.org/10.1111/j.1751-1097.2008.00460.x',
  },
};

/** Woolf, quoted in the Nobel Committee's own popular-science background. */
export const EPIGRAPH = {
  text:
    'My own brain is to me the most unaccountable of machinery — always buzzing, humming, soaring, ' +
    'roaring, diving, and then buried in mud. And why? What’s this passion for?',
  attribution: 'Virginia Woolf, in a letter to a friend, 1932',
  src: 'nobel-popular',
};
