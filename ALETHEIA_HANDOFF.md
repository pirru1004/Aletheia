# Aletheia — Integration Handoff

**For:** Claude working in the GitHub Codespace (repo: `pirru1004/Aletheia`)
**From:** Ludivine (COO) — the pipeline and data below were built and verified by me
**Date:** 2026-06-11
**Goal:** Wire the real satellite data we computed into the existing website, and harmonise the visual styling. Demo is **this Friday**.

---

## 0. Read this first — what this is and isn't

This is **not** a request to rebuild the site or the data pipeline. Both already exist:

- The **website** (Vite frontend + Node proxy + Firebase hosting) is built by David and lives at `mss26-satdat-pirru.web.app`. It currently displays **mock numbers** hardcoded in `src/aoi_data.js`.
- The **data pipeline** is a Google Colab notebook (`Aletheia.ipynb`, now committed to the repo) that pulls real satellite data and writes **`facilities.json`** (also committed). This is the source of truth. **Do not modify the pipeline logic** — only consume its output.

There are two workstreams, in priority order:

- **Workstream A — Data wiring (do this first).** Make the site read the real `facilities.json` instead of the mock data. This is what makes the demo *true*.
- **Workstream B — Visual harmonisation (do this second).** Unify the styling. Lower priority: a truthful demo in mixed styling beats a polished demo showing fake numbers.

### The dashboard is a template, not a fixed design

The facility dashboard was built by Ludivine in isolation as a *prototype* — a representation of how results *might* look for one facility. It was never meant to be plugged in as-is with its mock numbers. Treat it as an **empty shell**: a layout into which real numbers flow, where **the interpretation adapts to the data, not the other way round**. If the numbers say a site is clean, the dashboard must render green and "no action" — even though the prototype was mocked-up showing a red "venting" narrative. Adapting to truth is the feature; fabricating to match the mock is the failure mode.

A note on the **baseline** (the "reported / disclosure / target" line): obtaining it is a *separate future workstream* — parsing operator annual reports (e.g. Shell's, via PDF extraction) for self-reported figures, plus pulling published targets from frameworks (OGMP 2.0, Global Methane Pledge, IEA Net-Zero). **None of that exists for the demo.** So for Friday, any "reported/target/disclosure" element is illustrative only and must be hidden or clearly tagged — never populated with invented numbers.

---

## 1. What Aletheia is (context)

A satellite-based **emissions compliance-verification** platform. Tagline: *"what disclosure conceals, satellites reveal."* It fuses multiple public satellite sources to independently check methane/flaring at industrial facilities.

**Founding team:** David — CTO (technology & product). Ludivine — COO (product design & delivery). Vinay — CBO (finance, strategy, BD).

**Friday demo framing (important — this changed):** This is a **proof of concept**, *not* a Shell-specific pitch. The story is: *"the tool can tell a performant facility apart from one with room to improve."* We show three reference facilities, clearly labelled as public benchmark sites (not anyone's private assets):

| Facility | Type | Verdict | What it demonstrates |
|---|---|---|---|
| **Groundbirch** (Shell, Montney, Canada) | facility | 🟢 performant | A clean site — no excess, no flaring, no action needed |
| **Korpezhe** (state operator, Turkmenistan) | facility | 🟠 progress | A documented leaker — elevated methane + flaring |
| **Permian Basin** (multiple operators, USA) | basin | 🟠 progress | A whole basin with elevated emissions (US example for US audience) |

---

## 2. The real data: `facilities.json`

Committed to the repo (root, or `pipeline/` if moved). Three facilities, each with the schema below.

### Schema (facility type — Groundbirch, Korpezhe)

```json
{
  "name": "Groundbirch",
  "operator": "Shell plc",
  "region": "Montney, Canada",
  "method": "facility",
  "is_reference_site": true,
  "snapshot": {
    "lat": 55.962807,
    "lon": -121.077735,
    "methane_site_ppb": 1862.95,
    "methane_bkgd_ppb": 1864.99,
    "methane_excess_pct": -0.109,
    "no2_mol_m2": 1.1528e-05,
    "co_mol_m2": 0.02797
  },
  "methane_excess_pct": -0.109,
  "flaring_bcm_yr": 0.0,
  "trajectory": [
    {"month": "2025-05", "methane_ppb": 1875.04},
    {"month": "2025-11", "methane_ppb": null}
  ],
  "verdict": "performant",
  "source": "TROPOMI S5P CH4 / NO2 / CO; VIIRS Nightfire 2024",
  "generated": "2026-06-11",
  "note": "Public satellite data. Reference/benchmark site, not a specific operator's asset."
}
```

### Schema difference for the basin type (Permian) — IMPORTANT

The Permian uses a **different method** ("basin"), so its `snapshot` has **different keys**. Your adapter must handle both shapes:

```json
{
  "name": "Permian Basin (Delaware)",
  "operator": "Multiple operators",
  "region": "Texas/New Mexico, USA",
  "method": "basin",
  "snapshot": {
    "name": "Permian Basin (Delaware)",
    "lat": 31.9, "lon": -103.9,
    "target_ch4_ppb": 1929.64,
    "reference_ch4_ppb": 1884.22,
    "enhancement_pct": 2.411
  },
  "methane_excess_pct": 2.411,
  "flaring_bcm_yr": 0.089,
  "trajectory": [ ... ],
  "verdict": "progress"
}
```

So: facility snapshots have `methane_site_ppb` / `methane_bkgd_ppb` / `no2_mol_m2` / `co_mol_m2`; the basin snapshot has `target_ch4_ppb` / `reference_ch4_ppb` and **no NO₂/CO**. Don't assume NO₂/CO exist for the basin.

### The verified numbers

| | Groundbirch | Korpezhe | Permian (basin) |
|---|---|---|---|
| Coordinates | 55.9628, −121.0777 | 38.499, 54.199 | 31.9, −103.9 |
| Methane (site/target) | 1862.95 ppb | 1972.22 ppb | 1929.64 ppb |
| Background / reference | 1864.99 ppb | 1960.00 ppb | 1884.22 ppb |
| **Excess / enhancement** | **−0.109%** | **+0.624%** | **+2.411%** |
| Flaring (BCM/yr) | 0.0 | 0.0093 | 0.089 |
| NO₂ (mol/m²) | 1.15e-05 | 1.69e-05 | — (basin) |
| CO (mol/m²) | 0.0280 | 0.0319 | — (basin) |
| Trajectory | ~1860, winter gaps | ~1960–2015, full year | ~1916–1954, full year |
| **Verdict** | 🟢 performant | 🟠 progress | 🟠 progress |

---

## 3. Workstream A — Data wiring (priority 1)

### A1. Plumb the data in
- The frontend currently imports mock numbers from `src/aoi_data.js`. Replace that source with the real `facilities.json` (import it, or `fetch()` it from `public/`).
- Write a small **adapter** that maps `facilities.json` → whatever shape the dashboard components expect. Keep the mapping in one place.

### A2. Map three pins on the compliance map
- Currently only Groundbirch is shown. Add **Korpezhe** and **Permian** pins at their coordinates.
- Colour pins by `verdict`: `performant` → green, `progress` → amber.
- Selecting a pin loads that facility's panel.

### A3. Field mapping (our data → dashboard concepts)

| Dashboard element | Source field | Notes |
|---|---|---|
| Title / operator / region chips | `name`, `operator`, `region` | |
| Status badge | `verdict` | `performant`→green "no action"; `progress`→amber "investigate" |
| Headline excess number | `methane_excess_pct` (facility) / `enhancement_pct` (basin) | **Reframe — see A4** |
| "Site vs background" reading | `snapshot.methane_site_ppb` vs `methane_bkgd_ppb` (facility); `target_ch4_ppb` vs `reference_ch4_ppb` (basin) | |
| NO₂ / CO "do signals agree" bars | `snapshot.no2_mol_m2`, `co_mol_m2` | **Facility only.** Basin has none → show N/A, don't fabricate |
| Flaring reading | `flaring_bcm_yr` | Groundbirch = 0 (state this as a clean result, not "missing") |
| Trajectory chart "Observed" line | `trajectory[].methane_ppb` | `null` months = **gaps**, not zeros |
| Provenance footer | `source`, `generated`, `note` | Drives "Last fused" + the honest disclaimer |

### A4. CRITICAL honesty rules (do not skip)

These protect the integrity of the whole product ("what disclosure conceals, satellites reveal" only works if our own metrics are honest):

1. **Our metric is concentration excess, NOT methane intensity.** The mock dashboard headline reads *"methane intensity is 8% higher than Shell's disclosure (obs 0.205% · rep 0.190%)."* We did **not** measure intensity (% of throughput) and we have **no company disclosure data**. We measured **methane concentration excess above local background** (facility) or **enhancement vs a clean reference region** (basin). **Do not** plug `methane_excess_pct` into the "intensity vs disclosure" slot — that would be a false statement. **Reframe the headline** to: *"Observed methane is X% above local background"* (facility) / *"X% enhancement vs clean reference"* (basin).

2. **Groundbirch flips from amber to green.** The mock shows Groundbirch as *Watch / +8% / "venting or unlit flare" / understated by ~10%*. The **real data says the opposite**: −0.1% (no excess), zero flaring, performant. You must make the **green / "no action" state render correctly**, and the 2×2 interpretation matrix must land on **"burning cleanly / site idle"** (low-methane quadrant), **not** "venting/leak." If the interpretation text is hardcoded to the venting narrative, make it derive from the data (or at least switch per-verdict).

3. **No "Reported / disclosure" line yet — for any site.** The trajectory chart has a blue "Reported (Shell)" series and a "Basis for comparison" panel (Shell internal target, OGMP, GMP, IEA). Those are **mock/illustrative**. The real baseline is a *separate future workstream* (parse operator annual reports via PDF extraction for self-reported figures; pull published targets from OGMP 2.0 / GMP / IEA). Until that exists, **hide these series/panels or clearly tag them "illustrative."** The defensible comparison today is observed-vs-background (facility) / observed-vs-reference (basin).

4. **Facility vs basin are different methods — label them.** Don't present −0.1%, +0.6%, +2.4% as if they're one ranked scale. Show the method on each panel: *"facility · vs local background"* vs *"basin · vs clean reference."* This is a point of rigour, not a weakness.

5. **Never fabricate a missing field.** If a value isn't in `facilities.json` (e.g. basin NO₂, any reported/target line), show **N/A** or hide the element. Don't invent.

### A5. Verify after wiring
- Groundbirch panel shows green/performant, methane at background, zero flaring, trajectory with winter gaps.
- Korpezhe and Permian show amber/progress with their elevated numbers.
- No element claims "vs disclosure." No fabricated NO₂/CO on the basin.

---

## 4. Workstream B — Visual harmonisation (priority 2)

### The problem
The site has two clashing styles:
- **Outer shell** (landing hero + "Select Operational Pillar" page): glossy AI-generated hero photo, gradient-gold glossy buttons, emoji icons (🏠 ⚙️ 🛡️ 🌍), neon text-glow, generic dark-SaaS cards. This is the "default AI-builder" look.
- **Inner dashboard** (the compliance map + facility report we built): calm, editorial, monospace eyebrows, labelled metadata, restrained palette, flat cards.

### The direction: pull the shell toward the dashboard — not the reverse
The dashboard already matches Ludivine's portfolio aesthetic (`lceuranie.github.io`). So the good design already exists; only the shell needs to come into line. **Do not redesign the dashboard.**

### Target design language (from the portfolio + existing dashboard)
- **Eyebrows:** numbered monospace section labels (`01 — Overview`, `02 — Pillars`), like the portfolio's `01 — Featured Work`.
- **Metadata blocks:** labelled key-value pairs (`Status / …`, `Operator / …`, `Region / …`).
- **Tags:** small uppercase chips (e.g. `COMING SOON` becomes a quiet chip, not a glowing pill).
- **Palette:** a **light, neutral, white-label-ready** scheme — warm off-white surfaces, soft charcoal ink, **one** restrained teal accent, and **desaturated** status colours (calm sage / ochre / brick, not flashing traffic-light). This **replaces the current dark theme**. Full token set below. Rationale: a neutral light theme lets an investor picture it inside their own product and swap the single accent for their brand colour — much harder with an opinionated dark theme.
- **Type:** display sans (Space Grotesk, already used), body sans (IBM Plex Sans), monospace for labels/data (IBM Plex Mono). Reuse the dashboard's existing font + colour tokens — ideally one shared CSS variable set across shell and dashboard.
- **Feel:** generous whitespace, flat calm cards (thin border, no heavy glow), engineering/document tone (`rev.` / `Last fused:` style stamps).

### Concrete changes to the shell
- **Landing:** replace the glossy AI hero with a calmer treatment on the light paper background — a typographic hero, or a restrained / duotone EO image. Keep the tagline *"what disclosure conceals, satellites reveal."* Replace the gradient-gold "Login" with a quiet outline or single-fill teal button. Add a mono eyebrow.
- **Pillar selector:** drop the emoji icons for a consistent minimal line-icon set (or numbered cards `01 / 02 / 03`); make the cards flat and match the dashboard cards; `COMING SOON` as a quiet chip; single accent only.
- **Nav:** replace emoji (🏠 Home) with text or one consistent icon set.
- **Tokens:** unify typography + colour variables across the whole app so shell and dashboard are visibly one product.

### Colour palette (investor-neutral, light) — token set

Apply as one shared CSS variable set across shell and dashboard. Keep the existing type system (Space Grotesk display, IBM Plex Sans body, IBM Plex Mono labels).

```css
:root {
  /* surfaces */
  --paper:     #F7F5F1;  /* page background — warm off-white */
  --surface:   #FFFFFF;  /* cards */
  --inset:     #F0EDE7;  /* secondary panels, stat tiles */
  --hairline:  #E5E1D9;  /* borders, 1px */
  /* ink */
  --ink:       #222826;  /* primary text — warm charcoal, not pure black */
  --ink-2:     #6B716A;  /* secondary text */
  --ink-3:     #9CA099;  /* mono eyebrows, hints */
  /* accent — one only */
  --accent:    #1F6F6B;  /* deep teal */
  --accent-bg: #E4EFEE;  /* accent tint: chips, hovers */
  /* status — calm, desaturated (text uses the darker shade of same family) */
  --good:  #3F7E5E;  --good-bg:  #E8F0EA;  /* performant   (text #2E5C45) */
  --watch: #B5863C;  --watch-bg: #F4ECDC;  /* progress      (text #7A5A1E) */
  --alert: #B5544A;  --alert-bg: #F4E4E1;  /* needs attention (text #7C3A33) */
  /* data series */
  --series-observed: #1F6F6B;             /* satellite line */
  --series-reported: #5B7B9A;             /* reported/target — only render when real */
  --band:            rgba(181,134,60,.18);/* discrepancy band */
}
```

Status colours map to `verdict`: `performant` → `--good`, `progress` → `--watch`, (reserve `--alert` for a future high/red tier).

---

## 5. Do NOT do
- Do **not** rebuild the site or the pipeline from scratch.
- Do **not** edit the Colab pipeline logic — only consume `facilities.json`.
- Do **not** keep the "+8% vs Shell disclosure" headline for Groundbirch — it's false against the real data.
- Do **not** present basin and facility metrics as one ranked scale.
- Do **not** fabricate any value missing from `facilities.json`.
- Do **not** redesign the dashboard — bring the shell to it.

---

## 6. Known issues / open items (not blockers for Friday)
- **EOG programmatic access pending.** Flaring currently comes from a manual `VIIRS_2024.xlsx` upload in Colab. When EOG sends the OpenID client credentials, the pipeline will download flaring automatically. Not committed because it's large; the notebook documents the source (EOG / Colorado School of Mines, "Annual Gas Flared Volume 2024").
- **Trajectory month-stepping quirk.** `monthly_methane()` uses a "subtract 31 days" loop that occasionally skips/doubles a month near the present (e.g. `2026-04` missing). Cosmetic for the demo; fix when porting the notebook to a proper `.py` in the repo.
- **Schema inconsistency** between facility and basin snapshots (section 2) — the adapter must handle both shapes.
- **Mock leftovers to resolve:** the map embedded one figure (+8%) while `aoi_data.js` had another (+150%). Replace both with real data.

---

## 7. Suggested order of work
1. Wire `facilities.json` → 3 pins → per-facility panel (A1–A3).
2. Apply the honesty reframing (A4) — this is the part that makes the demo defensible.
3. Verify all three facilities render correctly (A5).
4. **Stop and confirm the demo is truthful and working.** This is a shippable state.
5. Then harmonise the shell styling (Workstream B) as time allows.
