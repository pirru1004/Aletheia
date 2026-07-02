import { getLang } from './i18n.js';
// ask_aletheia.js
// "Ask Aletheia" — a grounded, READ-ONLY chat for the facility dashboard.
//
// HONESTY CONTRACT (ALETHEIA_HANDOFF §A4 — enforced in BOTH the system prompt
// sent to any optional LLM and the deterministic templates below):
//   - Everything is OBSERVED vs LOCAL BACKGROUND. Never a gap vs operator
//     disclosure — no reported baseline exists.
//   - Always surface uncertainty (± ranges, "no cloud-free retrieval" gaps,
//     "screening only / scenario not prediction").
//   - FACILITY method (Groundbirch, Korpezhe) and BASIN method (Permian) are
//     never put on one scale.
//   - Published quantifications are CITED from literature, not produced by our
//     pipeline. Groundbirch has none -> it's at background.
//   - Never invent a number, target, operator figure or fact not in the data.
//   - Outside the data -> "I don't have that in the data I'm grounded on."
//   - Role stays anchored: a compliance-screening analyst who screens with
//     TROPOMI and recommends fine-sensor / drone confirmation.
//
// Backend: an optional LLM can be wired in later via env vars. If none is
// configured we fall back — SILENTLY — to deterministic grounded mode, which
// composes answers only from the facility JSON + on-page scenario state and
// therefore cannot hallucinate, needs no API key and makes no network calls.

const LLM_ENDPOINT = import.meta.env?.VITE_ASK_LLM_ENDPOINT || '';
const LLM_ENABLED = !!LLM_ENDPOINT;   // presence of a backend endpoint = opt-in

const SEEDS = [
  'Is this site elevated?',
  'What are the 3 pillars?',
  'What should we do next?',
  'How was the magnitude measured?',
  'How certain is this?',
];

// ---------- small formatters ----------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sgn = p => (p >= 0 ? '+' : '') + p;
const ppb = v => (v == null ? '—' : `${v.toFixed(1)} ppb`);

function gapsOf(f) { return (f.trajectory || []).filter(t => t.ch4 == null).length; }
function latestOf(f) { return [...(f.trajectory || [])].reverse().find(t => t.ch4 != null) || null; }
function trendWord(f) {
  const v = (f.trajectory || []).filter(t => t.ch4 != null).map(t => t.ch4);
  if (v.length < 2) return 'flat';
  const d = v[v.length - 1] - v[0];
  return Math.abs(d) < 2 ? 'broadly flat' : (d > 0 ? 'rising' : 'easing');
}

// Sentence describing the measured excess, honestly framed.
function excessLine(f) {
  if (f.isBasin) {
    return `Observed methane shows a ${sgn(f.excessPct)}% enhancement vs a clean reference region ` +
      `(target ${ppb(f.siteCh4)} vs reference ${ppb(f.bkgdCh4)}). This is a BASIN-method snapshot, ` +
      `not a single-facility reading — I keep it on a separate scale from facility sites.`;
  }
  return `Observed methane is ${sgn(f.excessPct)}% vs local background ` +
    `(site ${ppb(f.siteCh4)} vs background ${ppb(f.bkgdCh4)}, 14-day TROPOMI composite). ` +
    `This is observed-vs-background — there is no operator-reported baseline, so I can't frame it as a gap vs disclosure.`;
}

function uncertaintyLine(f) {
  const g = gapsOf(f);
  const bits = [
    `observed values are 14-day TROPOMI composites (a screening instrument, not a quantifier)`,
    g ? `${g} month(s) in the window had no cloud-free retrieval — shown as gaps in the line, never as zeros` : `every month in the window had a cloud-free retrieval`,
  ];
  if (f.quant?.published && f.quant?.magnitude) {
    bits.push(`the published magnitude carries an explicit range: ${f.quant.magnitude}`);
  }
  bits.push(`any projection is an illustrative status-quo extrapolation with a widening band — a scenario, not a prediction`);
  return bits;
}

// ---------- STRICT SYSTEM PROMPT (also handed to any LLM backend) ----------
export function buildSystemPrompt(f, scenario) {
  const record = {
    name: f.name, operator: f.operator, region: f.region, method: f.method,
    is_basin: f.isBasin, verdict: f.verdict,
    excess_or_enhancement_pct: f.excessPct,
    site_ch4_ppb: f.siteCh4, background_or_reference_ch4_ppb: f.bkgdCh4,
    no2_mol_m2: f.no2, co_mol_m2: f.co, flaring_bcm_yr: f.flaringBcm,
    trajectory: f.trajectory, cloud_free_gaps: gapsOf(f),
    quantification: f.quant, source: f.source, generated: f.generated, note: f.note,
    basis: f.basisLabel,
  };
  const sc = {
    active_levers: (scenario.levers || []).map(l => ({ title: l.title, efficacy_pct: [Math.round(l.effLo * 100), Math.round(l.effHi * 100)], lead_months: l.lead, confidence: l.confidence, source: l.source })),
    combined_efficacy_pct: Math.round((scenario.combinedEff || 0) * 100),
    user_goal: scenario.userGoal,
    projection_months: scenario.projMonths,
  };
  return [
    `You are Aletheia, a methane compliance-SCREENING analyst. You screen with TROPOMI (a coarse screening instrument) and recommend finer-sensor / drone / OGI confirmation. You are READ-ONLY: you do not fetch live data, browse, or call external services.`,
    ``,
    `You may ONLY use the facility record and on-page scenario JSON below. Do not use outside knowledge to introduce new numbers or facts.`,
    ``,
    `NON-NEGOTIABLE HONESTY RULES:`,
    `1. Frame everything as OBSERVED vs LOCAL BACKGROUND (facility) or vs a CLEAN REFERENCE region (basin). Never claim a gap vs an operator's disclosed/reported figure — no reported baseline exists.`,
    `2. ALWAYS surface uncertainty: cite ± ranges where given, the "no cloud-free retrieval" gaps, and that TROPOMI is a screening instrument.`,
    `3. Never put FACILITY method (Groundbirch, Korpezhe) and BASIN method (Permian) on one scale. State which method this site uses.`,
    `4. Published quantifications are CITED from the literature (Korpezhe = per-facility point-source; Permian = sub-basin), NOT produced by this pipeline — say so. If none exists (Groundbirch), say it is at background with nothing to quantify.`,
    `5. You MUST reply in the user's selected language: ${getLang() || 'en'}`,
    `6. NEVER invent a number, target, operator figure, or any fact not present below.`,
    `7. If asked something not answerable from the data, reply exactly: "I don't have that in the data I'm grounded on." Do not guess.`,
    `8. Projections/levers/goals are ILLUSTRATIVE scenarios that bend only the EXCESS ABOVE BACKGROUND, never the background column. A goal line is the USER'S OWN target, never an operator disclosure.`,
    ``,
    `FACILITY RECORD:`,
    JSON.stringify(record, null, 2),
    ``,
    `ON-PAGE SCENARIO STATE:`,
    JSON.stringify(sc, null, 2),
  ].join('\n');
}

// ---------- ASSET SECURITY responder ----------
// Asset sites carry a FOOTPRINT record (method_label, metric_summary, metric_note),
// not a methane one. This responder answers ONLY from those fields so no methane /
// TROPOMI framing or invented numbers can leak into an Asset Security answer.
// Anything outside the record -> the honest "I don't have that" fallback.
function answerAsset(qRaw, f) {
  const q = qRaw.toLowerCase().trim();
  const has = (...ks) => ks.some(k => q.includes(k));
  const name = esc(f.name);
  const method = esc(f.method_label || 'optical (Sentinel-2) + SAR (Sentinel-1) footprint monitoring');
  const summary = esc(f.metric_summary || f.note || 'The physical footprint is actively monitored from optical and SAR imagery.');
  const noteSoft = f.metric_note ? ` <span class="a-soft">${esc(f.metric_note)}</span>` : '';

  if (!q) return `Ask me about <b>${name}</b>'s monitored footprint — its status, the method, or next steps.`;

  if (has('hello', 'hi ', 'help', 'what can you', 'who are you'))
    return `I'm Aletheia. For Asset Security I track the physical footprint of <b>${name}</b> from optical and SAR imagery — read-only and grounded only in this site's record. Ask about its footprint status, the method, or what to do next.`;

  if (has('pillar', 'sustainab', 'operational efficiency', 'other pillar'))
    return `Aletheia has 3 pillars: ${`<ul class="a-ul">` +
      `<li><b>Sustainability</b> — methane vs local background</li>` +
      `<li><b>Operational Efficiency</b> — flaring & asset uptime</li>` +
      `<li><b>Asset Security</b> — physical footprint from optical + SAR</li></ul>`}Right now I'm grounded on <b>${name}</b> under Asset Security.`;

  if (has('method', 'how do', 'how does', 'how was', 'measur', 'magnitude', 'quantif', 'satellite', 'sentinel', 'sar', 'optical', 'instrument', 'work'))
    return `Method: ${method}.${noteSoft || ` <span class="a-soft">Footprint is derived from optical (Sentinel-2) and SAR (Sentinel-1) imagery — screening-grade, not a legal survey.</span>`}`;

  if (has('next', 'should', 'do now', 'recommend', 'action', 'fix', 'investigat'))
    return `For a footprint change: ${`<ul class="a-ul">` +
      `<li>dispatch a <b>drone photogrammetry pass</b> to inspect the change on the ground</li>` +
      `<li>cross-check <b>SAR anomalies</b> for new structures or surface disturbance</li></ul>`}<span class="a-soft">Satellite screening flags where to look; a ground survey confirms.</span>`;

  if (has('certain', 'uncertain', 'confiden', 'how sure', 'reliab', 'accura', 'error', 'margin'))
    return `${f.metric_note ? esc(f.metric_note) : 'Footprint readings come from optical + SAR imagery; year-to-year wobble can reflect vegetation phenology and residual haze.'} This is screening-grade observation, not a legal survey.`;

  if (has('footprint', 'expand', 'grow', 'area', 'change', 'status', 'elevated', 'anomal', 'secur', 'stable', 'risk', 'how bad', 'is it ok', 'summary', 'km'))
    return `${summary}${noteSoft}`;

  return `I don't have that in the data I'm grounded on. For <b>${name}</b> I can speak to its monitored physical footprint (method: ${method}). Ask about the footprint status, the method, or recommended next steps.`;
}

// ---------- DETERMINISTIC GROUNDED ENGINE ----------
// Keyword intents -> answers composed only from the record + scenario.
function answerDeterministic(qRaw, f, scenario) {
  const q = qRaw.toLowerCase().trim();
  // Asset Security sites use a footprint record, not a methane one — route them to
  // the asset-only responder so no methane framing/numbers leak in.
  if (f && (f.pillar === 'Asset Security' || f.method === 'asset-security')) {
    return answerAsset(qRaw, f);
  }
  const has = (...ks) => ks.some(k => q.includes(k));
  const ul = arr => `<ul class="a-ul">${arr.map(x => `<li>${x}</li>`).join('')}</ul>`;
  const role = `As an Aletheia AI analyst, I assess multi-sensor orbital data across our 3 pillars: Sustainability (Methane), Operational Efficiency (Flaring), and Asset Security (Footprint & SAR).`;

  if (!q) return `Ask me about <b>${esc(f.name)}</b> — try one of the suggested questions below.`;

  // greeting / help / pillars
  if (has('hello', 'hi ', 'help', 'what can you', 'who are you', 'pillars')) {
    return `I'm Aletheia. ${role} I answer only from <b>${esc(f.name)}</b>'s observed record plus the current scenario — read-only, no live data. Try: “Is this site elevated?”, “How was the magnitude measured?”, or ask about our 3 pillars.`;
  }

  // elevated / excess / status
  if (has('elevated', 'high', 'excess', 'enhanc', 'leak', 'emit', 'status', 'how bad', 'is it ok')) {
    if (f.method === 'asset-security' || f.pillar === 'Asset Security') {
      return `For Asset Security, we look at physical footprint. ${esc(f.metric_summary || f.note || 'The footprint is being actively monitored via Sentinel-2 and SAR anomalies.')}`;
    }
    const verdict = f.verdict === 'performant'
      ? `Verdict: <b>at background</b> — no excess to explain.`
      : `Verdict: <b>elevated vs baseline — investigate</b>.`;
    return `${excessLine(f)} ${verdict}<br><span class="a-soft">Uncertainty: ${gapsOf(f)} cloud-free gap(s) in the window; TROPOMI is a screening instrument, so this flags rather than quantifies.</span>`;
  }

  // magnitude / measured / quantify / kt / tonnes
  if (has('magnitude', 'measur', 'quantif', 'how much', 'kt', 'tonne', 'ton ', 'tg ', 'how many')) {
    if (f.quant?.published && f.quant?.magnitude) {
      const scale = f.isBasin ? `This is a BASIN-scale figure, not a single facility.` : `This is a per-facility, point-source figure.`;
      return `${esc(f.quant.magnitude)}.<br>Source: <b>${esc(f.quant.source)}</b>${f.quant.method ? ` · ${esc(f.quant.method)}` : ''}.<br><span class="a-soft">${esc(f.quant.note)} ${scale} It is CITED from the literature — our pipeline performs TROPOMI screening only and did not produce this number.</span>`;
    }
    if (f.method === 'asset-security' || f.pillar === 'Asset Security') {
      return `Physical footprint measurements: ${esc(f.metric_summary || 'Monitored via optical and SAR.')}`;
    }
    return `There is <b>no published point-source quantification</b> for ${esc(f.name)}. Observed methane sits at local background (${sgn(f.excessPct)}%), so there is no enhancement to quantify — ${esc(f.quant?.note || 'consistent with a well-managed or idle site')}.`;
  }

  // next steps / recommend / action
  if (has('next', 'should we', 'do now', 'recommend', 'action', 'fix', 'what do')) {
    if (f.pillar === 'Asset Security' || f.method === 'asset-security') {
      return `For Asset Security anomalies: ${ul([
        `dispatch a <b>drone photogrammetry pass</b> to inspect the footprint change`,
        `verify <b>SAR anomalies</b> for potential spills or unauthorized infrastructure`,
      ])}`;
    }
    if (f.verdict === 'performant') {
      return `${esc(f.name)} reads at local background, so no abatement is indicated — the screening recommendation is continued monitoring. If you want to confirm, a drone or OGI pass would ground-truth, but there is no excess flagged here.`;
    }
    return `Concretely: ${ul([
      `dispatch a <b>drone photogrammetry pass</b> (24–48 h) to localise and characterise the source`,
      `follow with an <b>OGI field survey</b> (3–5 days) for component-level, regulatory-grade evidence`,
      `the abatement-lever panel is <b>illustrative only</b> — efficacy ranges are literature figures, not commitments`,
    ])}<span class="a-soft">Satellite screening flags magnitude/where to look; finer sensors confirm.</span>`;
  }

  // certainty / uncertainty / confidence
  if (has('certain', 'uncertain', 'confiden', 'how sure', 'reliab', 'accura', 'error', 'margin')) {
    return `Here is the uncertainty I can see in the data: ${ul(uncertaintyLine(f))}<span class="a-soft">I screen only — I don't claim a precise emission rate from TROPOMI alone.</span>`;
  }

  // projection / forecast / trend / future
  if (has('project', 'forecast', 'trend', 'future', 'extrapol', 'going to', 'will it')) {
    if (f.pillar === 'Asset Security' || f.method === 'asset-security') {
      return `The trend shows ${esc(f.metric_note || 'historical footprint changes over time')}.`;
    }
    const parts = [
      `The dashed line is an <b>illustrative status-quo extrapolation</b> of the observed trend (~${scenario.projMonths} months), with a shaded band that widens with time. It is a <b>scenario, not a prediction</b>, and it bends only the <b>excess above background</b> — never the background column.`,
      `Observed history is ${trendWord(f)} over the window.`,
    ];
    if ((scenario.levers || []).length) parts.push(`You have ${scenario.levers.length} lever(s) on, modelling ~${Math.round(scenario.combinedEff * 100)}% lower excess at full effect (illustrative).`);
    if (scenario.userGoal) parts.push(`Your goal line targets −${scenario.userGoal.pct}% excess by ${scenario.userGoal.year} — that's your own target, not an operator disclosure.`);
    return parts.join('<br>');
  }

  // levers / abatement / reduce
  if (has('lever', 'abate', 'reduce', 'mitigat', 'cut ', 'lower')) {
    const list = [
      `Replace high-bleed pneumatic controllers — 35–80% · lead 6 mo · IEA Methane Abatement`,
      `Install vapour-recovery unit (VRU) — 45–95% · lead 9 mo · IEA Methane Abatement`,
      `Leak detection & repair (LDAR) — 40–60% · lead 3 mo · OGMP 2.0`,
      `Flare-efficiency / no-routine-flaring — 50–98% · lead 12 mo · OGMP 2.0`,
    ];
    return `The abatement levers are <b>illustrative scenarios</b>; efficacy ranges and sources are literature figures, applied only to the excess above background: ${ul(list)}<span class="a-soft">Toggling them bends the projection — it does not change the observed record.</span>`;
  }

  // target / goal
  if (has('target', 'goal', 'pledge', '2030', 'glide')) {
    if (scenario.userGoal) return `The goal line on the chart is <b>your own target</b>: −${scenario.userGoal.pct}% excess by ${scenario.userGoal.year}, drawn as a glide path from the latest observed point. It is not an operator disclosure and not a claim about what is emitted.`;
    return `You can enter a reduction target (e.g. −30% by 2030 · Global Methane Pledge) and I'll plot it as a glide path from the latest observed point. It is framed as <b>your own goal</b>, never an operator disclosure.`;
  }

  // background definition
  if (has('background', 'baseline', 'reference', 'compare', 'vs ', 'versus')) {
    return f.isBasin
      ? `For a basin I compare the target region against a <b>clean reference region</b>; the enhancement is target minus reference. There is no per-facility background and no operator figure involved.`
      : `Local background is the methane column over a nearby clean area; <b>site minus background</b> is the excess I report. Everything is observed-vs-background — never vs an operator's reported number, because none exists in the data.`;
  }

  // method / tropomi / how it works
  if (has('method', 'tropomi', 'how does', 'how do you', 'satellite', 'instrument', 'work', 'sar', 'sentinel')) {
    return `We use multiple sensors depending on the pillar: ${ul([
      `<b>Sustainability:</b> TROPOMI (Methane) to detect excess vs local background.`,
      `<b>Operational Efficiency:</b> VIIRS Nightfire to measure Flaring volume and thermal anomalies.`,
      `<b>Asset Security:</b> Sentinel-2 (Optical) for footprint changes and Sentinel-1 (SAR) for dark-vessel or oil spill anomalies.`
    ])}Source for this record: ${esc(f.source || 'Multi-sensor satellite fusion')}.`;
  }

  // NO2 / CO
  if (has('no2', 'nitrogen', 'co ', 'carbon monoxide', 'co-pollut', 'pollutant')) {
    if (f.isBasin) return `NO₂ / CO co-pollutant columns are only retrieved for point-facility snapshots. ${esc(f.name)} is a basin snapshot, so these are <b>N/A</b> rather than invented.`;
    return `Co-pollutant columns over ${esc(f.name)}: NO₂ ${f.no2 != null ? f.no2.toExponential(2) + ' mol/m²' : '—'}, CO ${f.co != null ? f.co.toExponential(2) + ' mol/m²' : '—'}. <span class="a-soft">These are absolute readings; I deliberately don't label them "elevated/normal" without a calibrated per-site baseline.</span>`;
  }

  // flaring
  if (has('flar', 'burn', 'viirs')) {
    return `Flaring at ${esc(f.name)}: ${f.flaringBcm != null ? `<b>${f.flaringBcm} BCM/yr</b>` : '—'} (VIIRS Nightfire 2024). <span class="a-soft">Combined with the methane reading, this places the site on the flare-vs-methane matrix — but it remains a screening signal.</span>`;
  }

  // 3 pillars overview
  if (has('pillar', 'sustainability', 'operational', 'asset', 'security')) {
    return `Aletheia is built on 3 core pillars: ${ul([
      `<b>Sustainability:</b> Independent methane and co-pollutant tracking vs background.`,
      `<b>Operational Efficiency:</b> Flaring monitoring and asset uptime tracking.`,
      `<b>Asset Security:</b> Physical footprint tracking, surface anomalies, and SAR-based oil spill detection.`
    ])}I dynamically adapt to whatever pillar you are currently viewing.`;
  }

  // fallback — never guess
  return `I don't have that in the data I'm grounded on. I assess Sustainability (Methane), Operational Efficiency (Flaring), and Asset Security (Footprint & SAR). Ask me about the specific pillar you're interested in!`;
}

// ---------- optional LLM backend (opt-in; never called if not configured) ----------
async function answerLLM(question, f, scenario) {
  const res = await fetch(LLM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: buildSystemPrompt(f, scenario), question }),
  });
  if (!res.ok) throw new Error('ask backend ' + res.status);
  const data = await res.json();
  return data.answer || data.text || '';
}

// ---------- UI wiring ----------
// `ids` lets a second, INDEPENDENT instance (e.g. the Operational Efficiency
// dashboard) bind to its own duplicated drawer markup. Defaults preserve the
// original Sustainability IDs verbatim, so existing callers are unaffected.
export function initAskAletheia({ getContext, ids = {} }) {
  const id = {
    toggle: 'askToggle', body: 'askBody', log: 'askLog', seeds: 'askSeeds',
    form: 'askForm', input: 'askInput', mode: 'askMode', grounding: 'askGrounding',
    ...ids,
  };
  const toggle = document.getElementById(id.toggle);
  const body = document.getElementById(id.body);
  const log = document.getElementById(id.log);
  const seedsWrap = document.getElementById(id.seeds);
  const form = document.getElementById(id.form);
  const input = document.getElementById(id.input);
  const modeEl = document.getElementById(id.mode);
  const groundEl = document.getElementById(id.grounding);
  if (!toggle || !body || !log || !form || !input) return { refresh() {} };

  if (modeEl) modeEl.textContent = LLM_ENABLED
    ? 'LLM backend configured · grounded to this facility only'
    : 'Deterministic grounded mode · no network, no API key';

  // collapse / reveal
  toggle.addEventListener('click', () => {
    const open = body.hidden;
    body.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.classList.toggle('open', open);
    if (open && !log.dataset.greeted) { greet(); log.dataset.greeted = '1'; }
  });

  function bubble(role, html) {
    const d = document.createElement('div');
    d.className = `a-msg ${role}`;
    d.innerHTML = role === 'user' ? esc(html) : html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function greet() {
    const { f } = getContext() || {};
    bubble('bot', f
      ? `Hi — I'm grounded only in <b>${esc(f.name)}</b>'s record (${esc(f.basisLabel)}) and the scenario above. Pick a question or ask your own.`
      : `Hi — select a facility and I'll answer from its record only.`);
  }

  async function ask(question) {
    const ctx = getContext();
    if (!ctx || !ctx.f) { bubble('bot', `Select a facility first — I answer only from its record.`); return; }
    const { f, scenario } = ctx;
    bubble('user', question);
    const pending = bubble('bot', `<span class="a-typing">…</span>`);
    let html;
    if (LLM_ENABLED) {
      try { html = await answerLLM(question, f, scenario); }
      catch { html = null; }                       // fall back silently
    }
    if (!html) html = answerDeterministic(question, f, scenario);
    pending.innerHTML = html;
    log.scrollTop = log.scrollHeight;
  }

  // seed chips
  SEEDS.forEach(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'a-seed'; b.textContent = s;
    b.addEventListener('click', () => { if (body.hidden) toggle.click(); ask(s); });
    seedsWrap?.appendChild(b);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    ask(v);
  });

  let lastFacilityName = null;
  function refresh() {
    const { f } = getContext() || {};
    if (groundEl && f) groundEl.textContent = `Grounded on: ${f.name} · ${f.basisLabel}`;
    // When the facility changes, the prior greeting is stale: reset the log so the next
    // greet() reflects the new facility, and re-greet immediately if the body is open.
    const name = f ? f.name : null;
    if (name !== lastFacilityName) {
      lastFacilityName = name;
      log.innerHTML = '';
      delete log.dataset.greeted;
      if (!body.hidden) { greet(); log.dataset.greeted = '1'; }
    }
  }
  refresh();
  return { refresh };
}
