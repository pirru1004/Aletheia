/* ============================================================================
 * af-header.js — Aletheia shared PUBLIC-site top nav (namespace: af-)
 * ----------------------------------------------------------------------------
 * Renders ONE consistent header into every element carrying [data-af-header]:
 *   - "ALETHEIA" wordmark top-left (links home)
 *   - the same menu items in the same order (Product & Services, About ▾)
 *   - the account area (avatar / Login)
 * The landing mount adds data-af-hero for the dark, over-the-carousel variant.
 *
 * Works on BOTH the SPA (index.html) and the standalone subscription.html:
 *   - About items are hash links (/#overview, /#team); main.js routes them.
 *   - On the SPA, .auth-slot is left for main.js's renderAuthUI() to fill
 *     (avatar / Login+handler). On a standalone page there is no app runtime, so
 *     "Login" is a link back into the app (/).
 * In-app pillar dashboards keep their own contextual nav and are NOT touched.
 * ==========================================================================*/
(function () {
  // SPA (index.html) has #view-home; standalone marketing pages do not.
  const SPA = !!document.getElementById('view-home');

  function authHTML() {
    return SPA
      ? `<div class="auth-slot"><button class="primary-btn outline js-login-btn" data-i18n="nav.login">Login</button></div>`
      : `<div class="auth-slot"><a class="af-nav-login" href="/">Login</a></div>`;
  }

  function template() {
    return `
      <a class="af-nav-mark" href="/">ALETHEIA</a>
      <div class="af-nav-menu">
        <a class="af-nav-link" href="/subscription.html" data-i18n="nav.product">Product &amp; Services</a>
        <div class="af-nav-dd">
          <button class="af-nav-link af-nav-dd-toggle" type="button" aria-haspopup="true" aria-expanded="false">About &#9662;</button>
          <div class="af-nav-dd-menu" role="menu">
            <a class="af-nav-dd-item" href="/#overview" role="menuitem">Overview</a>
            <a class="af-nav-dd-item" href="/#team" role="menuitem">Team</a>
          </div>
        </div>
        ${authHTML()}
      </div>`;
  }

  // Per-instance dropdown: click to toggle, outside-click to close.
  function wireDropdown(nav) {
    const dd = nav.querySelector('.af-nav-dd');
    const toggle = dd && dd.querySelector('.af-nav-dd-toggle');
    if (!dd || !toggle) return;
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = dd.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!dd.contains(e.target)) {
        dd.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function render() {
    document.querySelectorAll('[data-af-header]').forEach((mount) => {
      if (mount.dataset.afHeaderDone) return;       // idempotent
      const nav = document.createElement('nav');
      nav.className = 'af-nav' + (mount.hasAttribute('data-af-hero') ? ' af-nav--hero' : '');
      nav.setAttribute('aria-label', 'Site navigation');
      nav.innerHTML = template();
      mount.appendChild(nav);
      wireDropdown(nav);
      mount.dataset.afHeaderDone = '1';
    });
  }

  if (document.querySelector('[data-af-header]')) render();
  else document.addEventListener('DOMContentLoaded', render);
})();
