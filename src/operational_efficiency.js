// operational_efficiency.js
// ===========================================================================
// OPERATIONAL EFFICIENCY DASHBOARD (pillar 01)
//
// This is a COPY of the Sustainability facility dashboard's "observe -> insight"
// view (the compliance side panel + full analysis report), lifted out of
// main.js into its own self-contained module so the two pillars are fully
// INDEPENDENT. The Sustainability path in main.js is left exactly as-is.
//
// It reuses the SAME observation data (facilities.json via facilities_adapter)
// and the same honesty-framing helpers — no new data collection. Every DOM id
// it touches is `oe-` prefixed (and it uses data-oe-expand / .oe-hz-opt) so it
// never collides with the Sustainability dashboard living in the same document.
//
// Public API:
//   initOperationalEfficiency()      — wire panel/report/levers/goal/chat once
//   selectOperationalFacility(f)      — paint a facility (called by the pin click)
// ===========================================================================

import './operational_efficiency.css';
import Chart from 'chart.js/auto';
import { facilities, statusFor, headlineFor, matrixStateFor } from './facilities_adapter.js';
import { initAskAletheia } from './ask_aletheia.js';

// Status -> hex, mirroring the desaturated verdict colours (shared token set).
const STATUS_COLOR = { green: '#3F7E5E', amber: '#B5863C' };

let selectedFacility = facilities[0] || null;

const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const ICON = {
  drone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="5" cy="5" r="2.4"/><circle cx="19" cy="5" r="2.4"/><circle cx="5" cy="19" r="2.4"/><circle cx="19" cy="19" r="2.4"/><path d="M6.7 6.7l4 4M17.3 6.7l-4 4M6.7 17.3l4-4M17.3 17.3l-4-4"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/></svg>',
  inspector:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="6"/><path d="M15.4 15.4L21 21"/><path d="M8.5 11h5M11 8.5v5"/></svg>',
  ext:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" style="width:12px;height:12px"><path d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6"/></svg>'
};

// Investigate-now actions are method-agnostic (verify severity before any spend).
const investigate = [
  {id:'drone', icon:'drone', title:'Send drone — imagery + 3D point cloud', impact:'localise the source · quantify plume geometry', lead:'dispatch in 24–48 h',
   detail:'A UAV photogrammetry run ground-truths severity before any abatement spend: a 2 cm/px orthomosaic plus a colored 3D point cloud pinpoint which tank, train, or unlit flare is leaking, and at what scale.',
   stat:'Example prior survey: 47 DJI Neo frames · 4.56 M-point cloud · 2 cm/px',
   links:[{label:'2D / orthomosaic viewer', url:'https://lceuranie.github.io/DroneImageProcessing/data/visualization/viewer.html'},{label:'3D point cloud', url:'https://lceuranie.github.io/DroneImageProcessing/data/visualization/pointcloud.html'},{label:'Method', url:'https://lceuranie.github.io/project-drone-photogrammetry.html'}]},
  {id:'inspector', icon:'inspector', title:'Send field inspector — OGI survey', impact:'component-level leak detection · regulatory-grade evidence', lead:'dispatch in 3–5 days',
   detail:'An optical-gas-imaging (OGI) camera survey walks the site to tag specific leaking components, producing the audit trail a regulator or OGMP 2.0 Level-5 report needs. Slower than a drone, but evidentiary.',
   stat:'Pairs with the drone pass: drone localises, inspector confirms & tags', links:[]}
];

let trajChart = null;

// --- Projection + lever + goal scenario layer (illustrative; never a prediction) ---
const PROJ_MONTHS_DEFAULT = 12;
const PROJ_MONTHS_CAP = 60;
let PROJ_MONTHS = PROJ_MONTHS_DEFAULT;
let projHorizonMode = 'fixed';
const RAMP_MONTHS = 3;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let currentTrajFacility = null;
const activeLevers = new Set();
let userGoal = null;
let askApi = null;

const ABATE_ICON = {
  valve:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v6M7 6l5 3 5-3"/><circle cx="12" cy="14" r="5"/><path d="M12 19v2M9 21h6"/></svg>',
  vru:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="9" width="10" height="11" rx="1.5"/><path d="M14 12h4a2 2 0 0 1 2 2v6"/><path d="M9 9V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v4"/></svg>',
  leak:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="6"/><path d="M15.4 15.4 21 21"/><path d="M11 8.6c1.6 1.2 1.6 3.1 0 4.8-1.6-1.7-1.6-3.6 0-4.8Z"/></svg>',
  flare:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3c2 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.4.6-2.4 1.4-3.4C10 8.8 11 7 12 3Z"/><path d="M8 20h8"/></svg>',
};
const abatement = [
  { id:'pneumatic', icon:'valve', title:'Replace high-bleed pneumatic controllers',
    effLo:0.35, effHi:0.80, lead:6, confidence:'High',
    source:'IEA Methane Abatement' },
  { id:'vru', icon:'vru', title:'Install vapour-recovery unit (VRU)',
    effLo:0.45, effHi:0.95, lead:9, confidence:'Medium–High',
    source:'IEA Methane Abatement' },
  { id:'ldar', icon:'leak', title:'Leak detection & repair (LDAR) programme',
    effLo:0.40, effHi:0.60, lead:3, confidence:'High',
    source:'OGMP 2.0' },
  { id:'flare', icon:'flare', title:'Flare-efficiency / no-routine-flaring upgrade',
    effLo:0.50, effHi:0.98, lead:12, confidence:'Medium',
    source:'OGMP 2.0' },
];
const leverMid = l => (l.effLo + l.effHi) / 2;

function addMonths(ym, k) {
  const [y, m] = ym.split('-').map(Number);
  const idx = (y * 12 + (m - 1)) + k;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}
function monthsBetween(a, b) {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by * 12 + bm) - (ay * 12 + am);
}

function fitTrend(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, resStd: 0 };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of points) { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; }
  const denom = (n * sxx - sx * sx) || 1;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  let ss = 0;
  for (const p of points) { const e = p.y - (slope * p.x + intercept); ss += e * e; }
  return { slope, intercept, resStd: Math.sqrt(ss / n) };
}

function combinedEfficacy() {
  let keep = 1;
  abatement.forEach(l => { if (activeLevers.has(l.id)) keep *= (1 - leverMid(l)); });
  return 1 - keep;
}

function renderAbatementActions() {
  const wrap = document.getElementById('oe-abateActions');
  if (!wrap || wrap.dataset.built) return;
  abatement.forEach(a => {
    const b = document.createElement('button');
    b.className = 'actioncard abate';
    b.setAttribute('aria-pressed', 'false');
    b.dataset.lever = a.id;
    const eff = `${Math.round(a.effLo * 100)}–${Math.round(a.effHi * 100)}%`;
    b.innerHTML =
      `<div class="ac-top"><span class="ic2">${ABATE_ICON[a.icon]}</span><span class="ac-title">${a.title}</span></div>` +
      `<div class="ac-eff"><span class="eff-v">${eff}</span><span>efficacy on excess</span></div>` +
      `<div class="ac-row"><span class="cf">lead ${a.lead} mo</span><span class="pill">confidence: ${a.confidence}</span></div>` +
      `<div class="ac-src">source: ${a.source}</div>`;
    b.addEventListener('click', () => {
      const on = b.classList.toggle('active');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) activeLevers.add(a.id); else activeLevers.delete(a.id);
      updateLeverSummary();
      if (currentTrajFacility) renderTrajectory(currentTrajFacility);
    });
    wrap.appendChild(b);
  });
  wrap.dataset.built = '1';
}

function updateLeverSummary() {
  const el = document.getElementById('oe-abateSummary');
  if (!el) return;
  const n = activeLevers.size;
  if (!n) { el.textContent = 'No levers active · status-quo'; return; }
  const pct = Math.round(combinedEfficacy() * 100);
  el.textContent = `${n} lever${n > 1 ? 's' : ''} active · ~${pct}% lower excess at full effect`;
}

function renderQuantCallout(f) {
  const el = document.getElementById('oe-quantCallout');
  if (!el) return;
  const q = f.quant || {};
  if (!q.published || !q.magnitude) {
    el.className = 'quant none';
    el.innerHTML =
      `<div class="q-h">Published quantification</div>` +
      `<div class="q-mag">No published point-source figure.</div>` +
      `<div class="q-cap">${q.note || 'No detectable enhancement above local background.'}</div>`;
    return;
  }
  el.className = 'quant';
  el.innerHTML =
    `<div class="q-h">Published quantification · cited, not derived</div>` +
    `<div class="q-mag">${q.magnitude}</div>` +
    `<div class="q-src">${q.source}${q.method ? ` · ${q.method}` : ''}</div>` +
    `<div class="q-cap">${q.note}</div>`;
}

function renderInvestigateActions() {
  const wrap = document.getElementById('oe-verifyActions');
  if (!wrap || wrap.dataset.built) return;
  investigate.forEach(a => {
    const b = document.createElement('button');
    b.className = 'actioncard verify';
    b.setAttribute('aria-expanded', 'false');
    b.innerHTML = `<div class="ac-top"><span class="ic2">${ICON[a.icon]}</span><span class="ac-title">${a.title}</span></div>
      <div class="ac-impact">${a.impact}</div><div class="ac-row"><span class="cf">${a.lead}</span><span>verification step</span></div>
      <div class="ac-detail"><div>${a.detail}</div>${a.links.length?`<div class="out">${a.links.map(l=>`<a class="link" href="${l.url}" target="_blank" rel="noopener">${l.label} ${ICON.ext}</a>`).join('')}</div>`:''}<div class="stat">${a.stat}</div></div>`;
    b.addEventListener('click', e => { if (e.target.closest('a')) return; const open = b.classList.toggle('open'); b.setAttribute('aria-expanded', open); });
    wrap.appendChild(b);
  });
  wrap.dataset.built = '1';
}

function renderTrajectory(f) {
  currentTrajFacility = f;
  const BAND = 'rgba(181,134,60,.16)';
  // Cool-slate tint for the measured excess above background — a different
  // hue/opacity from the warm uncertainty BAND so the two are never confused.
  const EXCESS = 'rgba(86,124,156,.22)';

  const obsLabels = f.trajectory.map(t => t.month);
  const obsData = f.trajectory.map(t => t.ch4);

  const lastIdxObs = [...obsData].map((v, i) => (v != null ? i : -1)).filter(i => i >= 0).pop();
  const haveAnchor = lastIdxObs != null && lastIdxObs >= 0;

  PROJ_MONTHS = PROJ_MONTHS_DEFAULT;
  if (projHorizonMode === 'goal' && userGoal && haveAnchor) {
    PROJ_MONTHS = Math.max(1, Math.min(PROJ_MONTHS_CAP,
      monthsBetween(obsLabels[lastIdxObs], `${userGoal.year}-12`)));
  }

  const futureLabels = [];
  if (haveAnchor) {
    for (let k = 1; k <= PROJ_MONTHS; k++) futureLabels.push(addMonths(obsLabels[lastIdxObs], k));
  }
  const labels = obsLabels.concat(futureLabels);
  const N = labels.length;
  const anchorIdx = lastIdxObs;
  const anchorVal = haveAnchor ? obsData[lastIdxObs] : null;

  const bkgd = (f.bkgdCh4 != null) ? f.bkgdCh4
    : Math.min(...obsData.filter(v => v != null));

  const pts = obsData.map((y, x) => ({ x, y })).filter(p => p.y != null);
  const { slope, resStd } = fitTrend(pts);

  const proj = new Array(N).fill(null);
  const bandLo = new Array(N).fill(null);
  const bandHi = new Array(N).fill(null);
  const bent = new Array(N).fill(null);
  const goal = new Array(N).fill(null);

  const anyLever = activeLevers.size > 0;
  const showGoal = !!userGoal;
  const enhAnchor = haveAnchor ? (anchorVal - bkgd) : 0;

  let goalSlopeEnh = 0, goalMonthsTotal = 0;
  if (showGoal && haveAnchor) {
    goalMonthsTotal = Math.max(1, monthsBetween(obsLabels[anchorIdx], `${userGoal.year}-12`));
    const enhTarget = enhAnchor * (1 - userGoal.pct / 100);
    goalSlopeEnh = (enhTarget - enhAnchor) / goalMonthsTotal;
  }

  if (haveAnchor) {
    proj[anchorIdx] = anchorVal;
    bandLo[anchorIdx] = anchorVal; bandHi[anchorIdx] = anchorVal;
    if (anyLever) bent[anchorIdx] = anchorVal;
    if (showGoal) goal[anchorIdx] = anchorVal;

    for (let j = anchorIdx + 1; j < N; j++) {
      const s = j - anchorIdx;
      const pv = anchorVal + slope * s;
      proj[j] = pv;
      const BAND_K = 0.6; const hw = resStd * Math.sqrt(s) * BAND_K;
      bandLo[j] = pv - hw; bandHi[j] = pv + hw;

      if (anyLever) {
        let keep = 1;
        abatement.forEach(l => {
          if (!activeLevers.has(l.id)) return;
          const phase = Math.max(0, Math.min(1, (s - l.lead) / RAMP_MONTHS));
          keep *= (1 - leverMid(l) * phase);
        });
        bent[j] = bkgd + (pv - bkgd) * keep;
      }
      if (showGoal) goal[j] = bkgd + (enhAnchor + goalSlopeEnh * s);
    }
  }

  const mkLine = (label, data, color, opts = {}) => ({
    label, data, borderColor: color, backgroundColor: color,
    borderWidth: opts.w ?? 2, pointRadius: opts.pr ?? 0, pointHoverRadius: opts.pr ? 3 : 0,
    borderDash: opts.dash || [], spanGaps: opts.span ?? false, tension: opts.t ?? 0.25,
    fill: opts.fill ?? false, order: opts.order ?? 5,
  });

  const obsLine = obsData.concat(new Array(futureLabels.length).fill(null));
  const datasets = [
    { ...mkLine('band-lo', bandLo, 'transparent', { order: 9 }), pointHitRadius: 0 },
    { ...mkLine('Uncertainty band', bandHi, 'transparent', { order: 9, fill: '-1' }), backgroundColor: BAND, pointHitRadius: 0 },
    // background / clean-reference floor — darkened + thickened for legibility.
    mkLine('Background · measured clean reference', new Array(N).fill(bkgd), css('--muted'),
      { w: 2, dash: [5, 4], t: 0, order: 6 }),
    // flat cool-slate tint = concentration excess above background, distinct from BAND.
    { ...mkLine('Excess above background', obsLine, 'transparent', { t: 0.35, order: 7 }),
      backgroundColor: EXCESS, fill: { target: 2, above: EXCESS, below: 'transparent' }, pointHitRadius: 0 },
    mkLine('Projection · status-quo', proj, css('--amber-soft'), { dash: [6, 5], order: 4 }),
    mkLine('Observed (satellite)', obsLine, css('--amber'), { w: 2.6, pr: 2.6, t: 0.35, order: 1 }),
  ];
  if (anyLever) datasets.push(mkLine('With selected levers', bent, css('--green'), { dash: [5, 4], w: 2.4, order: 2 }));
  if (showGoal) datasets.push(mkLine('Goal line (your target)', goal, css('--muted'), { dash: [2, 4], w: 2, order: 3 }));

  const HIDE_IN_TIP = new Set(['band-lo', 'Uncertainty band', 'Excess above background']);

  if (trajChart) {
    trajChart.data.labels = labels;
    trajChart.data.datasets = datasets;
    trajChart.update(reduceMotion ? 'none' : undefined);
  } else {
    trajChart = new Chart(document.getElementById('oe-chart'), {
      type: 'line', data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: reduceMotion ? false : { duration: 500, easing: 'easeOutCubic' },
        interaction: { mode: 'index', intersect: false }, layout: { padding: { top: 14, right: 6 } },
        scales: {
          x: { grid: { color: 'rgba(40,50,63,.5)', drawTicks: false }, ticks: { color: css('--faint'), font: { family: 'IBM Plex Mono', size: 10 }, maxRotation: 0, autoSkipPadding: 8 }, border: { color: css('--line') } },
          y: { grid: { color: 'rgba(40,50,63,.4)' }, ticks: { color: css('--faint'), font: { family: 'IBM Plex Mono', size: 10 }, callback: v => v.toFixed(0) }, border: { display: false },
               title: { display: true, text: 'CH₄ column (ppb)', color: css('--faint'), font: { family: 'IBM Plex Mono', size: 10 } } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#FFFFFF', borderColor: css('--line'), borderWidth: 1, titleColor: css('--text'), bodyColor: css('--text'),
            titleFont: { family: 'IBM Plex Mono', size: 11 }, bodyFont: { family: 'IBM Plex Mono', size: 11 }, padding: 10,
            filter: c => !HIDE_IN_TIP.has(c.dataset.label),
            callbacks: { label: c => c.parsed.y == null ? '' : ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)} ppb` } }
        }
      }
    });
  }

  const lgAb = document.getElementById('oe-lg-abated'); if (lgAb) lgAb.hidden = !anyLever;
  const lgTg = document.getElementById('oe-lg-target'); if (lgTg) lgTg.hidden = !showGoal;

  const latest = haveAnchor ? f.trajectory[anchorIdx] : null;
  const yv = document.getElementById('oe-yendVal'); if (yv) yv.textContent = latest ? `${latest.ch4.toFixed(1)} ppb` : '—';
  const yn = document.getElementById('oe-yendNote'); if (yn) yn.textContent = latest ? `most recent cloud-free month · ${latest.month}` : 'no cloud-free month in window';
}

// ===========================================================================
// SERVICE CATALOGUE (manifest-driven) — public/operational_efficiency.json
//
// Honesty rules (non-negotiable): render ONLY what the manifest states. A
// service shows band/value/trend/rank ONLY when status === 'populated'. A
// 'pending' service shows label + source + trace and a neutral "not yet
// screened" pill — no band, no value, no trend, no rank. Nothing is computed
// or invented: every displayed string comes straight from the manifest. No
// currency, no tonnages, no "% of throughput". Every new id/class is oe-svc-
// prefixed so it can never collide with the observation dashboard, the
// Sustainability pillar, or Asset Security.
// ===========================================================================
let oeManifest = null;
let oeManifestPromise = null;

// Wasted-value pricing state. Money appears ONLY on the flaring card (measured
// VIIRS BCM × a user-editable reference price). oePrice persists across site
// switches so a user's chosen assumption sticks; it defaults to the manifest's
// value_basis price on first load.
let oeValueBasis = null;
let oePrice = null;

// Load + cache the manifest once; reuse the cached object across selections.
function loadOpEffManifest() {
  if (oeManifest) return Promise.resolve(oeManifest);
  if (oeManifestPromise) return oeManifestPromise;
  oeManifestPromise = fetch('/operational_efficiency.json')
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(m => { oeManifest = m; return m; })
    .catch(err => {
      console.warn('[op-eff] could not load service catalogue manifest:', err);
      oeManifestPromise = null;
      return null;
    });
  return oeManifestPromise;
}

// Match a facility view-model to a manifest site. Tiers: exact id, then
// case-insensitive name, then tolerant id/name containment (facility ids are
// slugified — e.g. "permian-basin-delaware" must still match manifest "permian").
function matchOpEffSite(f, manifest) {
  if (!f || !manifest || !Array.isArray(manifest.sites)) return null;
  const fid = (f.id || '').toLowerCase();
  const fname = (f.name || '').toLowerCase();
  let s = manifest.sites.find(x => (x.id || '').toLowerCase() === fid);
  if (s) return s;
  s = manifest.sites.find(x => (x.name || '').toLowerCase() === fname);
  if (s) return s;
  return manifest.sites.find(x => {
    const sid = (x.id || '').toLowerCase();
    return sid && (fid.startsWith(sid + '-') || fid.includes(sid) || fname.includes(sid));
  }) || null;
}

// Tabler-style outline glyphs (this file already ships inline SVGs rather than a
// font; no emoji). trend: up/down/flat; route: trace marker.
const OE_SVC_ICON = {
  up:    '<svg class="oe-svc-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7 7 17"/><path d="M8 7h9v9"/></svg>',
  down:  '<svg class="oe-svc-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m7 7 10 10"/><path d="M17 8v9h-9"/></svg>',
  flat:  '<svg class="oe-svc-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>',
  route: '<svg class="oe-svc-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h6a4 4 0 0 1 4 4v4"/></svg>',
};
const OE_BAND_WORD = { low: 'Low', medium: 'Medium', high: 'High' };
const oeEsc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function oeTrace(svc) {
  return `<div class="oe-svc-trace">${OE_SVC_ICON.route}<span>${oeEsc(svc.trace)}</span></div>`;
}

// Compact wasted-value formatter: >= $1M -> "$12.2M/yr", else "$NNk/yr".
function oeFormatUsd(value) {
  return value >= 1e6
    ? '$' + (value / 1e6).toFixed(1) + 'M/yr'
    : '$' + Math.round(value / 1e3) + 'k/yr';
}

// Wasted-value line for the FLARING card only. Flaring is burned gas with a
// MEASURED volume, so value = volume × price is defensible. flared_bcm === 0
// shows an absolute "no flaring to recover" state, never "$0.00". This is the
// ONLY place money is rendered — never on venting or any other card.
function oeFlareValueHTML(svc) {
  const bcm = svc.flared_bcm;
  if (!(bcm > 0)) {
    return `<div class="oe-svc-value-usd zero" data-oe-bcm="0">` +
      `<span class="oe-svc-usd-fig">≈$0/yr — no flaring to recover</span></div>`;
  }
  const value = bcm * oeValueBasis.bcm_to_mmbtu * oePrice;
  return `<div class="oe-svc-value-usd" data-oe-bcm="${bcm}" data-oe-attr="${oeEsc(svc.attribution || '')}">` +
    `<span class="oe-svc-usd-fig">≈${oeFormatUsd(value)}</span>` +
    `<span class="oe-svc-usd-ref">${oeEsc(svc.attribution || '')}, at $${Number(oePrice).toFixed(2)}/MMBtu reference</span>` +
    `</div>`;
}

function oeServiceCard(svc) {
  // PENDING — muted state: label + source + trace only. Never a value/band/trend/rank.
  if (svc.status !== 'populated') {
    return `<div class="oe-svc-card pending">` +
      `<div class="oe-svc-top"><span class="oe-svc-label">${oeEsc(svc.label)}</span>` +
      `<span class="oe-svc-source">${oeEsc(svc.source)}</span></div>` +
      `<div class="oe-svc-bandrow"><span class="oe-svc-pill pending">Pending — not yet screened</span></div>` +
      oeTrace(svc) + `</div>`;
  }
  // POPULATED — render exactly what the manifest carries.
  const bandCls = svc.band || 'low';
  const word = OE_BAND_WORD[svc.band] || '—';
  const trend = (svc.trend && OE_SVC_ICON[svc.trend])
    ? `<span class="oe-svc-trend">${OE_SVC_ICON[svc.trend]}</span>` : '';
  const metaBits = [svc.persistence, svc.estate_rank ? `estate ${svc.estate_rank}` : null].filter(Boolean);
  const meta = metaBits.length ? `<div class="oe-svc-meta">${oeEsc(metaBits.join(' · '))}</div>` : '';
  const value = svc.value ? `<div class="oe-svc-value">${oeEsc(svc.value)}</div>` : '';
  // Money lives ONLY on the flaring card, just under the band, and only when a
  // measured flared volume is present (0 -> the absolute "no flaring" state).
  const flareVal = (svc.id === 'flaring' && typeof svc.flared_bcm === 'number' && oeValueBasis)
    ? oeFlareValueHTML(svc) : '';
  return `<div class="oe-svc-card">` +
    `<div class="oe-svc-top"><span class="oe-svc-label">${oeEsc(svc.label)}</span>` +
    `<span class="oe-svc-source">${oeEsc(svc.source)}</span></div>` +
    `<div class="oe-svc-bandrow"><span class="oe-svc-pill ${bandCls}">${word}</span>${trend}</div>` +
    flareVal + value + meta + oeTrace(svc) + `</div>`;
}

function oeHeroCard(hero) {
  const band = (hero && hero.band) || 'low';
  return `<div class="oe-svc-hero ${band}">` +
    `<div class="oe-svc-hero-title">${oeEsc(hero && hero.title)}</div>` +
    `<div class="oe-svc-hero-line">${oeEsc(hero && hero.line)}</div></div>`;
}

function oeEstateStrip(manifest, currentId) {
  const rows = (manifest.estate || []).map((e, i) => {
    const active = e.id === currentId ? ' active' : '';
    const word = OE_BAND_WORD[e.band] || '—';
    return `<div class="oe-svc-erow${active}">` +
      `<span class="oe-svc-enum">${i + 1}</span>` +
      `<span class="oe-svc-ename">${oeEsc(e.name)}</span>` +
      `<span class="oe-svc-pill ${e.band || 'low'}">${word}</span>` +
      `<span class="oe-svc-enote">${oeEsc(e.note)}</span></div>`;
  }).join('');
  return `<div class="oe-svc-estate">${rows}</div>`;
}

// Inline gas-price control + value caveat, shown just under the principle chips.
// The price is a user assumption (default from value_basis); changing it updates
// every flaring card's wasted-value figure live.
function oePriceControl(vb) {
  if (!vb) return '';
  return `<div class="oe-svc-pricebar">` +
      `<label class="oe-svc-price-l" for="oe-svc-price">Gas price (reference)</label>` +
      `<input id="oe-svc-price" class="num oe-svc-price" type="number" step="0.1" min="0" ` +
        `value="${oeEsc(String(oePrice))}" aria-label="Gas price reference, US dollars per MMBtu">` +
      `<span class="oe-svc-price-suf">/MMBtu</span>` +
      `<span class="oe-svc-price-note">${oeEsc(vb.gas_price_label)} · your assumption</span>` +
    `</div>` +
    (vb.note ? `<div class="oe-svc-price-caveat">${oeEsc(vb.note)}</div>` : '');
}

function buildServiceCatalogue(manifest, site) {
  const chips = (manifest.governing_principles || [])
    .map(p => `<span class="oe-svc-chip">${oeEsc(p)}</span>`).join('');
  const services = (site.services || []).map(oeServiceCard).join('');
  const caveats = (manifest.global_caveats || [])
    .map(c => `<li class="oe-svc-caveat">${oeEsc(c)}</li>`).join('');
  return `<div class="oe-svc-head">Service catalogue` +
      `<span class="oe-svc-sub">screening-grade · ${oeEsc(site.name)}</span></div>` +
    `<div class="oe-svc-principles">${chips}</div>` +
    oePriceControl(manifest.value_basis) +
    oeHeroCard(site.hero) +
    `<div class="oe-svc-grid">${services}</div>` +
    `<div class="oe-svc-estate-h">Estate ranking</div>` +
    oeEstateStrip(manifest, site.id) +
    `<ul class="oe-svc-caveats">${caveats}</ul>`;
}

// Paint the catalogue section in the full-analysis report for facility f.
function renderServiceCatalogue(f) {
  const root = document.getElementById('oe-svc-root');
  if (!root) return;
  loadOpEffManifest().then(manifest => {
    if (!manifest) { root.hidden = true; root.innerHTML = ''; return; }
    const site = matchOpEffSite(f, manifest);
    if (!site) {
      console.warn(`[op-eff] no manifest site matched facility "${f && f.name}" (id="${f && f.id}")`);
      root.hidden = true; root.innerHTML = '';
      return;
    }
    // Pricing state: capture value_basis and seed the price from its default on
    // first load (user edits afterwards persist across site switches).
    oeValueBasis = manifest.value_basis || null;
    if (oePrice == null && oeValueBasis) oePrice = Number(oeValueBasis.gas_price_default_usd_per_mmbtu);

    root.innerHTML = buildServiceCatalogue(manifest, site);
    root.hidden = false;
    oeWirePriceControl();
  });
}

// Recompute every flaring card's wasted-value figure from the current price.
// The flared_bcm === 0 line ("no flaring to recover") never changes.
function oeRecomputeFlareValues() {
  if (!oeValueBasis) return;
  document.querySelectorAll('#oe-svc-root .oe-svc-value-usd').forEach(el => {
    const bcm = parseFloat(el.dataset.oeBcm);
    if (!(bcm > 0)) return;
    const value = bcm * oeValueBasis.bcm_to_mmbtu * oePrice;
    const fig = el.querySelector('.oe-svc-usd-fig');
    const ref = el.querySelector('.oe-svc-usd-ref');
    if (fig) fig.textContent = '≈' + oeFormatUsd(value);
    if (ref) ref.textContent = `${el.dataset.oeAttr || ''}, at $${Number(oePrice).toFixed(2)}/MMBtu reference`;
  });
}

function oeWirePriceControl() {
  const input = document.getElementById('oe-svc-price');
  if (!input) return;
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    if (!Number.isNaN(v) && v >= 0) { oePrice = v; oeRecomputeFlareValues(); }
  });
}

// Paint the one-line hero teaser (band chip + title) in the observe side panel.
function renderServiceTeaser(f) {
  const el = document.getElementById('oe-svc-teaser');
  if (!el) return;
  loadOpEffManifest().then(manifest => {
    const site = manifest && matchOpEffSite(f, manifest);
    if (!site || !site.hero) { el.hidden = true; el.innerHTML = ''; return; }
    const band = site.hero.band || 'low';
    const word = OE_BAND_WORD[band] || '—';
    el.innerHTML = `<span class="oe-svc-pill ${band}">${word}</span>` +
      `<span class="oe-svc-teaser-title">${oeEsc(site.hero.title)}</span>`;
    el.hidden = false;
  });
}

function renderReport(f) {
  if (!f) return;
  renderInvestigateActions();
  renderAbatementActions();
  updateLeverSummary();

  const status = statusFor(f.verdict);
  const color = STATUS_COLOR[status.tone] || '#F2B53B';
  const ring = status.tone === 'green' ? css('--green') : css('--amber');

  // --- header ---
  document.getElementById('oe-rep-name').textContent = f.name;
  const attn = document.getElementById('oe-attn');
  attn.textContent = status.word; attn.style.borderColor = color; attn.style.color = color; attn.style.background = color + '14';
  document.getElementById('oe-rep-operator').innerHTML = `Operator <b>${f.operator}</b>`;
  document.getElementById('oe-rep-region').textContent = f.region;
  document.getElementById('oe-rep-aoi').innerHTML = `AOI <b class="num">${f.lat.toFixed(3)}°, ${f.lon.toFixed(3)}°</b>`;
  document.getElementById('oe-rep-updated').textContent = `Last fused: ${f.generated} · ${f.basisLabel}`;

  // --- verdict badge ---
  const bd = document.getElementById('oe-badgeDot'); bd.style.background = color; bd.style.boxShadow = `0 0 0 5px ${color}22`;
  document.getElementById('oe-badgeBar').style.background = color;
  document.getElementById('oe-badgeWord').textContent = status.word;
  document.getElementById('oe-badgeSub').innerHTML = `${f.basisLabel} · <b>${status.sub}</b>`;

  // --- headline ---
  document.getElementById('oe-rep-headline').innerHTML = headlineFor(f);
  const bi = document.getElementById('oe-rep-basis-inline'); if (bi) bi.textContent = f.comparisonName;

  // --- Output 1: flare x methane 2x2 matrix ---
  const m = matrixStateFor(f);
  document.querySelectorAll('#oe-rep-matrix [data-cell]').forEach(cell => {
    const isActive = cell.dataset.cell === m.cell;
    cell.classList.toggle('active', isActive);
    const old = cell.querySelector('.now'); if (old) old.remove();
    if (isActive) {
      cell.style.boxShadow = `0 0 0 2px ${ring}`;
      cell.style.borderColor = ring;
      const tag = document.createElement('span'); tag.className = 'now'; tag.textContent = 'NOW';
      tag.style.background = ring; tag.style.color = '#0C1116';
      cell.prepend(tag);
    } else {
      cell.style.boxShadow = ''; cell.style.borderColor = '';
    }
  });
  const o1v = document.getElementById('oe-rep-o1-verdict');
  const o1s = document.getElementById('oe-rep-o1-sub');
  if (f.verdict === 'performant') {
    o1v.innerHTML = `Operating <span class="em-green">cleanly</span> — ${m.label.toLowerCase()}.`;
    o1s.textContent = 'Methane sits at local background and flaring is negligible — there is no excess to explain.';
  } else if (m.cell === 'flare-high') {
    // Korpezhe's methane is a near-threshold signal (clears 2σ in only 1 of 6
    // years), so the combustion read is softened to an indicative cue: it must
    // not overclaim, and it must not contradict the service catalogue, which
    // still lists combustion screening as pending. Other flare-high sites (e.g.
    // Permian, which clears 2σ every year) keep the firmer read.
    const nearThreshold = f.id === 'korpezhe' || /korpezhe/i.test(f.name || '');
    if (nearThreshold) {
      o1v.innerHTML = `Possible incomplete combustion — <span class="em-amber">indicative</span>.`;
      o1s.textContent = 'Flaring is detected and methane sits modestly above background, but the methane enhancement is near the detection threshold (clears 2σ in 1 of 6 years) — a screening cue, not a confirmed verdict.';
    } else {
      o1v.innerHTML = `Likely <span class="em-amber">${m.label.toLowerCase()}</span>.`;
      o1s.textContent = 'Methane is elevated and flaring is detected — combustion looks incomplete.';
    }
  } else {
    o1v.innerHTML = `Likely <span class="em-amber">${m.label.toLowerCase()}</span>.`;
    o1s.textContent = 'Methane is elevated with little or no detected flaring — gas may be escaping uncombusted.';
  }

  // --- Output 2: co-pollutant & combustion-signal inventory ---
  const xind  = document.getElementById('oe-rep-xind');
  const o2v   = document.getElementById('oe-rep-o2-verdict');
  const o2s   = document.getElementById('oe-rep-o2-sub');
  const xconc = document.getElementById('oe-rep-xconc');

  const expo = v => (v != null ? `${v.toExponential(2)} mol/m²` : '—');
  const gRow = (gas, sensor, value, cls) =>
    `<div class="grow"><span class="gname">${gas}</span>` +
    `<span class="gsensor">${sensor}</span>` +
    `<span class="gstate ${cls}">${value}</span></div>`;

  xind.innerHTML = [
    gRow('CH₄', 'TROPOMI XCH₄', f.siteCh4 != null ? `${f.siteCh4.toFixed(1)} ppb` : 'retrieved', 'ok'),
    gRow('Flaring', 'VIIRS Nightfire', f.flaringBcm != null ? `${f.flaringBcm} BCM/yr` : '—', 'ok'),
    f.isBasin ? gRow('NO₂', 'TROPOMI', 'N/A · basin method', 'na')
              : gRow('NO₂', 'TROPOMI', expo(f.no2), 'ok'),
    f.isBasin ? gRow('CO',  'TROPOMI', 'N/A · basin method', 'na')
              : gRow('CO',  'TROPOMI', expo(f.co), 'ok'),
    gRow('SO₂',  'TROPOMI', 'not yet ingested', 'planned'),
    gRow('HCHO', 'TROPOMI', 'not yet ingested', 'planned'),
  ].join('');

  if (f.isBasin) {
    o2v.innerHTML = `Co-pollutant inventory · <span class="em-amber">basin</span> snapshot.`;
    o2s.textContent = 'CH₄ and flaring are retrieved; NO₂ / CO need the point-facility method.';
    xconc.innerHTML = 'A basin enhancement is assessed against a clean reference region; per-pixel NO₂/CO attribution is not part of this method, so they are shown as <b>N/A</b> rather than invented. SO₂ and HCHO are in the TROPOMI suite but <b>not yet ingested</b> into our pipeline.';
  } else {
    o2v.innerHTML = `Co-pollutant inventory · <span class="em-green">facility</span> snapshot.`;
    o2s.textContent = 'CH₄, flaring, NO₂ and CO retrieved over the site.';
    xconc.innerHTML = 'NO₂ and CO are absolute satellite column readings — we deliberately do <b>not</b> label them “elevated” without a calibrated per-site baseline, since inventing one would breach our honesty rule. SO₂ and HCHO are in the TROPOMI suite but <b>not yet ingested</b> into our pipeline.';
  }

  // --- Output 3: observed vs background readout ---
  const ro = document.getElementById('oe-rep-readout');
  const siteLabel = f.isBasin ? 'Target region CH₄' : 'Site CH₄';
  const refLabel = f.isBasin ? 'Clean reference CH₄' : 'Local background CH₄';
  ro.innerHTML =
    `<div class="lrow"><span class="lname">${siteLabel}<span class="obs">14-day TROPOMI composite</span></span><span></span><span class="ld">${f.siteCh4 != null ? f.siteCh4.toFixed(1) + ' ppb' : '—'}</span></div>` +
    `<div class="lrow"><span class="lname">${refLabel}</span><span></span><span class="ld">${f.bkgdCh4 != null ? f.bkgdCh4.toFixed(1) + ' ppb' : '—'}</span></div>` +
    `<div class="lrow"><span class="lname">Excess / enhancement<span class="obs">concentration, not intensity</span></span><span></span><span class="ld">${f.excessPct >= 0 ? '+' : ''}${f.excessPct}%</span></div>` +
    `<div class="lrow"><span class="lname">Flaring<span class="obs">VIIRS Nightfire 2024</span></span><span></span><span class="ld">${f.flaringBcm != null ? f.flaringBcm + ' BCM/yr' : '—'}</span></div>`;
  const lagg = document.getElementById('oe-rep-lagg');
  lagg.innerHTML =
    `<div><span class="at">Methane excess</span></div>` +
    `<div style="text-align:right"><span class="av" style="color:${ring}">${f.excessPct >= 0 ? '+' : ''}${f.excessPct}%</span></div>` +
    `<div style="grid-column:1/3"><span class="as">${f.basisLabel} · concentration excess above baseline, not % of throughput</span></div>`;
  lagg.style.background = status.tone === 'green' ? 'rgba(70,194,102,.05)' : 'rgba(242,181,59,.05)';
  lagg.style.borderColor = status.tone === 'green' ? 'rgba(70,194,102,.25)' : 'rgba(242,181,59,.25)';
  document.getElementById('oe-rep-o3-verdict').innerHTML = f.verdict === 'performant'
    ? `Observed methane is <span class="em-green">at background</span>.`
    : `Observed methane is <span class="em-amber">above ${f.comparisonName}</span>.`;
  document.getElementById('oe-rep-o3-sub').textContent =
    `Measured ${f.basisLabel}. No operator-reported figure exists yet, so there is no disclosure comparison — only observation vs reference.`;

  // --- trajectory + projection / lever / goal overlays ---
  renderTrajectory(f);

  // --- published-quantification callout (cited) ---
  renderQuantCallout(f);

  // --- keep "Ask Aletheia" grounded on the current facility ---
  askApi?.refresh();

  // --- provenance footer ---
  document.getElementById('oe-rep-footer').innerHTML =
    `<b>Source:</b> ${f.source}. <b>Generated:</b> ${f.generated}. ${f.note} ` +
    `The defensible comparison today is observed-vs-${f.isBasin ? 'reference' : 'background'}; ` +
    `operator-reported baselines (annual reports, OGMP 2.0 / GMP / IEA targets) are a separate future workstream and are not shown.`;

  // --- service catalogue (manifest-driven, below the observation content) ---
  renderServiceCatalogue(f);
}

// Populate + open the observe-step side panel from a facility view-model.
function renderPanel(f) {
  const panel = document.getElementById('operational-panel');
  const status = statusFor(f.verdict);
  const color = STATUS_COLOR[status.tone] || '#F2B53B';
  document.getElementById('oe-cp-name').textContent = f.name;
  document.getElementById('oe-cp-chips').innerHTML =
    `<span class="badge">${f.operator}</span>` +
    `<span class="badge">${f.region}</span>` +
    `<span class="badge">${f.basisLabel}</span>`;
  document.getElementById('oe-cp-status-dot').style.background = color;
  const word = document.getElementById('oe-cp-status-word');
  word.textContent = status.word;
  word.style.color = color;
  document.getElementById('oe-cp-headline').innerHTML = headlineFor(f);
  renderServiceTeaser(f);
  panel.classList.remove('hidden');
}

// Public: paint a facility (called by the pillar-01 pin click in main.js).
export function selectOperationalFacility(f) {
  selectedFacility = f;
  renderPanel(f);
  renderReport(f);
}

// ---------- Ask Aletheia drawer (independent oe- instance) ----------
function wireAskDrawer() {
  const askFab = document.getElementById('oe-askFab');
  const askCloseBtn = document.getElementById('oe-askClose');
  const askDrawer = document.getElementById('oe-askPanel');
  const askToggleEl = document.getElementById('oe-askToggle');
  const askBodyEl = document.getElementById('oe-askBody');

  function openAskDrawer() {
    askDrawer?.classList.add('open');
    askDrawer?.setAttribute('aria-hidden', 'false');
    if (askFab) askFab.hidden = true;
    if (askBodyEl?.hidden && askToggleEl) askToggleEl.click();
  }
  function closeAskDrawer() {
    askDrawer?.classList.remove('open');
    askDrawer?.setAttribute('aria-hidden', 'true');
    if (askFab) askFab.hidden = false;
  }
  askFab?.addEventListener('click', openAskDrawer);
  askCloseBtn?.addEventListener('click', closeAskDrawer);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && askDrawer?.classList.contains('open')) closeAskDrawer();
  });

  askApi = initAskAletheia({
    getContext: () => ({
      f: currentTrajFacility,
      scenario: {
        levers: abatement.filter(l => activeLevers.has(l.id)),
        combinedEff: combinedEfficacy(),
        userGoal,
        projMonths: PROJ_MONTHS,
      },
    }),
    ids: {
      toggle: 'oe-askToggle', body: 'oe-askBody', log: 'oe-askLog', seeds: 'oe-askSeeds',
      form: 'oe-askForm', input: 'oe-askInput', mode: 'oe-askMode', grounding: 'oe-askGrounding',
    },
  });

  // Scope the launcher to the report modal only.
  if (askFab) askFab.hidden = true;
  const reportModal = document.getElementById('operational-report-modal');
  if (reportModal) {
    const syncAskFabToModal = () => {
      const modalOpen = reportModal.classList.contains('open');
      if (!modalOpen) {
        closeAskDrawer();
        if (askFab) askFab.hidden = true;
      } else if (askFab) {
        askFab.hidden = askDrawer?.classList.contains('open') ? true : false;
      }
    };
    new MutationObserver(syncAskFabToModal)
      .observe(reportModal, { attributes: true, attributeFilter: ['class'] });
    syncAskFabToModal();
  }
}

// ---------- one-time wiring ----------
let initialised = false;
export function initOperationalEfficiency() {
  if (initialised) return;
  initialised = true;

  // Side panel close
  document.getElementById('oe-cp-close')?.addEventListener('click', () =>
    document.getElementById('operational-panel')?.classList.add('hidden'));

  // Open / close the full report modal
  document.getElementById('oe-btn-open-report')?.addEventListener('click', () => {
    const modal = document.getElementById('operational-report-modal');
    if (selectedFacility) renderReport(selectedFacility);
    if (modal) modal.classList.add('open');
  });
  document.getElementById('oe-btn-close-report')?.addEventListener('click', () => {
    const modal = document.getElementById('operational-report-modal');
    if (modal) modal.classList.remove('open');
  });

  // Interpretation-card expanders (data-oe-expand so main.js's [data-expand] never binds these)
  document.querySelectorAll('[data-oe-expand]').forEach(t => {
    t.addEventListener('click', () => {
      const b = t.nextElementSibling; const open = b.classList.toggle('open');
      t.setAttribute('aria-expanded', open);
      const ch = t.querySelector('.chev'); if (ch) ch.classList.toggle('rot', open);
    });
  });

  // Abatement lever "Reset"
  document.getElementById('oe-abateReset')?.addEventListener('click', () => {
    activeLevers.clear();
    document.querySelectorAll('#oe-abateActions .actioncard.abate').forEach(b => {
      b.classList.remove('active'); b.setAttribute('aria-pressed', 'false');
    });
    updateLeverSummary();
    if (currentTrajFacility) renderTrajectory(currentTrajFacility);
  });

  // User-entered goal line
  const goalPct = document.getElementById('oe-goalPct');
  const goalYear = document.getElementById('oe-goalYear');
  const goalClearBtn = document.getElementById('oe-goalClear');
  const goalCap = document.getElementById('oe-goalCap');

  document.getElementById('oe-goalApply')?.addEventListener('click', () => {
    const pct = Number(goalPct?.value) || 30;
    const year = Number(goalYear?.value) || 2030;
    userGoal = { pct, year };
    if (goalClearBtn) goalClearBtn.hidden = false;
    if (goalCap) goalCap.textContent =
      `Goal line: −${pct}% excess by ${year} · set by user, not an operator disclosure. ` +
      `Drawn as a glide path from the latest observed point; the window shows the first ${PROJ_MONTHS} months of that path.`;
    if (currentTrajFacility) renderTrajectory(currentTrajFacility);
  });

  goalClearBtn?.addEventListener('click', () => {
    userGoal = null;
    if (goalPct) goalPct.value = '';
    if (goalYear) goalYear.value = '';
    goalClearBtn.hidden = true;
    if (goalCap) goalCap.textContent =
      'Default: −30% by 2030 · Global Methane Pledge. Goal line set by user · not an operator disclosure.';
    if (currentTrajFacility) renderTrajectory(currentTrajFacility);
  });

  // Projection-horizon toggle (.oe-hz-opt so main.js's .hz-opt binding never touches these)
  document.querySelectorAll('.oe-hz-opt').forEach(btn =>
    btn.addEventListener('click', () => {
      projHorizonMode = btn.dataset.horizon;
      document.querySelectorAll('.oe-hz-opt').forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (currentTrajFacility) renderTrajectory(currentTrajFacility);
    }));

  wireAskDrawer();

  // Render the default selection so the report is populated before any pin click.
  renderReport(selectedFacility);
}
