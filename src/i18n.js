// i18n.js
// Global internationalization engine for Aletheia

export const dictionaries = {
  en: {
    // Nav & General
    "nav.product": "Product &amp; Services",
    "nav.login": "Login",
    "btn.enter": "Enter platform",
    
    // Splash / Landing
    "landing.tagline": "A decision intelligence company fusing satellite and ground data for predictable &amp; <span class=\"tagline-accent\">sustainable operations</span>.",
    
    // Slide 2: OE
    "slide.oe.tag": "live",
    "slide.oe.title": "Operational Efficiency",
    "slide.oe.desc": "Throughput, supply-chain logistics, and refinery-capacity utilisation — monitored from orbit.",
    
    // Slide 3: Asset Security
    "slide.as.tag": "monitoring",
    "slide.as.title": "Asset Security",
    "slide.as.desc": "Physical footprint expansion, border integrity, and critical infrastructure tracking.",

    // Pillars Selector
    "pillars.title": "Select a pillar to explore",
    "pillars.sustainability": "Sustainability",
    "pillars.sustainability_desc": "Methane tracking and independent verification",
    "pillars.operational": "Operational Efficiency",
    "pillars.operational_desc": "Flaring limits, downtime, and operational tracking",
    "pillars.security": "Asset Security",
    "pillars.security_desc": "Physical footprint and boundary anomalies",
    
    // Dashboard Map
    "map.layers_title": "Multi-Sensor Analysis Layers",
    "layer.methane": "TROPOMI Methane (CH₄)",
    "layer.flaring": "VIIRS Flaring (Nightfire)",
    "layer.optical": "Sentinel-2 True Color",
    "layer.sar": "Sentinel-1 SAR (Oil Spills)",
    
    // Reports
    "report.close": "Close report",
    "report.download": "Download Report (PDF)",
    
    // Chatbot UI
    "chat.title": "Ask Aletheia",
    "chat.subtitle": "grounded only in this facility's record · read-only, no live data",
    "chat.placeholder": "Ask about this facility…",
    "chat.ask_btn": "Ask",
    "chat.disclaimer": "Answers compose only from this facility's pipeline record + the scenario shown above. Aletheia screens with satellites and recommends fine-sensor / drone confirmation — it never fetches live data or browses.",

    // Dashboard UI
    "dashboard.title": "Aletheia Dashboard",
    "dashboard.auth": "Authenticated",
    "dashboard.home": "← Home",
    "dashboard.launchpad": "Authenticated launchpad",
    "dashboard.select_pillar": "Select a pillar",
    "dashboard.workspace_access": "Your workspace access determines which pillars are available.",
    "dashboard.open_workspace": "Open workspace →",
    "dashboard.coming_soon": "Coming soon",
    "dashboard.locked": "Locked",
    
    // Diagnostics
    "status.good.word": "No action",
    "status.good.sub": "no excess detected",
    "status.progress.word": "Investigate",
    "status.progress.sub": "elevated vs baseline",
    "status.default.word": "Review",
    
    "headline.basin": "Observed methane shows a {mag}% enhancement vs a clean reference region.",
    "headline.fac.bg": "Observed methane sits at local background — no excess detected ({pct}%).",
    "headline.fac.above": "Observed methane is {pct}% above local background.",
    "headline.fac.below": "Observed methane is {pct}% below local background.",

    "matrix.flare.high.label": "Poor combustion",
    "matrix.flare.high.desc": "incomplete burn",
    "matrix.noflare.high.label": "Venting / leak",
    "matrix.noflare.high.desc": "or unlit flare",
    "matrix.flare.low.label": "Burning cleanly",
    "matrix.flare.low.desc": "efficient combustion",
    "matrix.noflare.low.label": "Site idle",
    "matrix.noflare.low.desc": "genuinely inactive · no excess",
    
    // Footer
    "footer.contact": "Contact",
    "footer.contact_us": "Contact us",
    "footer.book_demo": "Book a demo",
    "footer.feedback": "Feedback",
    "footer.social": "Social",
    "footer.legal": "Terms &amp; Policies",
    "footer.terms": "Terms of Use",
    "footer.privacy": "Privacy Policy",
    "footer.disclaimer": "Disclaimer"
  },
  es: {
    // Nav & General
    "nav.product": "Producto y Servicios",
    "nav.login": "Iniciar Sesión",
    "btn.enter": "Entrar a la plataforma",
    
    // Splash / Landing
    "landing.tagline": "Una empresa de inteligencia de decisiones que fusiona datos satelitales y terrestres para <span class=\"tagline-accent\">operaciones sostenibles y predecibles</span>.",
    
    // Slide 2: OE
    "slide.oe.tag": "en vivo",
    "slide.oe.title": "Eficiencia Operativa",
    "slide.oe.desc": "Productividad, logística de la cadena de suministro y utilización de la capacidad de la refinería, monitoreados desde el espacio.",
    
    // Slide 3: Asset Security
    "slide.as.tag": "monitoreo",
    "slide.as.title": "Seguridad de Activos",
    "slide.as.desc": "Expansión de la huella física, integridad fronteriza y seguimiento de infraestructura crítica.",

    // Slide 4: Sustainability
    "slide.sus.tag": "en vivo",
    "slide.sus.title": "Sostenibilidad y Cumplimiento",
    "slide.sus.desc": "Verificación satelital independiente de metano y quema de gas, comparada con las declaraciones de los operadores.",

    // Pillars Selector
    "pillars.title": "Seleccione un pilar para explorar",
    "pillars.sustainability": "Sostenibilidad",
    "pillars.sustainability_desc": "Seguimiento de metano y verificación independiente",
    "pillars.operational": "Eficiencia Operativa",
    "pillars.operational_desc": "Límites de quema, tiempo de inactividad y seguimiento",
    "pillars.security": "Seguridad de Activos",
    "pillars.security_desc": "Anomalías en los límites y huella física",
    
    // Dashboard Map
    "map.layers_title": "Capas de Análisis Multisensor",
    "layer.methane": "Metano TROPOMI (CH₄)",
    "layer.flaring": "Quema de Gas VIIRS",
    "layer.optical": "Color Real Sentinel-2",
    "layer.sar": "SAR Sentinel-1 (Derrames)",
    
    // Reports
    "report.close": "Cerrar reporte",
    "report.download": "Descargar Reporte (PDF)",
    
    // Chatbot UI
    "chat.title": "Pregúntale a Aletheia",
    "chat.subtitle": "basado únicamente en el registro de esta instalación · solo lectura, sin datos en vivo",
    "chat.placeholder": "Pregunte sobre esta instalación…",
    "chat.ask_btn": "Preguntar",
    "chat.disclaimer": "Las respuestas se componen solo de los registros y escenarios de esta instalación. Aletheia no busca en internet.",

    // Dashboard UI
    "dashboard.title": "Panel de Aletheia",
    "dashboard.auth": "Autenticado",
    "dashboard.home": "← Inicio",
    "dashboard.launchpad": "Plataforma autenticada",
    "dashboard.select_pillar": "Selecciona un pilar",
    "dashboard.workspace_access": "Su acceso al espacio de trabajo determina qué pilares están disponibles.",
    "dashboard.open_workspace": "Abrir espacio de trabajo →",
    "dashboard.coming_soon": "Próximamente",
    "dashboard.locked": "Bloqueado",

    // Diagnostics
    "status.good.word": "Sin acción",
    "status.good.sub": "sin exceso detectado",
    "status.progress.word": "Investigar",
    "status.progress.sub": "elevado vs línea base",
    "status.default.word": "Revisar",
    
    "headline.basin": "El metano observado muestra un aumento del {mag}% vs una región de referencia limpia.",
    "headline.fac.bg": "El metano observado está en el fondo local — sin exceso detectado ({pct}%).",
    "headline.fac.above": "El metano observado está {pct}% por encima del fondo local.",
    "headline.fac.below": "El metano observado está {pct}% por debajo del fondo local.",

    "matrix.flare.high.label": "Combustión pobre",
    "matrix.flare.high.desc": "quema incompleta",
    "matrix.noflare.high.label": "Ventilación / fuga",
    "matrix.noflare.high.desc": "o antorcha apagada",
    "matrix.flare.low.label": "Quemando limpiamente",
    "matrix.flare.low.desc": "combustión eficiente",
    "matrix.noflare.low.label": "Sitio inactivo",
    "matrix.noflare.low.desc": "genuinamente inactivo · sin exceso",

    // Footer
    "footer.contact": "Contacto",
    "footer.contact_us": "Contáctenos",
    "footer.book_demo": "Reservar una demostración",
    "footer.feedback": "Comentarios",
    "footer.social": "Redes Sociales",
    "footer.legal": "Términos y Políticas",
    "footer.terms": "Términos de Uso",
    "footer.privacy": "Política de Privacidad",
    "footer.disclaimer": "Aviso Legal"
  },
  fr: {
    // Nav & General
    "nav.product": "Produits &amp; Services",
    "nav.login": "Se connecter",
    "btn.enter": "Entrer sur la plateforme",
    
    // Splash / Landing
    "landing.tagline": "Une société d'intelligence décisionnelle fusionnant les données satellitaires et terrestres pour des <span class=\"tagline-accent\">opérations durables et prévisibles</span>.",
    
    // Slide 2: OE
    "slide.oe.tag": "en direct",
    "slide.oe.title": "Efficacité Opérationnelle",
    "slide.oe.desc": "Rendement, logistique de la chaîne d'approvisionnement et utilisation de la capacité de la raffinerie — surveillés depuis l'espace.",
    
    // Slide 3: Asset Security
    "slide.as.tag": "surveillance",
    "slide.as.title": "Sécurité des Actifs",
    "slide.as.desc": "Expansion de l'empreinte physique, intégrité des frontières et suivi des infrastructures critiques.",

    // Slide 4: Sustainability
    "slide.sus.tag": "en direct",
    "slide.sus.title": "Durabilité et Conformité",
    "slide.sus.desc": "Vérification par satellite indépendante du méthane et du torchage, mesurée par rapport aux déclarations des opérateurs.",

    // Pillars Selector
    "pillars.title": "Sélectionnez un pilier à explorer",
    "pillars.sustainability": "Durabilité",
    "pillars.sustainability_desc": "Suivi du méthane et vérification indépendante",
    "pillars.operational": "Efficacité Opérationnelle",
    "pillars.operational_desc": "Limites de torchage, temps d'arrêt et suivi",
    "pillars.security": "Sécurité des Actifs",
    "pillars.security_desc": "Anomalies aux limites et empreinte physique",
    
    // Dashboard Map
    "map.layers_title": "Couches d'Analyse Multi-Capteurs",
    "layer.methane": "Méthane TROPOMI (CH₄)",
    "layer.flaring": "Torchage VIIRS (Nightfire)",
    "layer.optical": "Couleur Réelle Sentinel-2",
    "layer.sar": "SAR Sentinel-1 (Déversements)",
    
    // Reports
    "report.close": "Fermer le rapport",
    "report.download": "Télécharger le rapport (PDF)",
    
    // Chatbot UI
    "chat.title": "Demandez à Aletheia",
    "chat.subtitle": "basé uniquement sur le dossier de cette installation · lecture seule",
    "chat.placeholder": "Posez une question sur cette installation…",
    "chat.ask_btn": "Demander",
    "chat.disclaimer": "Les réponses sont composées uniquement à partir du dossier de cette installation et du scénario affiché ci-dessus. Aletheia ne navigue pas sur Internet.",

    // Dashboard UI
    "dashboard.title": "Tableau de Bord Aletheia",
    "dashboard.auth": "Authentifié",
    "dashboard.home": "← Accueil",
    "dashboard.launchpad": "Plateforme authentifiée",
    "dashboard.select_pillar": "Sélectionnez un pilier",
    "dashboard.workspace_access": "L'accès à votre espace de travail détermine quels piliers sont disponibles.",
    "dashboard.open_workspace": "Ouvrir l'espace de travail →",
    "dashboard.coming_soon": "Bientôt disponible",
    "dashboard.locked": "Verrouillé",

    // Diagnostics
    "status.good.word": "Aucune action",
    "status.good.sub": "aucun excès détecté",
    "status.progress.word": "Enquêter",
    "status.progress.sub": "élevé par rapport à la base",
    "status.default.word": "Revoir",
    
    "headline.basin": "Le méthane observé montre une augmentation de {mag}% par rapport à une région de référence propre.",
    "headline.fac.bg": "Le méthane observé est au niveau du bruit de fond local — aucun excès détecté ({pct}%).",
    "headline.fac.above": "Le méthane observé est à {pct}% au-dessus du bruit de fond local.",
    "headline.fac.below": "Le méthane observé est à {pct}% en dessous du bruit de fond local.",

    "matrix.flare.high.label": "Mauvaise combustion",
    "matrix.flare.high.desc": "combustion incomplète",
    "matrix.noflare.high.label": "Évent / fuite",
    "matrix.noflare.high.desc": "ou torche éteinte",
    "matrix.flare.low.label": "Combustion propre",
    "matrix.flare.low.desc": "combustion efficace",
    "matrix.noflare.low.label": "Site inactif",
    "matrix.noflare.low.desc": "véritablement inactif · aucun excès",

    // Footer
    "footer.contact": "Contact",
    "footer.contact_us": "Contactez-nous",
    "footer.book_demo": "Réserver une démo",
    "footer.feedback": "Commentaires",
    "footer.social": "Social",
    "footer.legal": "Conditions &amp; Politiques",
    "footer.terms": "Conditions d'utilisation",
    "footer.privacy": "Politique de confidentialité",
    "footer.disclaimer": "Avertissement"
  }
};

let currentLang = localStorage.getItem('aletheia_lang') || 'en';

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (!dictionaries[lang]) lang = 'en';
  currentLang = lang;
  localStorage.setItem('aletheia_lang', lang);
  updateDOM();
  window.dispatchEvent(new CustomEvent('languagechanged', { detail: { lang } }));
}

export function t(key) {
  return dictionaries[currentLang]?.[key] || dictionaries['en']?.[key] || key;
}

// Helper to translate JSON fields that are objects {en: "...", es: "..."}
export function tObj(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[currentLang] || obj['en'] || '';
}

// Automatically translate all elements with data-i18n on the page
export function updateDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.innerHTML = t(key);
  });
  
  // Sync all language pickers on the page to the current language
  document.querySelectorAll('.lang-picker').forEach(select => {
    select.value = currentLang;
  });
}

// Global event delegation for language pickers
document.addEventListener('change', e => {
  if (e.target && e.target.classList.contains('lang-picker')) {
    setLang(e.target.value);
  }
});

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  updateDOM();
});
