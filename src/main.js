import './style.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import Chart from 'chart.js/auto';
import { facilities, statusFor, headlineFor, matrixStateFor } from './facilities_adapter.js';

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
document.getElementById('btn-goto-login')?.addEventListener('click', () => navigateTo('view-pillars'));

document.querySelectorAll('.btn-goto-home').forEach(btn => {
  btn.addEventListener('click', () => navigateTo('view-home'));
});

document.getElementById('btn-goto-map')?.addEventListener('click', () => navigateTo('view-map'));

document.getElementById('btn-back-pillars')?.addEventListener('click', () => navigateTo('view-pillars'));

// --- HERO MOUSE PARALLAX ---
const heroSection = document.querySelector('.hero-section');
const heroBg = document.querySelector('.hero-bg');

if (heroSection && heroBg) {
  heroSection.addEventListener('mousemove', (e) => {
    // Calculate mouse position as a percentage of the screen
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    
    // Smoothly update the transform origin so the scale animation zooms towards the mouse
    heroBg.style.transformOrigin = `${x}% ${y}%`;
  });
}

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

// Add a modern dark-themed base map using CartoDB Dark Matter
// This fits the premium "dashboard" look requested by the user
const darkBasemap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 20
});

// --- COMPLIANCE SIDE PANEL LOGIC ---
const panel = document.getElementById('compliance-panel');
const closeBtn = document.getElementById('cp-close');

// Status -> hex, mirroring the verdict colours used for the map pins.
const STATUS_COLOR = { green: '#46C266', amber: '#F2B53B' };

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

// --- Map markers: the three real AOIs from facilities.json, coloured by verdict ---
facilities.forEach(f => {
  const color = STATUS_COLOR[statusFor(f.verdict).tone] || '#F2B53B';
  const marker = L.circleMarker([f.lat, f.lon], {
    radius: 9, color: '#0C1116', weight: 2, fillColor: color, fillOpacity: 0.95
  }).addTo(map);
  marker.bindTooltip(`<b>${f.name}</b><br>${f.basisLabel}`);
  marker.on('click', () => {
    map.setView([f.lat, f.lon], f.isBasin ? 7 : 9, { animate: true });
    selectFacility(f);
  });
});

// Start with the dark basemap active
darkBasemap.addTo(map);

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
  "Dark Dashboard": darkBasemap
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
function renderTrajectory(f) {
  const labels = f.trajectory.map(t => t.month);
  const data = f.trajectory.map(t => t.ch4);
  const ds = {
    label: 'Observed (satellite)', data,
    borderColor: css('--amber'), borderWidth: 2.6, pointRadius: 2.6,
    pointBackgroundColor: css('--amber'), spanGaps: false, tension: 0.35,
  };
  if (trajChart) {
    trajChart.data.labels = labels;
    trajChart.data.datasets = [ds];
    trajChart.update();
  } else {
    trajChart = new Chart(document.getElementById('chart'), {
      type: 'line', data: { labels, datasets: [ds] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 500, easing: 'easeOutCubic' },
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
            callbacks: { label: c => c.parsed.y == null ? '' : ` ${c.parsed.y.toFixed(1)} ppb` } }
        }
      }
    });
  }
  const latest = [...f.trajectory].reverse().find(t => t.ch4 != null);
  const yv = document.getElementById('yendVal'); if (yv) yv.textContent = latest ? `${latest.ch4.toFixed(1)} ppb` : '—';
  const yn = document.getElementById('yendNote'); if (yn) yn.textContent = latest ? `most recent cloud-free month · ${latest.month}` : 'no cloud-free month in window';
}

function renderReport(f) {
  if (!f) return;
  renderInvestigateActions();

  const status = statusFor(f.verdict);
  const color = STATUS_COLOR[status.tone] || '#F2B53B';
  const ring = status.tone === 'green' ? css('--green') : css('--amber');

  // --- header ---
  document.getElementById('rep-name').textContent = f.name;
  const attn = document.getElementById('attn');
  attn.textContent = status.word; attn.style.borderColor = color; attn.style.color = color; attn.style.background = color + '14';
  document.getElementById('rep-operator').innerHTML = `Operator <b>${f.operator}</b>`;
  document.getElementById('rep-region').textContent = f.region;
  document.getElementById('rep-aoi').innerHTML = `AOI <b>${f.lat.toFixed(3)}°, ${f.lon.toFixed(3)}°</b>`;
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

  // --- trajectory ---
  renderTrajectory(f);

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

// Render the default selection so the report is populated before any pin click.
renderReport(selectedFacility);
