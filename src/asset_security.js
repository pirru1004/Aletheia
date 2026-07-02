// asset_security.js
// "02 Asset Security" pillar dashboard. Observational, never accusatory: it shows
// a facility's physical footprint over time from pre-exported Sentinel-2 composites.
// All content is driven by pipeline/asset_security.json (via asset_security_adapter)
// — nothing per-site is hardcoded here. Static images only; no Earth Engine at runtime.
//
// Honesty rules baked in (see manifest global_caveats):
//   - "reference date" is a TEMPORAL reference, never a disclosure baseline.
//   - quantified sites show km² from the manifest series; visual-only sites show
//     NO km² and NO chart — the time-lapse is the evidence.
//   - we never imply comparison to operator-disclosed footprint.

import './asset_security.css';
import { assetPillar, frameCaption, windowLabel, metricForYear } from './asset_security_adapter.js';
import { setGrounding, clearGrounding } from './ask_grounding.js';

// Build the Ask Aletheia grounding view-model for an Asset Security site. Asset
// records are FOOTPRINT-shaped (not methane), so we tag the pillar/method and pass
// only real manifest fields. ask_aletheia.js routes this to a footprint-only
// responder — no methane/TROPOMI framing or invented numbers leak in.
function assetAskContext(s) {
  return () => ({
    f: {
      ...s,
      pillar: 'Asset Security',
      method: 'asset-security',
      name: s.name,
      basisLabel: s.method_label,   // shown in the "Grounded on: …" line + greeting
      note: s.metric_summary,       // footprint responder falls back to this
    },
    scenario: {},
  });
}

const PLAY_MS = 750; // auto-advance cadence (single view)

// NDBI palette legend — maps the exact colours baked into the exported NDBI PNGs.
// Reused by both the single view and (per-pane) the Compare view.
const NDBI_PALETTE = [
  { color: '#2F6B4B', label: 'Vegetation (low NDBI)' },
  { color: '#9C988E', label: 'Bare soil' },
  { color: '#EF9F27', label: 'Disturbed / cleared' },
  { color: '#C0641C', label: 'Built-up (high NDBI)' },
];
const NDBI_LEGEND_NOTE =
  'Built-up index — most distinct where vegetation surrounds the site ' +
  '(e.g. Groundbirch); in desert, bare ground reads high too.';

// Builds the legend markup. Caller controls when it is shown (NDBI layer only).
function ndbiLegendHtml() {
  const rows = NDBI_PALETTE.map(p =>
    `<li class="as-legend-row">
       <span class="as-legend-swatch" style="background:${p.color}"></span>
       <span class="as-legend-label">${escapeHtml(p.label)}</span>
     </li>`).join('');
  return `
    <div class="as-legend" aria-label="NDBI palette legend">
      <ul class="as-legend-rows">${rows}</ul>
      <p class="as-legend-note">${escapeHtml(NDBI_LEGEND_NOTE)}</p>
    </div>`;
}

// ---- module state (no localStorage/sessionStorage — all in memory) ----
let site = null;
let viewMode = 'single';      // 'single' | 'compare'  (compare wired in step 3)
let frameIdx = 0;             // 0..13 index into site.frames
let layer = 'rgb';            // 'rgb' | 'ndbi'
let playing = false;
let playTimer = null;

// Compare-view state. Each pane is fully independent (own frame + own layer).
// `reference` names the pane holding the REFERENCE DATE marker (temporal, not a
// disclosure baseline). Initialised by initCompare() when Compare opens.
let cmp = null;

let overlay = null;           // root overlay element (created once, reused)

// ---------------------------------------------------------------------------
// Overlay scaffold — created once, then re-rendered per open.
// ---------------------------------------------------------------------------
function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'asset-modal';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <button class="as-close" id="as-close" type="button" aria-label="Back to map">&times;</button>
    <div class="as-wrap" id="as-wrap"></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#as-close').addEventListener('click', closeAssetDashboard);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeAssetDashboard();
  });
  return overlay;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function openAssetDashboard(s) {
  if (!s) return;
  site = s;
  viewMode = 'single';
  frameIdx = 0;
  layer = 'rgb';
  stopPlay();
  ensureOverlay();
  renderShell();
  update();
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  // Facility dashboard open -> ground the shared Ask Aletheia chat on THIS site.
  setGrounding(assetAskContext(s));
}

export function closeAssetDashboard() {
  stopPlay();
  closeFlagDialog();
  if (overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
  // Left the dashboard -> clear grounding (hides launcher + closes drawer).
  clearGrounding();
}

// ---------------------------------------------------------------------------
// Render: full structure for the current site + view mode.
// ---------------------------------------------------------------------------
function renderShell() {
  const wrap = overlay.querySelector('#as-wrap');
  const quantified = site.metric_mode === 'quantified';
  const tagClass = quantified ? 'as-tag--quantified' : 'as-tag--visual';

  wrap.innerHTML = `
    <header class="as-header">
      <div class="as-head-main">
        <span class="as-pillar-eyebrow">02 · Asset Security</span>
        <h1 class="as-name">${escapeHtml(site.name)}</h1>
        <div class="as-meta">
          <span>${escapeHtml(site.operator)}</span>
          <span class="as-dot">·</span>
          <span>${escapeHtml(site.basin)}</span>
          <span class="as-dot">·</span>
          <span class="num">${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}</span>
        </div>
      </div>
      <div class="as-head-tag">
        <span class="as-tag ${tagClass}">${escapeHtml(site.method_label)}</span>
      </div>
    </header>

    <div class="as-modes" role="tablist" aria-label="View mode">
      <button class="as-mode-btn" data-mode="single" role="tab">Single</button>
      <button class="as-mode-btn" data-mode="compare" role="tab">Compare</button>
    </div>

    <div class="as-body">
      <section class="as-viewer" id="as-viewer"></section>
      <aside class="as-side" id="as-side">
        <div id="as-metric"></div>
        <div class="as-flag-wrap">
          <button class="as-flag-btn" id="as-flag-btn" type="button">
            <span class="as-flag-btn-label">Flag &amp; request inspection</span>
            <span class="as-flag-btn-tag">Roadmap concept</span>
          </button>
          <p class="as-flag-btn-note">Concept — closing the loop from satellite observation to ground-truth. Not wired to any field-ops system.</p>
        </div>
      </aside>
    </div>

    <footer class="as-caveats" id="as-caveats"></footer>`;

  // mode toggle (Compare is step 3 — present but flagged not-yet-built)
  wrap.querySelectorAll('.as-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === viewMode);
    btn.setAttribute('aria-selected', btn.dataset.mode === viewMode ? 'true' : 'false');
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  if (viewMode === 'compare') renderCompare();
  else renderViewer();
  renderCaveats();

  wrap.querySelector('#as-flag-btn')?.addEventListener('click', openFlagDialog);
}

function setMode(mode) {
  if (mode === viewMode) return;
  stopPlay();
  viewMode = mode;
  if (mode === 'compare') initCompare();
  renderShell();
  if (mode === 'compare') updateCompare();
  else update();
}

// ---------------------------------------------------------------------------
// Single view: image fills the frame, time slider over all frames,
// play/pause, RGB/NDBI toggle, year·window caption.
// ---------------------------------------------------------------------------
function renderViewer() {
  const viewer = overlay.querySelector('#as-viewer');
  const n = site.frames.length;
  viewer.innerHTML = `
    <div class="as-stage">
      <img class="as-img" id="as-img" alt="" draggable="false" />
      <div class="as-caption" id="as-caption"></div>
      <div class="as-layer-toggle" role="group" aria-label="Imagery layer">
        <button class="as-lyr" data-layer="rgb" type="button">RGB</button>
        <button class="as-lyr" data-layer="ndbi" type="button">NDBI</button>
      </div>
      ${ndbiLegendHtml()}
    </div>
    <div class="as-controls">
      <button class="as-play" id="as-play" type="button" aria-label="Play timelapse"></button>
      <input class="as-slider" id="as-slider" type="range" min="0" max="${n - 1}" step="1" value="${frameIdx}"
             aria-label="Time frame" />
      <span class="as-frame-readout num" id="as-frame-readout"></span>
    </div>
    <div class="as-ticks" id="as-ticks"></div>`;

  // year tick labels (one per year, under the slider)
  const ticks = viewer.querySelector('#as-ticks');
  const years = [...new Set(site.frames.map(f => f.year))];
  ticks.innerHTML = years.map(y => `<span class="num">${y}</span>`).join('');

  viewer.querySelectorAll('.as-lyr').forEach(b =>
    b.addEventListener('click', () => { layer = b.dataset.layer; update(); }));
  viewer.querySelector('#as-play').addEventListener('click', togglePlay);
  viewer.querySelector('#as-slider').addEventListener('input', (e) => {
    stopPlay();
    frameIdx = Number(e.target.value);
    update();
  });
}

// ---------------------------------------------------------------------------
// Compare view — two independent panes overlaid in one stage with a draggable
// swipe divider. Out-of-the-box gesture: earliest (left) vs latest (right).
// Each pane keeps its own frame + RGB/NDBI layer; one pane holds the
// REFERENCE DATE marker (a temporal reference, never a disclosure baseline).
// ---------------------------------------------------------------------------
function initCompare() {
  // Default left = earliest usable frame (2019 late / "b"); right = latest frame.
  const minYear = Math.min(...site.frames.map(f => f.year));
  let li = site.frames.findIndex(f => f.year === minYear && f.window === 'b');
  if (li < 0) li = 0;
  cmp = {
    left:  { idx: li, layer: 'rgb' },
    right: { idx: site.frames.length - 1, layer: 'rgb' },
    divider: 50,        // %: top (left) pane clipped from the left edge to here
    reference: 'left',  // default reference = earliest pane
  };
}

// <option> list of all 14 frames for a pane's frame selector.
function frameOptions(selIdx) {
  return site.frames.map((f, i) =>
    `<option value="${i}"${i === selIdx ? ' selected' : ''}>${f.year} · ${windowLabel(f.window)}</option>`
  ).join('');
}

// One pane's control card (frame selector, layer toggle, reference button).
function paneControls(pane) {
  const st = cmp[pane];
  const title = pane === 'left' ? 'Left pane' : 'Right pane';
  return `
    <div class="as-cmp-pane" data-pane="${pane}">
      <div class="as-cmp-pane-head">
        <span class="as-cmp-pane-title">${title}</span>
        <span class="as-cmp-ref-pill" data-ref-pill>reference date</span>
      </div>
      <label class="as-cmp-field">
        <span class="as-cmp-field-label">Frame</span>
        <select class="as-cmp-frame" data-pane="${pane}" aria-label="${title} frame">
          ${frameOptions(st.idx)}
        </select>
      </label>
      <div class="as-cmp-layer" role="group" aria-label="${title} imagery layer">
        <button class="as-cmp-lyr" data-pane="${pane}" data-layer="rgb" type="button">RGB</button>
        <button class="as-cmp-lyr" data-pane="${pane}" data-layer="ndbi" type="button">NDBI</button>
      </div>
      <button class="as-cmp-setref" data-pane="${pane}" type="button">Set as reference date</button>
    </div>`;
}

function renderCompare() {
  const viewer = overlay.querySelector('#as-viewer');
  viewer.innerHTML = `
    <div class="as-cmp-stage" id="as-cmp-stage">
      <img class="as-cmp-img" id="as-cmp-img-right" alt="" draggable="false" />
      <div class="as-cmp-clip" id="as-cmp-clip">
        <img class="as-cmp-img" id="as-cmp-img-left" alt="" draggable="false" />
      </div>

      <div class="as-cmp-tag as-cmp-tag--left">
        <span class="as-cmp-cap" id="as-cmp-cap-left"></span>
        <span class="as-cmp-badge" id="as-cmp-badge-left">Reference date</span>
      </div>
      <div class="as-cmp-tag as-cmp-tag--right">
        <span class="as-cmp-cap" id="as-cmp-cap-right"></span>
        <span class="as-cmp-badge" id="as-cmp-badge-right">Reference date</span>
      </div>

      <div class="as-cmp-legend as-cmp-legend--left" id="as-cmp-legend-left">${ndbiLegendHtml()}</div>
      <div class="as-cmp-legend as-cmp-legend--right" id="as-cmp-legend-right">${ndbiLegendHtml()}</div>

      <div class="as-cmp-divider" id="as-cmp-divider"><span class="as-cmp-handle"></span></div>
    </div>
    <p class="as-cmp-hint">Drag anywhere on the image to swipe between the two panes.</p>
    <div class="as-cmp-panes">
      ${paneControls('left')}
      ${paneControls('right')}
    </div>`;

  viewer.querySelectorAll('.as-cmp-frame').forEach(sel =>
    sel.addEventListener('change', (e) => {
      cmp[sel.dataset.pane].idx = Number(e.target.value);
      updateCompare();
    }));
  viewer.querySelectorAll('.as-cmp-lyr').forEach(b =>
    b.addEventListener('click', () => {
      cmp[b.dataset.pane].layer = b.dataset.layer;
      updateCompare();
    }));
  viewer.querySelectorAll('.as-cmp-setref').forEach(b =>
    b.addEventListener('click', () => {
      cmp.reference = b.dataset.pane;
      updateCompare();
    }));

  bindCompareDrag();
}

// Cheap divider-only update (used live during a drag, avoids a full re-render).
function applyDivider() {
  const clip = overlay.querySelector('#as-cmp-clip');
  const div = overlay.querySelector('#as-cmp-divider');
  if (clip) clip.style.clipPath = `inset(0 ${100 - cmp.divider}% 0 0)`;
  if (div) div.style.left = `${cmp.divider}%`;
}

function bindCompareDrag() {
  const stage = overlay.querySelector('#as-cmp-stage');
  if (!stage) return;
  let dragging = false;
  const setFromEvent = (e) => {
    const rect = stage.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    cmp.divider = Math.max(0, Math.min(100, x));
    applyDivider();
  };
  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId);
    setFromEvent(e);
  });
  stage.addEventListener('pointermove', (e) => { if (dragging) setFromEvent(e); });
  stage.addEventListener('pointerup', () => { dragging = false; });
  stage.addEventListener('pointercancel', () => { dragging = false; });
}

function paneCaption(pane) {
  const f = site.frames[cmp[pane].idx];
  return `${f.year} · ${windowLabel(f.window)}-season · ${cmp[pane].layer.toUpperCase()}`;
}

function updateCompare() {
  if (viewMode !== 'compare' || !cmp) return;

  const lf = site.frames[cmp.left.idx];
  const rf = site.frames[cmp.right.idx];
  const limg = overlay.querySelector('#as-cmp-img-left');
  const rimg = overlay.querySelector('#as-cmp-img-right');
  if (limg) { limg.src = lf[cmp.left.layer]; limg.alt = `${site.name} — left — ${frameCaption(lf)}`; }
  if (rimg) { rimg.src = rf[cmp.right.layer]; rimg.alt = `${site.name} — right — ${frameCaption(rf)}`; }

  applyDivider();

  const capL = overlay.querySelector('#as-cmp-cap-left');
  const capR = overlay.querySelector('#as-cmp-cap-right');
  if (capL) capL.textContent = paneCaption('left');
  if (capR) capR.textContent = paneCaption('right');

  // Reference badge — exactly one pane.
  overlay.querySelector('#as-cmp-badge-left')?.classList.toggle('show', cmp.reference === 'left');
  overlay.querySelector('#as-cmp-badge-right')?.classList.toggle('show', cmp.reference === 'right');

  // Per-pane NDBI legend (behaviour A, per pane).
  overlay.querySelector('#as-cmp-legend-left')?.classList.toggle('show', cmp.left.layer === 'ndbi');
  overlay.querySelector('#as-cmp-legend-right')?.classList.toggle('show', cmp.right.layer === 'ndbi');

  // Control state: layer toggles, reference button + pill, per pane.
  ['left', 'right'].forEach(pane => {
    overlay.querySelectorAll(`.as-cmp-lyr[data-pane="${pane}"]`).forEach(b =>
      b.classList.toggle('active', b.dataset.layer === cmp[pane].layer));
    const isRef = cmp.reference === pane;
    const card = overlay.querySelector(`.as-cmp-pane[data-pane="${pane}"]`);
    if (card) {
      const btn = card.querySelector('.as-cmp-setref');
      if (btn) {
        btn.classList.toggle('is-ref', isRef);
        btn.disabled = isRef;
        btn.textContent = isRef ? 'Reference date ✓' : 'Set as reference date';
      }
      card.querySelector('[data-ref-pill]')?.classList.toggle('show', isRef);
    }
  });

  renderCompareSide();
}

// Compare metric panel. quantified → per-pane km² + change vs reference date.
// visual_only → no numbers, the swipe is the evidence.
function renderCompareSide() {
  const side = overlay.querySelector('#as-metric');
  if (!side) return;

  const refPane = cmp.reference;
  const cmpPane = refPane === 'left' ? 'right' : 'left';
  const refYear = site.frames[cmp[refPane].idx].year;
  const cmpYear = site.frames[cmp[cmpPane].idx].year;

  if (site.metric_mode === 'quantified') {
    const refRow = metricForYear(site, refYear);
    const cmpRow = metricForYear(site, cmpYear);
    const fmt = (row) => row ? `${row.km2.toFixed(3)}` : '—';

    const leftYear = site.frames[cmp.left.idx].year;
    const rightYear = site.frames[cmp.right.idx].year;
    const leftRow = metricForYear(site, leftYear);
    const rightRow = metricForYear(site, rightYear);

    let changeStr = '—';
    if (refRow && cmpRow && refRow.km2 !== 0) {
      const pct = ((cmpRow.km2 - refRow.km2) / refRow.km2) * 100;
      changeStr = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
    }

    const paneRow = (pane, year, row) => `
      <div class="as-cmp-metric-row">
        <span class="as-cmp-metric-pane">${pane === 'left' ? 'Left' : 'Right'}
          ${cmp.reference === pane ? '<span class="as-cmp-metric-ref">reference date</span>' : ''}</span>
        <span class="as-cmp-metric-vals">
          <span class="as-cmp-metric-year num">${year}</span>
          <span class="as-cmp-metric-km2 num">${fmt(row)}</span>
          <span class="as-cmp-metric-unit">km²</span>
        </span>
      </div>`;

    side.innerHTML = `
      <div class="as-metric-head">Compare · observed footprint</div>
      <p class="as-metric-summary">${escapeHtml(site.metric_summary)}</p>
      <div class="as-cmp-metric">
        ${paneRow('left', leftYear, leftRow)}
        ${paneRow('right', rightYear, rightRow)}
      </div>
      <div class="as-cmp-change">
        <span class="as-cmp-change-label">change vs reference date
          <span class="num">(${refYear} → ${cmpYear})</span></span>
        <span class="as-cmp-change-val num">${changeStr}</span>
      </div>
      <p class="as-metric-note">${escapeHtml(site.metric_note)}</p>`;
  } else {
    side.innerHTML = `
      <div class="as-metric-head">Compare · what the imagery shows</div>
      <p class="as-metric-summary">${escapeHtml(site.metric_summary)}</p>
      <div class="as-visual-flag">No per-year area figure — the swipe is the evidence.</div>
      <p class="as-metric-note">${escapeHtml(site.metric_note)}</p>`;
  }
}

// ---------------------------------------------------------------------------
// Metric panel — behaviour depends on metric_mode.
// ---------------------------------------------------------------------------
function renderSide() {
  const side = overlay.querySelector('#as-metric');
  if (!side) return;
  const frame = site.frames[frameIdx];

  if (site.metric_mode === 'quantified') {
    const row = metricForYear(site, frame.year);
    const km2 = row ? row.km2.toFixed(3) : '—';
    const pct = row ? row.pct_since_baseline : null;
    const pctStr = pct == null ? '' :
      `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
    side.innerHTML = `
      <div class="as-metric-head">Footprint · observed</div>
      <p class="as-metric-summary">${escapeHtml(site.metric_summary)}</p>
      <div class="as-metric-value">
        <span class="as-km2 num">${km2}</span>
        <span class="as-km2-unit">km²</span>
        <span class="as-km2-year num">${frame.year}</span>
      </div>
      <div class="as-metric-secondary">
        <span class="as-pct-label">vs ${site.baseline_year} reference observation</span>
        <span class="as-pct num">${pctStr}</span>
      </div>
      <p class="as-metric-note">${escapeHtml(site.metric_note)}</p>`;
  } else {
    // visual_only — NO km², NO chart. The time-lapse is the evidence.
    side.innerHTML = `
      <div class="as-metric-head">What the imagery shows</div>
      <p class="as-metric-summary">${escapeHtml(site.metric_summary)}</p>
      <div class="as-visual-flag">No per-year area figure — visual evidence only.</div>
      <p class="as-metric-note">${escapeHtml(site.metric_note)}</p>`;
  }
}

// ---------------------------------------------------------------------------
// Caveats footer — manifest global_caveats + this site's metric_note.
// ---------------------------------------------------------------------------
function renderCaveats() {
  const el = overlay.querySelector('#as-caveats');
  if (!el) return;
  const items = assetPillar.caveats.map(c => `<li>${escapeHtml(c)}</li>`).join('');
  el.innerHTML = `
    <span class="as-caveats-label">Method &amp; caveats</span>
    <ul class="as-caveats-list">${items}</ul>`;
}

// ---------------------------------------------------------------------------
// Lightweight dynamic update (no structural rebuild): image, caption, slider,
// layer toggle state, play button, metric panel.
// ---------------------------------------------------------------------------
function update() {
  if (viewMode !== 'single') return;
  const frame = site.frames[frameIdx];
  const img = overlay.querySelector('#as-img');
  if (img) {
    img.src = frame[layer];
    img.alt = `${site.name} — ${layer.toUpperCase()} — ${frameCaption(frame)}`;
  }
  const cap = overlay.querySelector('#as-caption');
  if (cap) cap.innerHTML = `<span class="num">${frame.year}</span> · ${windowLabel(frame.window)}-season`;

  const readout = overlay.querySelector('#as-frame-readout');
  if (readout) readout.textContent = `${frameIdx + 1} / ${site.frames.length}`;

  const slider = overlay.querySelector('#as-slider');
  if (slider && Number(slider.value) !== frameIdx) slider.value = String(frameIdx);

  overlay.querySelectorAll('.as-lyr').forEach(b =>
    b.classList.toggle('active', b.dataset.layer === layer));

  // NDBI legend visible only while the NDBI layer is active.
  const legend = overlay.querySelector('.as-stage .as-legend');
  if (legend) legend.classList.toggle('show', layer === 'ndbi');

  const play = overlay.querySelector('#as-play');
  if (play) {
    play.classList.toggle('playing', playing);
    play.setAttribute('aria-label', playing ? 'Pause timelapse' : 'Play timelapse');
  }

  renderSide();
}

// ---- play/pause: auto-advance ~750ms, looping ----
function togglePlay() {
  if (playing) stopPlay(); else startPlay();
}
function startPlay() {
  playing = true;
  update();
  playTimer = setInterval(() => {
    frameIdx = (frameIdx + 1) % site.frames.length;
    update();
  }, PLAY_MS);
}
function stopPlay() {
  playing = false;
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  const play = overlay?.querySelector('#as-play');
  if (play) { play.classList.remove('playing'); play.setAttribute('aria-label', 'Play timelapse'); }
}

// ---------------------------------------------------------------------------
// "Flag & request inspection" — a ROADMAP CONCEPT, not a live feature.
// It drafts a mock tasking order from manifest data and shows a demo-only
// confirmation. No network calls, no persistence, nothing is dispatched.
// ---------------------------------------------------------------------------
let flagDialog = null;

// The frame the order should reference: in Compare, the reference pane's frame;
// in Single, the frame on screen.
function currentViewFrame() {
  if (viewMode === 'compare' && cmp) return site.frames[cmp[cmp.reference].idx];
  return site.frames[frameIdx];
}

function ensureFlagDialog() {
  if (flagDialog) return flagDialog;
  flagDialog = document.createElement('div');
  flagDialog.id = 'as-flag-dialog';
  flagDialog.setAttribute('aria-hidden', 'true');
  flagDialog.innerHTML = `
    <div class="as-flag-backdrop" data-flag-dismiss></div>
    <div class="as-flag-card" role="dialog" aria-modal="true" aria-labelledby="as-flag-title">
      <button class="as-flag-x" type="button" aria-label="Close" data-flag-dismiss>&times;</button>
      <span class="as-flag-concept">Roadmap concept — field-ops integration not yet connected</span>
      <h2 class="as-flag-title" id="as-flag-title">Flag &amp; request inspection</h2>
      <p class="as-flag-lede">Draft a tasking order from this observation. This is a product
        concept that imagines closing the loop to ground-truth — nothing is dispatched.</p>
      <div class="as-flag-body" id="as-flag-form">
        <dl class="as-flag-grid" id="as-flag-grid"></dl>
        <label class="as-flag-label" for="as-flag-note">Observation note</label>
        <textarea class="as-flag-note" id="as-flag-note" rows="3"></textarea>
        <label class="as-flag-label" for="as-flag-followup">Suggested follow-up</label>
        <select class="as-flag-followup" id="as-flag-followup">
          <option>Drone / high-res tasking</option>
          <option>Re-image next pass (Sentinel-2)</option>
          <option>Field visit / ground-truth survey</option>
        </select>
        <div class="as-flag-actions">
          <button class="as-flag-cancel" type="button" data-flag-dismiss>Cancel</button>
          <button class="as-flag-draft" id="as-flag-draft" type="button">Draft request</button>
        </div>
      </div>
      <div class="as-flag-confirm" id="as-flag-confirm" hidden>
        <div class="as-flag-confirm-mark">✓</div>
        <p class="as-flag-confirm-head">Inspection request drafted (demo)</p>
        <p class="as-flag-confirm-sub">Demo only — no request was sent and nothing was dispatched.
          Field-ops integration is a roadmap concept.</p>
        <button class="as-flag-done" id="as-flag-done" type="button">Close</button>
      </div>
    </div>`;
  document.body.appendChild(flagDialog);

  flagDialog.querySelectorAll('[data-flag-dismiss]').forEach(el =>
    el.addEventListener('click', closeFlagDialog));
  flagDialog.querySelector('#as-flag-draft').addEventListener('click', () => {
    flagDialog.querySelector('#as-flag-form').hidden = true;
    flagDialog.querySelector('#as-flag-confirm').hidden = false;
  });
  flagDialog.querySelector('#as-flag-done').addEventListener('click', closeFlagDialog);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && flagDialog.classList.contains('open')) closeFlagDialog();
  });
  return flagDialog;
}

function openFlagDialog() {
  ensureFlagDialog();
  const frame = currentViewFrame();
  const obs = `${frame.year} · ${windowLabel(frame.window)}-season`;
  flagDialog.querySelector('#as-flag-grid').innerHTML = `
    <div class="as-flag-pair"><dt>Facility</dt><dd>${escapeHtml(site.name)}</dd></div>
    <div class="as-flag-pair"><dt>Operator</dt><dd>${escapeHtml(site.operator)}</dd></div>
    <div class="as-flag-pair"><dt>Coordinates</dt><dd class="num">${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}</dd></div>
    <div class="as-flag-pair"><dt>Observation</dt><dd class="num">${escapeHtml(obs)}</dd></div>`;
  // Reset form/confirm state and prefill an editable note.
  flagDialog.querySelector('#as-flag-form').hidden = false;
  flagDialog.querySelector('#as-flag-confirm').hidden = true;
  flagDialog.querySelector('#as-flag-note').value =
    `Observed footprint at ${site.name} (${obs}). Requesting follow-up to ground-truth the change.`;
  flagDialog.querySelector('#as-flag-followup').selectedIndex = 0;
  flagDialog.classList.add('open');
  flagDialog.setAttribute('aria-hidden', 'false');
}

function closeFlagDialog() {
  if (!flagDialog) return;
  flagDialog.classList.remove('open');
  flagDialog.setAttribute('aria-hidden', 'true');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
