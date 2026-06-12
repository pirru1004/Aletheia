// facilities_adapter.js
// Single point that turns the real pipeline output (pipeline/facilities.json)
// into the view-model the dashboard renders. All honesty rules from the
// ALETHEIA_HANDOFF (section A4) live here so they are applied in exactly one place:
//   - facility vs basin snapshots have DIFFERENT keys (handle both shapes)
//   - our metric is concentration excess / enhancement, NOT methane intensity
//   - never fabricate a missing field (basin has no NO2/CO -> null)
//
// Do NOT plug excessPct into any "intensity vs disclosure" slot. There is no
// reported/disclosure baseline in the data; the defensible comparison is
// observed-vs-background (facility) / observed-vs-reference (basin).

import facilitiesRaw from '../pipeline/facilities.json';

// Build a stable id from the name (Korpezhe -> "korpezhe").
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Normalise one record (either "facility" or "basin" method) into one shape.
function adapt(raw) {
  const snap = raw.snapshot || {};
  const isBasin = raw.method === 'basin';

  // Concentration readings: facility uses methane_site/bkgd; basin uses
  // target/reference. Keep them under one pair of names but remember which.
  const siteCh4 = isBasin ? snap.target_ch4_ppb : snap.methane_site_ppb;
  const bkgdCh4 = isBasin ? snap.reference_ch4_ppb : snap.methane_bkgd_ppb;

  // Headline number: enhancement_pct (basin) / methane_excess_pct (facility).
  // Prefer the top-level methane_excess_pct, falling back to the snapshot.
  const excessPct = raw.methane_excess_pct ??
    (isBasin ? snap.enhancement_pct : snap.methane_excess_pct);

  return {
    id: slugify(raw.name),
    name: raw.name,
    operator: raw.operator,
    region: raw.region,
    method: raw.method,                 // 'facility' | 'basin'
    isBasin,
    isReferenceSite: !!raw.is_reference_site,

    lat: snap.lat,
    lon: snap.lon,

    verdict: raw.verdict,               // 'performant' | 'progress'
    excessPct,                          // signed %, e.g. -0.109, 0.624, 2.411

    siteCh4,                            // ppb (site or basin target)
    bkgdCh4,                            // ppb (background or clean reference)

    // NO2 / CO only exist for facility snapshots. Basin -> null (never invent).
    no2: isBasin ? null : (snap.no2_mol_m2 ?? null),
    co: isBasin ? null : (snap.co_mol_m2 ?? null),

    flaringBcm: raw.flaring_bcm_yr ?? null,

    // trajectory months with methane_ppb === null are GAPS, not zeros.
    trajectory: (raw.trajectory || []).map(t => ({ month: t.month, ch4: t.methane_ppb })),

    source: raw.source,
    generated: raw.generated,
    note: raw.note,

    // Published-quantification callout (A4 — CITED, not derived). These are
    // magnitudes from the peer-reviewed literature (point-source instruments),
    // NOT outputs of our TROPOMI screening pipeline. null where none exists.
    quant: {
      published: !!raw.quantification_published,
      magnitude: raw.quantification_magnitude ?? null,
      source: raw.quantification_source ?? null,
      method: raw.quantification_method ?? null,
      note: raw.quantification_note ?? '',
    },

    // What the excess is measured against (A4.4 — label the method).
    basisLabel: isBasin ? 'basin · vs clean reference' : 'facility · vs local background',
    comparisonName: isBasin ? 'clean reference' : 'local background',
  };
}

// ---- derived honesty helpers (verdict-driven, no fabrication) ----

// Map verdict -> status presentation. 'alert' tier is reserved for the future.
export function statusFor(verdict) {
  switch (verdict) {
    case 'performant':
      return { key: 'good', word: 'No action', tone: 'green', sub: 'no excess detected' };
    case 'progress':
      return { key: 'watch', word: 'Investigate', tone: 'amber', sub: 'elevated vs baseline' };
    default:
      return { key: 'watch', word: 'Review', tone: 'amber', sub: '' };
  }
}

// Reframed headline (A4.1) — concentration excess, never "intensity vs disclosure".
export function headlineFor(f) {
  const pct = f.excessPct;
  const mag = Math.abs(pct).toFixed(pct % 1 === 0 ? 0 : (Math.abs(pct) < 1 ? 1 : 2));
  if (f.isBasin) {
    return `Observed methane shows a ${mag}% enhancement vs a clean reference region.`;
  }
  // facility
  if (pct < 0.15 && pct > -0.5) {
    // effectively at background (covers Groundbirch's -0.1%)
    return `Observed methane sits at local background — no excess detected (${pct > 0 ? '+' : ''}${pct}%).`;
  }
  return `Observed methane is ${pct > 0 ? '+' : ''}${mag}% ${pct >= 0 ? 'above' : 'below'} local background.`;
}

// Which cell of the flare-vs-methane 2x2 the data lands on (A4.2).
// performant -> low-methane quadrant (idle / clean), progress -> high-methane.
export function matrixStateFor(f) {
  const flareLit = (f.flaringBcm ?? 0) > 0.001;       // VIIRS detected meaningful flaring
  const highMethane = f.verdict === 'progress';        // excess above baseline
  if (highMethane) {
    return flareLit
      ? { cell: 'flare-high', label: 'Poor combustion', desc: 'incomplete burn', tone: 'amber' }
      : { cell: 'noflare-high', label: 'Venting / leak', desc: 'or unlit flare', tone: 'amber' };
  }
  // performant / low methane
  return flareLit
    ? { cell: 'flare-low', label: 'Burning cleanly', desc: 'efficient combustion', tone: 'green' }
    : { cell: 'noflare-low', label: 'Site idle', desc: 'genuinely inactive · no excess', tone: 'green' };
}

export const facilities = facilitiesRaw.map(adapt);

export function facilityById(id) {
  return facilities.find(f => f.id === id) || null;
}
