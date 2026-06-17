// sustainability_compliance.js
// Sustainability (pillar 03) compliance-first FRONT PAGE.
//
// Pillar 03 now opens on this compliance view; the existing methane/flaring
// OBSERVATION report (#aletheia-report-modal, rendered by main.js renderReport)
// is left UNTOUCHED and sits one click down behind the "View full observation
// evidence" link.
//
// Honesty rules (the whole credibility of this view — see ALETHEIA_HANDOFF):
//   - Obligations / filing drafts are REAL for Groundbirch only. Permian (US)
//     and Korpezhe (TM) are obligations_mapped:false -> they render the explicit
//     "not yet mapped for this jurisdiction" state. We NEVER show Canadian
//     filings under a US/TM site, and never fabricate a regulator/deadline.
//   - by_pollutant is real for all three sites (same TROPOMI/VIIRS data as the
//     observation report). Methane lives here as EVIDENCE, never as the hero.
//   - The evidence link carries the site's METHOD label (facility vs basin) so a
//     basin-scale enhancement never visually backs a facility-level claim.
//   - Any value with no real figure is rendered from the manifest's pending
//     string ("Threshold library pending" / "No operator figure" / …). Never
//     invented here.
//
// Everything rendered comes straight from public/sustainability.json. Mirrors
// the operational_efficiency.js manifest pattern (load+cache, tolerant match).

import './sustainability_compliance.css';

let susManifest = null;
let susManifestPromise = null;
let susCurrentFacility = null;     // the facility view-model currently shown
let onViewEvidence = null;         // callback wired by main.js to open the obs report

// Load + cache the manifest once; reuse across selections.
function loadSusManifest() {
  if (susManifest) return Promise.resolve(susManifest);
  if (susManifestPromise) return susManifestPromise;
  susManifestPromise = fetch('/sustainability.json')
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(m => { susManifest = m; return m; })
    .catch(err => {
      console.warn('[sustainability] could not load compliance manifest:', err);
      susManifestPromise = null;
      return null;
    });
  return susManifestPromise;
}

// Match a facility view-model to a manifest site. Tiers: exact id, then
// case-insensitive name, then tolerant containment (facility ids are slugified —
// e.g. "permian-basin-delaware" must still match manifest "permian").
function matchSusSite(f, manifest) {
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

// Minimal HTML escape for any value that originates outside our control.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CHIP_CLASS = { good: 'c-good', watch: 'c-watch', neutral: 'c-neutral', accent: 'c-accent' };

// Inline bell glyph (no emoji — consistent with the other pillars' inline SVGs).
const BELL_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
  'stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>' +
  '<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';

// ---------- section builders ----------

function renderHeader(site) {
  return (
    `<div class="sus-head">
      <div class="sus-site">${esc(site.name)}</div>
      <span class="sus-pill-status k-${esc(site.status_kind || 'neutral')}">${esc(site.status_pill || '—')}</span>
      <span class="sus-meta">Operator <b>${esc(site.operator)}</b></span>
      <span class="sus-meta">${esc(site.basin)}</span>
      ${site.aoi ? `<span class="sus-meta">AOI <b>${esc(site.aoi)}</b></span>` : ''}
      <span class="sus-lastfused">Last fused: ${esc(site.last_fused)} · ${esc(site.method_label)}</span>
    </div>`
  );
}

function renderHero(site) {
  const kind = site.status_kind || 'neutral';
  const pillWord = esc(site.status_pill || '—');

  if (!site.obligations_mapped) {
    // Unmapped jurisdiction — never show another jurisdiction's filings.
    return (
      `<div class="sus-hero">
        <div class="sus-hero-pill">
          <div class="sus-dot k-${esc(kind)}"></div>
          <h2>${pillWord}</h2>
          <div class="sus-sub">${esc(site.method_label)}</div>
        </div>
        <div class="sus-hero-statement unmapped">
          <div class="sus-readiness">Obligations <span class="sus-em">not yet mapped</span> for this jurisdiction (${esc(site.jurisdiction)}) — observation evidence available below.</div>
          <div class="sus-obs-line">No filings, deadlines or regulators are asserted for this site.</div>
        </div>
      </div>`
    );
  }

  // Mapped site — hero leads with nearest FILING READINESS.
  const h = site.hero || {};
  const remind = h.remindable
    ? `<button type="button" class="sus-remind" aria-disabled="true" title="Visual only — reminders are not wired in this demo">${BELL_SVG} remind me</button>`
    : '';
  return (
    `<div class="sus-hero">
      <div class="sus-hero-pill">
        <div class="sus-dot k-${esc(kind)}"></div>
        <h2>${pillWord}</h2>
        <div class="sus-sub">${esc(site.method_label)} · <b>filing readiness</b></div>
      </div>
      <div class="sus-hero-statement">
        <div class="sus-readiness">Nearest filing — <span class="sus-em">${esc(h.filing)}</span> · ${esc(h.regulator)} · due <span class="sus-em">${esc(h.due_label || h.due)}</span> · <span class="sus-em-good">${esc(h.draft_status)}</span></div>
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          ${remind}
          ${h.observation_line ? `<span class="sus-obs-line">${esc(h.observation_line)}</span>` : ''}
        </div>
      </div>
    </div>`
  );
}

function renderObligations(site) {
  if (!site.obligations_mapped) {
    return (
      `<div class="sus-eyebrow">01 — Reporting obligations · <b>this location</b></div>
      <div class="sus-notmapped">
        <div class="sus-nm-title">Obligations not yet mapped for this jurisdiction</div>
        <div class="sus-nm-body">Aletheia has not yet mapped the statutory reporting regime for <b>${esc(site.jurisdiction)}</b>. To stay honest, no filings, regulators or deadlines are shown for this site — only the real satellite observation below. The obligation library is built per jurisdiction; this one is pending.</div>
      </div>`
    );
  }

  const rows = site.obligations || [];
  let body = '';
  let lastTier = null;
  rows.forEach(r => {
    if (r.tier !== lastTier) {
      body += `<tr class="sus-tierband"><td colspan="5">${esc(r.tier)}</td></tr>`;
      lastTier = r.tier;
    }
    const chipClass = CHIP_CLASS[r.status_kind] || 'c-neutral';
    body += (
      `<tr>
        <td class="sus-fil">${esc(r.filing)}</td>
        <td class="sus-reg">${esc(r.regulator)}</td>
        <td class="sus-mono">${esc(r.frequency)}</td>
        <td class="sus-mono">${esc(r.next_deadline)}</td>
        <td><span class="sus-chip ${chipClass}">${esc(r.status_chip)}</span></td>
      </tr>`
    );
  });

  return (
    `<div class="sus-eyebrow">01 — Reporting obligations · <b>this location</b></div>
    <div class="sus-card">
      <table class="sus-table">
        <thead><tr>
          <th style="width:30%">Filing</th><th style="width:22%">Regulator / recipient</th>
          <th style="width:13%">Frequency</th><th style="width:15%">Next deadline</th><th style="width:20%">Status</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`
  );
}

function renderPollutantCard(p) {
  const vKind = p.verdict_kind || 'neutral';
  const valHtml = p.value_pending
    ? `<span class="sus-val pend">${esc(p.value)}</span>`
    : `<span class="sus-val">${esc(p.value)}</span>${p.unit ? `<span class="sus-unit">${esc(p.unit)}</span>` : ''}`;
  const rows = (p.rows || []).map(r =>
    `<div class="sus-cmp-row"><span class="k">${esc(r.k)}</span><span class="v${r.pending ? ' pend' : ''}">${esc(r.v)}</span></div>`
  ).join('');
  return (
    `<div class="sus-poll">
      <div class="sus-poll-h"><span class="sus-name">${esc(p.name)}</span><span class="sus-stream">${esc(p.stream)}</span></div>
      <div class="sus-obs-label">${esc(p.obs_label)}</div>
      <div class="sus-obs">${valHtml}</div>
      <div class="sus-verdict k-${esc(vKind)}">${esc(p.verdict)}</div>
      <div class="sus-cmp">${rows}</div>
      ${p.note ? `<div class="sus-note">${esc(p.note)}</div>` : ''}
    </div>`
  );
}

function renderByPollutant(site) {
  const cards = (site.by_pollutant || []).map(renderPollutantCard).join('');
  return (
    `<div class="sus-eyebrow">02 — By pollutant · <b>observed evidence vs requirement &amp; prior years</b></div>
    <div class="sus-poll-grid">${cards}</div>`
  );
}

function renderFilings(site, manifest) {
  if (!site.obligations_mapped) return ''; // mapped sites only
  const cards = (site.filings || []).map(f =>
    `<div class="sus-filing"><span class="sus-ttl">${esc(f.ttl)}</span><span class="sus-rg">${esc(f.rg)}</span><span class="sus-btn">Preview draft →</span></div>`
  ).join('');
  const legend = (manifest.provenance_legend || []).map(l =>
    `<span><span class="sus-sq ${esc(l.kind)}"></span>${esc(l.label)}</span>`
  ).join('');
  return (
    `<div class="sus-eyebrow">03 — Filing · <b>filing-ready drafts (human signs)</b></div>
    <div class="sus-filing-grid">${cards}</div>
    <div class="sus-signoff">${esc(manifest.signoff)}</div>
    <div class="sus-legend">${legend}</div>`
  );
}

function renderEvidence(site) {
  return (
    `<div class="sus-evidence">
      <button type="button" class="sus-ev-link" id="sus-view-evidence">View full observation evidence →</button>
      <span class="sus-ev-method">${esc(site.method_label)}</span>
      <span class="sus-ev-cap">TROPOMI / VIIRS · screening-grade · independent</span>
    </div>`
  );
}

function renderCompliance(site, manifest) {
  return (
    `<div class="sus-wrap">
      ${renderHeader(site)}
      ${renderHero(site)}
      ${renderObligations(site)}
      ${renderByPollutant(site)}
      ${renderFilings(site, manifest)}
      ${renderEvidence(site)}
      <div class="sus-footer">${esc(manifest.footer)}</div>
    </div>`
  );
}

// ---------- public API ----------

// Wire the modal once. onEvidence(facility) is called when the user clicks the
// "View full observation evidence" link — main.js opens the (unchanged)
// observation report from there.
export function initSustainabilityCompliance(opts = {}) {
  onViewEvidence = typeof opts.onViewEvidence === 'function' ? opts.onViewEvidence : null;
  const modal = document.getElementById('sus-compliance-modal');
  if (!modal) return;

  document.getElementById('sus-btn-close-report')?.addEventListener('click', () => {
    modal.classList.remove('open');
  });

  // Delegated: the evidence link is re-rendered on every open.
  const content = document.getElementById('sus-compliance-modal-content');
  content?.addEventListener('click', (e) => {
    if (e.target.closest('#sus-view-evidence')) {
      if (onViewEvidence) onViewEvidence(susCurrentFacility);
    }
  });
}

// Open the compliance front page for a facility view-model.
export function openSustainabilityCompliance(f) {
  susCurrentFacility = f;
  const modal = document.getElementById('sus-compliance-modal');
  const content = document.getElementById('sus-compliance-modal-content');
  if (!modal || !content) return;

  loadSusManifest().then(manifest => {
    if (!manifest) {
      content.innerHTML = '<div class="sus-wrap"><div class="sus-footer">Compliance manifest unavailable.</div></div>';
      modal.classList.add('open');
      return;
    }
    const site = matchSusSite(f, manifest);
    if (!site) {
      console.warn(`[sustainability] no manifest site matched facility "${f && f.name}" (id="${f && f.id}")`);
      content.innerHTML = '<div class="sus-wrap"><div class="sus-footer">No compliance profile for this site.</div></div>';
      modal.classList.add('open');
      return;
    }
    content.innerHTML = renderCompliance(site, manifest);
    modal.classList.add('open');
  });
}
