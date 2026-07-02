// ask_grounding.js
// SINGLE source of truth for what "Ask Aletheia" is grounded on.
//
// The app has ONE shared chat drawer (bound once in main.js). Historically its
// grounding was driven by the Sustainability report's state, so the chat could
// only ground on Sustainability facilities. This module decouples that: ANY
// pillar (Sustainability, Operational Efficiency, Asset Security) that opens a
// facility dashboard registers a LIVE context provider here, and the drawer reads
// ONLY from here via getGroundingContext().
//
// A "provider" is a function returning { f, scenario } for the facility currently
// in focus — live, so on-page scenario state (levers, goal, …) stays current.
// When nothing is grounded (bare map, launchpad, public pages) the provider is
// null and the drawer greets with "select a facility".

let provider = null;                 // () => ({ f, scenario }) | null
let drawerRefresh = () => {};        // set by the drawer owner (main.js)
const changeListeners = new Set();   // notified on set/clear (toggle the FAB)

// The drawer owner registers how to re-paint the drawer (grounding line + greet)
// so any pillar's setGrounding() can refresh it without importing main.js.
export function registerDrawer(refresh) {
  drawerRefresh = typeof refresh === 'function' ? refresh : (() => {});
}

// A pillar opened a facility dashboard: register its live context provider.
export function setGrounding(providerFn) {
  provider = typeof providerFn === 'function' ? providerFn : null;
  changed();
}

// Left the facility dashboard: nothing is grounded anymore.
export function clearGrounding() {
  provider = null;
  changed();
}

// What the drawer reads. Null when nothing is grounded.
export function getGroundingContext() {
  return provider ? (provider() || null) : null;
}

// True only when a real facility is grounded (drives FAB visibility).
export function hasGrounding() {
  const ctx = getGroundingContext();
  return !!(ctx && ctx.f);
}

// Subscribe to grounding set/clear (main.js uses this to show/hide the launcher).
export function onGroundingChange(cb) {
  if (typeof cb === 'function') changeListeners.add(cb);
}

function changed() {
  try { drawerRefresh(); } catch { /* drawer may not be wired yet */ }
  changeListeners.forEach(cb => { try { cb(); } catch { /* isolate listeners */ } });
}
