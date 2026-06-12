import './style.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import Chart from 'chart.js/auto';
import { facilities, statusFor, headlineFor, matrixStateFor } from './facilities_adapter.js';
import { initAskAletheia } from './ask_aletheia.js';

// --- SPA ROUTING LOGIC ---
function navigateTo(viewId) {
  // Hide all views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.add('hidden');
    view.classList.remove('active');
  });
  
  // Show target view
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
    
    // If navigating to the map, force Leaflet to recalculate sizes
    // This prevents the "grey tile" glitch when initializing maps inside hidden containers
    if (viewId === 'view-map' && typeof map !== 'undefined') {
      setTimeout(() => {
        map.invalidateSize();
      }, 300);
    }
  }
}

// Bind Navigation Buttons
document.querySelectorAll('.js-goto-pillars').forEach(btn =>
  btn.addEventListener('click', () => navigateTo('view-pillars')));

document.querySelectorAll('.btn-goto-home').forEach(btn => {
  btn.addEventListener('click', () => navigateTo('view-home'));
});

document.getElementById('btn-goto-map')?.addEventListener('click', () => navigateTo('view-map'));

document.getElementById('btn-back-pillars')?.addEventListener('click', () => navigateTo('view-pillars'));

// --- Landing globe (ESG block): project the three real AOIs from facilities.json
// onto a stylised orthographic globe and drop a gently-pulsing pin on each.
// Lightweight SVG — no 3D engine. Centre chosen so all three sites face us. ---
(function buildLandingGlobe() {
  const host = document.getElementById('globe-pins');
  if (!host) return;
  const R = 150, cx = 200, cy = 200;
  const lon0 = -34 * Math.PI / 180, lat0 = 18 * Math.PI / 180;
  const sinLat0 = Math.sin(lat0), cosLat0 = Math.cos(lat0);
  const GLOBE_PIN = { green: '#5FBE8A', amber: '#E0AE5A' };
  const NS = 'http://www.w3.org/2000/svg';

  facilities.forEach(f => {
    const lat = f.lat * Math.PI / 180, dlon = (f.lon * Math.PI / 180) - lon0;
    const cosc = sinLat0 * Math.sin(lat) + cosLat0 * Math.cos(lat) * Math.cos(dlon);
    if (cosc < 0) return; // site is on the far side of the globe
    const x = cx + R * Math.cos(lat) * Math.sin(dlon);
    const y = cy - R * (cosLat0 * Math.sin(lat) - sinLat0 * Math.cos(lat) * Math.cos(dlon));
    const color = GLOBE_PIN[statusFor(f.verdict).tone] || GLOBE_PIN.amber;

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'globe-pin');
    g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);

    const pulse = document.createElementNS(NS, 'circle');
    pulse.setAttribute('class', 'pin-pulse');
    pulse.setAttribute('r', '4'); pulse.setAttribute('fill', 'none');
    pulse.setAttribute('stroke', color); pulse.setAttribute('stroke-width', '2');

    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('r', '4.5'); dot.setAttribute('fill', color);
    dot.setAttribute('stroke', '#08171C'); dot.setAttribute('stroke-width', '1.2');

    const title = document.createElementNS(NS, 'title');
    title.textContent = `${f.name} — ${f.verdict}`;

    g.append(pulse, dot, title);
    host.appendChild(g);
  });
})();

// --- LANDING CAROUSEL ---
// Full-viewport 4-slide carousel (no page scroll). Navigable via dots, arrows,
// swipe and keyboard, with a gentle auto-advance that pauses on hover and after
// any manual move. The intro slide gets a longer hold so it can breathe.
// Respects prefers-reduced-motion (no auto-advance). Lightweight, no deps.
(function landingCarousel() {
  const root = document.getElementById('carousel');
  const track = document.getElementById('carousel-track');
  const home = document.getElementById('view-home');
  if (!root || !track) return;

  const slides = Array.from(track.children);
  const dots = Array.from(document.querySelectorAll('#carousel-dots .cdot'));
  const n = slides.length;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DWELL = i => (i === 0 ? 9000 : 6000); // intro holds longer
  const isVisible = () => home && !home.classList.contains('hidden');

  let index = 0, timer = null, paused = false;

  function render() {
    track.style.transform = `translateX(${-index * 100}%)`;
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === index);
      d.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
  }
  function stop() { if (timer) { clearTimeout(timer); timer = null; } }
  function schedule() {
    stop();
    if (reduce) return;                       // no auto-advance under reduced-motion
    timer = setTimeout(() => {
      if (!paused && isVisible()) go(index + 1, false);
      schedule();
    }, DWELL(index));
  }
  function go(i, manual) {
    index = (i + n) % n;
    render();
    if (manual) schedule();                   // reset the dwell after a manual move
  }

  // dots + arrows
  dots.forEach((d, i) => d.addEventListener('click', () => go(i, true)));
  document.getElementById('car-next')?.addEventListener('click', () => go(index + 1, true));
  document.getElementById('car-prev')?.addEventListener('click', () => go(index - 1, true));

  // pause on hover
  root.addEventListener('mouseenter', () => { paused = true; });
  root.addEventListener('mouseleave', () => { paused = false; });

  // keyboard (only while the landing is on screen)
  window.addEventListener('keydown', (e) => {
    if (!isVisible()) return;
    if (e.key === 'ArrowRight') go(index + 1, true);
    else if (e.key === 'ArrowLeft') go(index - 1, true);
  });

  // swipe / drag
  let x0 = null;
  root.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  window.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1), true);
  });

  render();
  schedule();
})();

// Fix Leaflet's default icon paths in Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Initialize the map on the "map" div.
// Start zoomed out so all three reference AOIs (Groundbirch BC, Permian TX/NM,
// Korpezhe Turkmenistan) are visible at once; clicking a pin flies to it.
const map = L.map('map', {
  center: [40, -40],
  zoom: 2,
  zoomControl: false // We will add a custom-positioned zoom control
});

// Light CARTO Positron basemap — matches the light "paper" theme (Workstream B).
const lightBasemap = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 20
});

// --- COMPLIANCE SIDE PANEL LOGIC ---
const panel = document.getElementById('compliance-panel');
const closeBtn = document.getElementById('cp-close');

// Status -> hex, mirroring the desaturated verdict colours (shared token set,
// ALETHEIA_HANDOFF §4: --good / --watch). Used for map pins and the report badge.
const STATUS_COLOR = { green: '#3F7E5E', amber: '#B5863C' };

let selectedFacility = facilities[0] || null;

closeBtn.addEventListener('click', () => panel.classList.add('hidden'));

// Populate + open the compliance side panel from a facility view-model.
// All honesty framing (verdict -> status, reframed headline, method label)
// comes from facilities_adapter.js — this only paints it.
function renderPanel(f) {
  const status = statusFor(f.verdict);
  const color = STATUS_COLOR[status.tone] || '#F2B53B';
  document.getElementById('cp-name').textContent = f.name;
  document.getElementById('cp-chips').innerHTML =
    `<span class="badge">${f.operator}</span>` +
    `<span class="badge">${f.region}</span>` +
    `<span class="badge">${f.basisLabel}</span>`;
  document.getElementById('cp-status-dot').style.background = color;
  const word = document.getElementById('cp-status-word');
  word.textContent = status.word;
  word.style.color = color;
  document.getElementById('cp-headline').innerHTML = headlineFor(f);
  panel.classList.remove('hidden');
}

function selectFacility(f) {
  selectedFacility = f;
  renderPanel(f);
  renderReport(f); // keep the full report in sync with the selected pin
}

document.getElementById('btn-open-report')?.addEventListener('click', () => {
  const modal = document.getElementById('aletheia-report-modal');
  if (selectedFacility) renderReport(selectedFacility);
  if (modal) modal.classList.add('open');
});

document.getElementById('btn-close-report')?.addEventListener('click', () => {
  const modal = document.getElementById('aletheia-report-modal');
  if (modal) modal.classList.remove('open');
});

// Deeper verdict fills for the markers so they stay legible on the light Positron
// basemap, each ringed by a subtle white halo (ALETHEIA_HANDOFF §4 / map request).
const PIN_COLOR = { green: '#2E5C45', amber: '#7A5A1E' };

// --- Map markers: the three real AOIs from facilities.json, coloured by verdict ---
facilities.forEach(f => {
  const fill = PIN_COLOR[statusFor(f.verdict).tone] || '#7A5A1E';
  const marker = L.circleMarker([f.lat, f.lon], {
    radius: 9, color: '#FFFFFF', weight: 3, fillColor: fill, fillOpacity: 1, className: 'aoi-pin'
  }).addTo(map);
  marker.bindTooltip(`<b>${f.name}</b><br>${f.basisLabel}`);
  marker.on('click', () => {
    map.setView([f.lat, f.lon], f.isBasin ? 7 : 9, { animate: true });
    selectFacility(f);
  });
});

// Start with the light Positron basemap active
lightBasemap.addTo(map);

// Add Planet Labs Satellite layer (via secure backend proxy)
// NOTE: The mosaic name must match one that your Planet subscription grants access to.
const mosaicName = 'global_monthly_2023_01_mosaic';

// We hit our local proxy instead of Planet directly. 
// The backend will attach the API key, keeping it invisible to the browser.
const planetLayer = L.tileLayer(`/api/planet-tiles/${mosaicName}/{z}/{x}/{y}`, {
  attribution: '&copy; <a href="https://www.planet.com/">Planet Labs</a>',
  maxZoom: 18
});

// Add NASA FIRMS VIIRS WMS layer (via secure backend proxy)
const firmsLayer = L.tileLayer.wms('/api/firms-wms', {
  layers: 'fires_viirs_snpp_24', // Display VIIRS detections from the last 24 hours
  format: 'image/png',
  transparent: true,
  attribution: '&copy; <a href="https://firms.modaps.eosdis.nasa.gov/">NASA FIRMS</a>'
});

// Custom Sentinel Hub Evalscript to detect Oil Spills (Low Backscatter)
const oilSpillEvalscript = `//VERSION=3
function setup() {
  return {
    input: ["VV", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  
  // Calculate approximate backscatter in decibels
  let backscatter = Math.log10(sample.VV) * 10;
  
  // Very smooth water reflects radar away, causing extremely low backscatter (<-20 dB)
  if (backscatter < -20) {
    return [1, 0, 0, 1]; // Paint potential oil spills RED
  }
  
  // Paint everything else in standard grayscale
  let gray = Math.max(0, backscatter + 30) / 30;
  return [gray, gray, gray, 1];
}`;

// Add Sentinel-1 SAR WMS layer (via secure backend proxy)
const sarLayer = L.tileLayer.wms('/api/sar-wms', {
  layers: '9_SAR-URBAN-VV-VH', // Fallback layer
  format: 'image/png',
  transparent: true,
  minZoom: 8, // Required: Sentinel Hub limits SAR processing to higher zoom levels
  EVALSCRIPT64: btoa(oilSpillEvalscript), // Inject our custom script into the request!
  attribution: '&copy; <a href="https://www.sentinel-hub.com/">Sentinel Hub</a>'
});

// Set up Layer Control (Checkbox/Radio toggle)
const baseMaps = {
  "Light (Positron)": lightBasemap
};

// We will add Planet, NASA, and SAR as overlays so you can toggle them on/off
const overlayMaps = {
  "Planet Satellite Imagery": planetLayer,
  "NASA VIIRS (24hr)": firmsLayer,
  "Sentinel-1 SAR (Oil Spills)": sarLayer
};

L.control.layers(baseMaps, overlayMaps, {
  position: 'topright'
}).addTo(map);

// NOTE: the previous "TROPOMI Methane (Multi-Year Avg)" heat layer was removed.
// It synthesised plume geometry from a mock per-facility tonnage that no longer
// exists in facilities.json, and presenting an invented plume as TROPOMI output
// would violate the honesty rules (ALETHEIA_HANDOFF A4.5 — never fabricate).
// A real gridded TROPOMI overlay can be added later when the pipeline emits one.

// Turn on the NASA layer by default so it's immediately visible
firmsLayer.addTo(map);

// Add zoom control to the bottom right for a more dashboard-like feel
L.control.zoom({
  position: 'bottomright'
}).addTo(map);

// --- Opacity Control Logic ---
const planetOpacitySlider = document.getElementById('planet-opacity');
const vnfOpacitySlider = document.getElementById('vnf-opacity');
const sarOpacitySlider = document.getElementById('sar-opacity');

// Update Planet Labs layer opacity
planetOpacitySlider.addEventListener('input', (e) => {
  const opacity = parseInt(e.target.value, 10) / 100;
  planetLayer.setOpacity(opacity);
});

// Update NASA FIRMS layer opacity
vnfOpacitySlider.addEventListener('input', (e) => {
  const opacity = parseInt(e.target.value, 10) / 100;
  firmsLayer.setOpacity(opacity);
});

// Update Sentinel-1 SAR layer opacity
sarOpacitySlider.addEventListener('input', (e) => {
  const opacity = parseInt(e.target.value, 10) / 100;
  sarLayer.setOpacity(opacity);
});

// Update Methane layer opacity
const methaneOpacitySlider = document.getElementById('methane-opacity');
if (methaneOpacitySlider) {
  methaneOpacitySlider.addEventListener('input', (e) => {
    // leaflet.heat doesn't have a native setOpacity, but we can re-render it 
    // by changing the canvas opacity through CSS or recreating it.
    // For simplicity in this UI trial, we will adjust the CSS opacity of the canvas pane if needed, 
    // but typically heatmaps are semi-transparent naturally.
  });
}

// In the future, this is where we will load our GeoJSON data,
// real-world industrial output indicators, and company reports.


/* ===========================================================================
   ALETHEIA ANALYSIS REPORT — data-driven render
   Replaces the original hardcoded-mock IIFE. Everything below paints the
   currently selected facility (view-model from facilities_adapter.js) into the
   report modal, applying the ALETHEIA_HANDOFF section A4 honesty rules:
     - headline is concentration excess, never "intensity vs disclosure"
     - 2x2 matrix cell is derived from the data (clean sites render green)
     - no Reported/disclosure series or basis-vs-target panels (none exist yet)
     - basin has no NO2/CO -> N/A, never fabricated
   =========================================================================== */

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

/* ===========================================================================
   PROJECTION + AI-ACTION LEVERS + USER GOAL  (illustrative scenario layer)
   Honesty rules (ALETHEIA_HANDOFF A4): everything here is a SCENARIO drawn on
   top of the OBSERVED ppb record, never a prediction and never a claim about
   what the operator emits or disclosed.
     - The status-quo projection is an illustrative extrapolation of the trend.
     - Levers bend ONLY the *excess above local background* (the abatable part),
       never the background column itself.
     - The goal line is the USER'S OWN target, framed as such.
   =========================================================================== */

const PROJ_MONTHS = 12;     // dashed status-quo continuation horizon
const RAMP_MONTHS = 3;      // months for an abatement lever to phase to full effect
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Module state, shared by the chart + the lever/goal controls.
let currentTrajFacility = null;
const activeLevers = new Set();
let userGoal = null;        // { pct:Number, year:Number } once the user plots one
let askApi = null;          // "Ask Aletheia" chat handle (assigned at init)

// Abatement levers — illustrative efficacy RANGES with real source tags.
// efficacy = fractional reduction of the addressable excess (device capture eff.).
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

// "YYYY-MM" + k months -> "YYYY-MM"
function addMonths(ym, k) {
  const [y, m] = ym.split('-').map(Number);
  const idx = (y * 12 + (m - 1)) + k;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}
// whole months between two "YYYY-MM" (b - a)
function monthsBetween(a, b) {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by * 12 + bm) - (ay * 12 + am);
}

// Least-squares slope/intercept + residual std over observed (index, ch4) points.
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

// Combined steady-state efficacy of the active levers on the excess (midpoints,
// stacked multiplicatively): 1 - Π(1 - eff_i).
function combinedEfficacy() {
  let keep = 1;
  abatement.forEach(l => { if (activeLevers.has(l.id)) keep *= (1 - leverMid(l)); });
  return 1 - keep;
}

// Build the abatement-lever toggle cards once.
function renderAbatementActions() {
  const wrap = document.getElementById('abateActions');
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
  const el = document.getElementById('abateSummary');
  if (!el) return;
  const n = activeLevers.size;
  if (!n) { el.textContent = 'No levers active · status-quo'; return; }
  const pct = Math.round(combinedEfficacy() * 100);
  el.textContent = `${n} lever${n > 1 ? 's' : ''} active · ~${pct}% lower excess at full effect`;
}

// Published-quantification callout — CITED magnitude from the literature, never
// derived by our pipeline. Facilities without a published number say so plainly.
function renderQuantCallout(f) {
  const el = document.getElementById('quantCallout');
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

// Build the static "Investigate now" action cards once.
function renderInvestigateActions() {
  const wrap = document.getElementById('verifyActions');
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

// Observed methane trajectory in ppb. null months are gaps (spanGaps:false),
// never zeros — winter cloud cover at Groundbirch shows as a break in the line.
// On top of the OBSERVED line we draw three illustrative-SCENARIO overlays:
// a status-quo projection + uncertainty band, lever-bent projection, and the
// user's own goal line. None of these is a prediction or an operator disclosure.
function renderTrajectory(f) {
  currentTrajFacility = f;
  const BAND = 'rgba(181,134,60,.16)';

  // --- observed series ---
  const obsLabels = f.trajectory.map(t => t.month);
  const obsData = f.trajectory.map(t => t.ch4);

  // last cloud-free observed point = the anchor every overlay grows from
  const lastIdxObs = [...obsData].map((v, i) => (v != null ? i : -1)).filter(i => i >= 0).pop();
  const haveAnchor = lastIdxObs != null && lastIdxObs >= 0;

  // future month labels
  const futureLabels = [];
  if (haveAnchor) {
    for (let k = 1; k <= PROJ_MONTHS; k++) futureLabels.push(addMonths(obsLabels[lastIdxObs], k));
  }
  const labels = obsLabels.concat(futureLabels);
  const N = labels.length;
  const anchorIdx = lastIdxObs;
  const anchorVal = haveAnchor ? obsData[lastIdxObs] : null;

  // background / clean-reference column — the floor abatement cannot go below.
  const bkgd = (f.bkgdCh4 != null) ? f.bkgdCh4
    : Math.min(...obsData.filter(v => v != null));

  // trend fit over observed points (index space)
  const pts = obsData.map((y, x) => ({ x, y })).filter(p => p.y != null);
  const { slope, resStd } = fitTrend(pts);

  // status-quo projection passes through the actual anchor value.
  const proj = new Array(N).fill(null);
  const bandLo = new Array(N).fill(null);
  const bandHi = new Array(N).fill(null);
  const bent = new Array(N).fill(null);
  const goal = new Array(N).fill(null);

  const anyLever = activeLevers.size > 0;
  const showGoal = !!userGoal;
  const enhAnchor = haveAnchor ? (anchorVal - bkgd) : 0;

  // goal geometry (excess reduced by pct% by the target year)
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
      const s = j - anchorIdx;                       // months ahead
      const pv = anchorVal + slope * s;              // status-quo projection
      proj[j] = pv;
      const hw = resStd + Math.max(resStd * 0.3, 1.6) * s;   // band widens with time
      bandLo[j] = pv - hw; bandHi[j] = pv + hw;

      if (anyLever) {
        let keep = 1;
        abatement.forEach(l => {
          if (!activeLevers.has(l.id)) return;
          const phase = Math.max(0, Math.min(1, (s - l.lead) / RAMP_MONTHS));
          keep *= (1 - leverMid(l) * phase);
        });
        bent[j] = bkgd + (pv - bkgd) * keep;          // only the excess is abated
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

  const datasets = [
    // uncertainty band (lower drawn first, upper fills down to it)
    { ...mkLine('band-lo', bandLo, 'transparent', { order: 9 }), pointHitRadius: 0 },
    { ...mkLine('Uncertainty band', bandHi, 'transparent', { order: 9, fill: '-1' }), backgroundColor: BAND, pointHitRadius: 0 },
    // status-quo projection (dashed)
    mkLine('Projection · status-quo', proj, css('--amber-soft'), { dash: [6, 5], order: 4 }),
    // observed (solid, on top)
    mkLine('Observed (satellite)', obsData.concat(new Array(futureLabels.length).fill(null)),
      css('--amber'), { w: 2.6, pr: 2.6, t: 0.35, order: 1 }),
  ];
  if (anyLever) datasets.push(mkLine('With selected levers', bent, css('--green'), { dash: [5, 4], w: 2.4, order: 2 }));
  if (showGoal) datasets.push(mkLine('Goal line (your target)', goal, css('--muted'), { dash: [2, 4], w: 2, order: 3 }));

  const HIDE_IN_TIP = new Set(['band-lo', 'Uncertainty band']);

  if (trajChart) {
    trajChart.data.labels = labels;
    trajChart.data.datasets = datasets;
    trajChart.update(reduceMotion ? 'none' : undefined);
  } else {
    trajChart = new Chart(document.getElementById('chart'), {
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
          tooltip: { backgroundColor: '#0C1116', borderColor: css('--line'), borderWidth: 1, titleColor: css('--text'), bodyColor: css('--muted'),
            titleFont: { family: 'IBM Plex Mono', size: 11 }, bodyFont: { family: 'IBM Plex Mono', size: 11 }, padding: 10,
            filter: c => !HIDE_IN_TIP.has(c.dataset.label),
            callbacks: { label: c => c.parsed.y == null ? '' : ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)} ppb` } }
        }
      }
    });
  }

  // legend toggles for the optional overlays
  const lgAb = document.getElementById('lg-abated'); if (lgAb) lgAb.hidden = !anyLever;
  const lgTg = document.getElementById('lg-target'); if (lgTg) lgTg.hidden = !showGoal;

  const latest = haveAnchor ? f.trajectory[anchorIdx] : null;
  const yv = document.getElementById('yendVal'); if (yv) yv.textContent = latest ? `${latest.ch4.toFixed(1)} ppb` : '—';
  const yn = document.getElementById('yendNote'); if (yn) yn.textContent = latest ? `most recent cloud-free month · ${latest.month}` : 'no cloud-free month in window';
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
  document.getElementById('rep-name').textContent = f.name;
  const attn = document.getElementById('attn');
  attn.textContent = status.word; attn.style.borderColor = color; attn.style.color = color; attn.style.background = color + '14';
  document.getElementById('rep-operator').innerHTML = `Operator <b>${f.operator}</b>`;
  document.getElementById('rep-region').textContent = f.region;
  document.getElementById('rep-aoi').innerHTML = `AOI <b class="num">${f.lat.toFixed(3)}°, ${f.lon.toFixed(3)}°</b>`;
  document.getElementById('rep-updated').textContent = `Last fused: ${f.generated} · ${f.basisLabel}`;

  // --- verdict badge ---
  const bd = document.getElementById('badgeDot'); bd.style.background = color; bd.style.boxShadow = `0 0 0 5px ${color}22`;
  document.getElementById('badgeBar').style.background = color;
  document.getElementById('badgeWord').textContent = status.word;
  document.getElementById('badgeSub').innerHTML = `${f.basisLabel} · <b>${status.sub}</b>`;

  // --- headline (reframed: excess vs background / enhancement vs reference) ---
  document.getElementById('rep-headline').innerHTML = headlineFor(f);
  const bi = document.getElementById('rep-basis-inline'); if (bi) bi.textContent = f.comparisonName;

  // --- Output 1: flare x methane 2x2 matrix, cell derived from data ---
  const m = matrixStateFor(f);
  document.querySelectorAll('#rep-matrix [data-cell]').forEach(cell => {
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
  const o1v = document.getElementById('rep-o1-verdict');
  const o1s = document.getElementById('rep-o1-sub');
  if (f.verdict === 'performant') {
    o1v.innerHTML = `Operating <span class="em-green">cleanly</span> — ${m.label.toLowerCase()}.`;
    o1s.textContent = 'Methane sits at local background and flaring is negligible — there is no excess to explain.';
  } else {
    o1v.innerHTML = `Likely <span class="em-amber">${m.label.toLowerCase()}</span>.`;
    o1s.textContent = m.cell === 'flare-high'
      ? 'Methane is elevated and flaring is detected — combustion looks incomplete.'
      : 'Methane is elevated with little or no detected flaring — gas may be escaping uncombusted.';
  }

  // --- Output 2: NO2 / CO co-pollutant columns (facility only; basin -> N/A) ---
  const xind = document.getElementById('rep-xind');
  const o2v = document.getElementById('rep-o2-verdict');
  const o2s = document.getElementById('rep-o2-sub');
  const xconc = document.getElementById('rep-xconc');
  if (f.isBasin) {
    xind.innerHTML =
      `<div class="xrow"><span class="xname">NO₂</span><span></span><span class="xstate na">N/A · basin method</span></div>` +
      `<div class="xrow"><span class="xname">CO</span><span></span><span class="xstate na">N/A · basin method</span></div>`;
    o2v.innerHTML = `Not retrieved for a <span class="em-amber">basin</span> snapshot.`;
    o2s.textContent = 'NO₂ / CO co-pollutant columns are only retrieved for point-facility snapshots.';
    xconc.textContent = 'A basin enhancement is assessed against a clean reference region; per-pixel NO₂/CO attribution is not part of this method, so these are shown as N/A rather than invented.';
  } else {
    xind.innerHTML =
      `<div class="xrow"><span class="xname">NO₂</span><span></span><span class="xstate">${f.no2.toExponential(2)} mol/m²</span></div>` +
      `<div class="xrow"><span class="xname">CO</span><span></span><span class="xstate">${f.co.toExponential(2)} mol/m²</span></div>`;
    o2v.innerHTML = `Co-pollutant columns <span class="em-green">measured</span>.`;
    o2s.textContent = 'NO₂ and CO column densities retrieved over the site.';
    xconc.innerHTML = 'These are absolute satellite column readings. We deliberately do <b>not</b> label them “elevated” or “normal”: that needs a calibrated per-site baseline we don’t have yet, and inventing one would breach our own honesty rule.';
  }

  // --- Output 3: observed vs background readout (NOT obs-vs-reported) ---
  const ro = document.getElementById('rep-readout');
  const siteLabel = f.isBasin ? 'Target region CH₄' : 'Site CH₄';
  const refLabel = f.isBasin ? 'Clean reference CH₄' : 'Local background CH₄';
  ro.innerHTML =
    `<div class="lrow"><span class="lname">${siteLabel}<span class="obs">14-day TROPOMI composite</span></span><span></span><span class="ld">${f.siteCh4 != null ? f.siteCh4.toFixed(1) + ' ppb' : '—'}</span></div>` +
    `<div class="lrow"><span class="lname">${refLabel}</span><span></span><span class="ld">${f.bkgdCh4 != null ? f.bkgdCh4.toFixed(1) + ' ppb' : '—'}</span></div>` +
    `<div class="lrow"><span class="lname">Excess / enhancement<span class="obs">concentration, not intensity</span></span><span></span><span class="ld">${f.excessPct >= 0 ? '+' : ''}${f.excessPct}%</span></div>` +
    `<div class="lrow"><span class="lname">Flaring<span class="obs">VIIRS Nightfire 2024</span></span><span></span><span class="ld">${f.flaringBcm != null ? f.flaringBcm + ' BCM/yr' : '—'}</span></div>`;
  const lagg = document.getElementById('rep-lagg');
  lagg.innerHTML =
    `<div><span class="at">Methane excess</span></div>` +
    `<div style="text-align:right"><span class="av" style="color:${ring}">${f.excessPct >= 0 ? '+' : ''}${f.excessPct}%</span></div>` +
    `<div style="grid-column:1/3"><span class="as">${f.basisLabel} · concentration excess above baseline, not % of throughput</span></div>`;
  lagg.style.background = status.tone === 'green' ? 'rgba(70,194,102,.05)' : 'rgba(242,181,59,.05)';
  lagg.style.borderColor = status.tone === 'green' ? 'rgba(70,194,102,.25)' : 'rgba(242,181,59,.25)';
  document.getElementById('rep-o3-verdict').innerHTML = f.verdict === 'performant'
    ? `Observed methane is <span class="em-green">at background</span>.`
    : `Observed methane is <span class="em-amber">above ${f.comparisonName}</span>.`;
  document.getElementById('rep-o3-sub').textContent =
    `Measured ${f.basisLabel}. No operator-reported figure exists yet, so there is no disclosure comparison — only observation vs reference.`;

  // --- trajectory (observed) + projection / lever / goal overlays ---
  renderTrajectory(f);

  // --- published-quantification callout (cited) ---
  renderQuantCallout(f);

  // --- keep "Ask Aletheia" grounded on the current facility ---
  askApi?.refresh();

  // --- provenance footer ---
  document.getElementById('rep-footer').innerHTML =
    `<b>Source:</b> ${f.source}. <b>Generated:</b> ${f.generated}. ${f.note} ` +
    `The defensible comparison today is observed-vs-${f.isBasin ? 'reference' : 'background'}; ` +
    `operator-reported baselines (annual reports, OGMP 2.0 / GMP / IEA targets) are a separate future workstream and are not shown.`;
}

// expanders (interpretation cards) — bind once
document.querySelectorAll('[data-expand]').forEach(t => {
  t.addEventListener('click', () => {
    const b = t.nextElementSibling; const open = b.classList.toggle('open');
    t.setAttribute('aria-expanded', open);
    const ch = t.querySelector('.chev'); if (ch) ch.classList.toggle('rot', open);
  });
});

// --- Abatement lever "Reset": clear all toggles + redraw status-quo ---
document.getElementById('abateReset')?.addEventListener('click', () => {
  activeLevers.clear();
  document.querySelectorAll('#abateActions .actioncard.abate').forEach(b => {
    b.classList.remove('active'); b.setAttribute('aria-pressed', 'false');
  });
  updateLeverSummary();
  if (currentTrajFacility) renderTrajectory(currentTrajFacility);
});

// --- User-entered goal line: the user's OWN target, not an operator disclosure ---
const goalPct = document.getElementById('goalPct');
const goalYear = document.getElementById('goalYear');
const goalClearBtn = document.getElementById('goalClear');
const goalCap = document.getElementById('goalCap');

document.getElementById('goalApply')?.addEventListener('click', () => {
  const pct = Number(goalPct?.value) || 30;        // default -30%
  const year = Number(goalYear?.value) || 2030;    // default 2030
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

// --- "Ask Aletheia": grounded, read-only chat. getContext() returns the LIVE
// facility view-model + on-page scenario state, so answers always reflect the
// current selection, active levers and goal — and nothing else. ---
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
});

// Render the default selection so the report is populated before any pin click.
renderReport(selectedFacility);
