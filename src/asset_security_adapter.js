// asset_security_adapter.js
// Single point that loads the Asset Security manifest (pipeline/asset_security.json)
// and exposes it to the dashboard. Mirrors facilities_adapter.js in spirit: all the
// honesty framing already lives in the manifest (method_label, metric_mode,
// metric_summary, metric_note, global_caveats) — this module only reads it, it
// invents nothing. If a site's metric_series is empty there is simply no number.

import manifest from '../pipeline/asset_security.json';

export const assetPillar = {
  name: manifest.pillar,
  subtitle: manifest.subtitle,
  caveats: manifest.global_caveats || [],
};

export const assetSites = manifest.sites || [];

// Human label for a frame's window: "a" = early-season, "b" = late-season.
export function windowLabel(window) {
  return window === 'a' ? 'early' : 'late';
}

// Caption text for a frame, e.g. "2019 · early".
export function frameCaption(frame) {
  return `${frame.year} · ${windowLabel(frame.window)}`;
}

// The compliance map's pins come from facilities.json (the Sustainability sites),
// which sit at the same physical locations as these Asset Security sites but carry
// slightly different names/coordinates. Match a clicked map pin to its Asset
// Security site by nearest coordinate so the two pillars share one map.
export function assetSiteByNearest(lat, lon) {
  let best = null;
  let bestDist = Infinity;
  for (const s of assetSites) {
    const d = (s.lat - lat) ** 2 + (s.lon - lon) ** 2;
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}

export function assetSiteById(id) {
  return assetSites.find(s => s.id === id) || null;
}

// The metric_series is keyed by year (one row per year, both windows share it).
// Returns the row for a given year, or null when the site is visual-only / has no row.
export function metricForYear(site, year) {
  if (!site || !Array.isArray(site.metric_series)) return null;
  return site.metric_series.find(m => m.year === year) || null;
}
