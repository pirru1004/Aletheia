import './style.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import Chart from 'chart.js/auto';
import { aoiData } from './aoi_data.js';

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

// Initialize the map on the "map" div
// We start focused on Alberta/BC, Canada to see the Groundbirch and Scotford facilities immediately
const map = L.map('map', {
  center: [54.8, -117.0], // Center between Groundbirch and Scotford
  zoom: 6,
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

let currentFacility = null;

closeBtn.addEventListener('click', () => {
  panel.classList.add('hidden');
  
  
  
});



// Function to populate and open the side panel

function openCompliancePanel(facility) {
  // We have hardcoded the sidebar to the Groundbirch summary, 
  // so we just show the panel.
  panel.classList.remove('hidden');
}

document.getElementById('btn-open-report')?.addEventListener('click', () => {
  const modal = document.getElementById('aletheia-report-modal');
  if(modal) modal.classList.add('open');
});

document.getElementById('btn-close-report')?.addEventListener('click', () => {
  const modal = document.getElementById('aletheia-report-modal');
  if(modal) modal.classList.remove('open');
});

// Add markers to the map
aoiData.forEach(facility => {
  const marker = L.marker([facility.latitude, facility.longitude]).addTo(map);
  
  // Custom tooltip
  marker.bindTooltip(`<b>${facility.name}</b><br>${facility.asset_type} - ${facility.country}`);
  
  // Click event
  marker.on('click', () => {
    // Center map on marker with a slight offset to accommodate the side panel
    map.setView([facility.latitude, facility.longitude], 8, { animate: true });
    openCompliancePanel(facility);
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

// --- TROPOMI Methane Heatmap (Mock Data Trial) ---
// Generate synthetic multi-year average methane plumes around our facilities
const heatData = [];
aoiData.forEach(facility => {
  // Base intensity on the observed methane tonnes
  const intensityBase = facility.observed.methane_tonnes / 10000;
  
  // Create a synthetic plume
  for (let i = 0; i < 300; i++) {
    // Plume spreading evenly around the facility (centered) and covering a larger area
    const latOffset = (Math.random() - 0.5) * 0.4; 
    const lngOffset = (Math.random() - 0.5) * 0.4;
    
    // Decrease intensity further away
    const distance = Math.sqrt(latOffset*latOffset + lngOffset*lngOffset);
    const pointIntensity = intensityBase * (1 - (distance / 0.4));
    
    if (pointIntensity > 0) {
      heatData.push([
        facility.latitude + latOffset,
        facility.longitude + lngOffset,
        pointIntensity
      ]);
    }
  }
});

// Create the heat layer
const methaneLayer = L.heatLayer(heatData, {
  radius: 60,  // Increased from 35 to make it visibly larger
  blur: 40,    // Increased from 25 for a smoother, larger gradient
  maxZoom: 10,
  max: 1.0,
  gradient: {
    0.4: 'blue',
    0.6: 'cyan',
    0.7: 'lime',
    0.8: 'yellow',
    1.0: 'red'
  }
});

// Add it to the layer control manually
map.addControl(new L.Control.Layers(null, {
  "TROPOMI Methane (Multi-Year Avg)": methaneLayer
}, { position: 'topright' }));

// Legend Toggle Logic
const methaneLegend = document.getElementById('methane-legend');

map.on('overlayadd', function(e) {
  if (e.name === 'TROPOMI Methane (Multi-Year Avg)') {
    methaneLegend.classList.remove('hidden');
  }
});

map.on('overlayremove', function(e) {
  if (e.name === 'TROPOMI Methane (Multi-Year Avg)') {
    methaneLegend.classList.add('hidden');
  }
});

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


/* ALETHEIA JS LOGIC */

(function(){
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const C = { reported:css('--reported'), amber:css('--amber'), amberSoft:css('--amber-soft'), green:css('--green'), red:css('--red'), muted:css('--muted'), line:css('--line'), text:css('--text'), faint:css('--faint'), verify:css('--verify') };

  const labels=['Jul’25','Aug','Sep','Oct','Nov','Dec','Jan’26','Feb','Mar','Apr','May','Jun','Jul’26','Aug','Sep','Oct','Nov','Dec’26'];
  const N=labels.length, NOW=11, S0=0.205;
  const glide = end => { const a=[]; for(let i=0;i<N;i++) a.push(+(S0-(S0-end)*(i/(N-1))).toFixed(4)); return a; };
  const reportedBaseline=0.190;
  const reported=Array(N).fill(null); reported[1]=0.196; reported[7]=0.190;
  const repFill=Array(N).fill(null); for(let i=0;i<=NOW;i++) repFill[i]=reportedBaseline;
  const obsHist=[0.214,0.219,0.222,0.229,0.236,0.238,0.241,0.235,0.226,0.217,0.210,0.205];
  const observed=Array(N).fill(null); for(let i=0;i<=NOW;i++) observed[i]=obsHist[i];
  const projBase=[0.205,0.201,0.198,0.197,0.196,0.193,0.190];
  const projUnc = k => 0.007 + 0.0028*k;
  const buildProjection = reduce => projBase.map((v,k)=> +(reduce? v*(1-reduce(k)) : v).toFixed(4));
  const spread = s => { const a=Array(N).fill(null); s.forEach((v,k)=>a[NOW+k]=v); return a; };
  const uncBand = s => { const up=Array(N).fill(null),lo=Array(N).fill(null); s.forEach((v,k)=>{up[NOW+k]=+(v+projUnc(k)).toFixed(4); lo[NOW+k]=+(v-projUnc(k)).toFixed(4);}); return {up,lo}; };
  const gapPct = (e,b) => Math.round(((e-b)/b)*100);

  let bases=[
    {id:'shell', name:'Shell internal target', cat:'Company', end:0.170, color:css('--slate'), visible:true, removable:false},
    {id:'ogmp',  name:'OGMP 2.0 (near-zero)',  cat:'Framework', end:0.150, color:css('--violet'), visible:false, removable:false},
    {id:'gmp',   name:'Global Methane Pledge', cat:'Intergovernmental', end:0.160, color:css('--teal'), visible:false, removable:false},
    {id:'iea',   name:'IEA Net-Zero pathway',  cat:'Scenario', end:0.130, color:css('--rose'), visible:false, removable:false}
  ];
  let primaryId='shell'; const palette=['#A78BFA','#4FB6C6','#F472B6','#E0A458','#7CC6FF','#C0CA33']; let addCount=0;
  const primary = ()=> bases.find(b=>b.id===primaryId);

  const levers=[
    {n:'01', title:'Replace high-bleed pneumatic controllers', lo:4, hi:9, mid:6.5, lead:2, conf:'High', src:'OGMP 2.0 mitigation hierarchy · IEA'},
    {n:'02', title:'Inspect & repair compressor seals — Train 2', lo:5, hi:12, mid:8.5, lead:1.5, conf:'Medium', src:'IEA Methane Abatement Cost Curve'},
    {n:'03', title:'Vapour recovery units on condensate tanks', lo:8, hi:15, mid:11.5, lead:3.5, conf:'Med-High', src:'EPA Methane Challenge methodology'},
    {n:'04', title:'Eliminate routine flaring (gas capture)', lo:3, hi:6, mid:4.5, lead:6, conf:'Medium', src:'World Bank GGFR · Zero Routine Flaring'}
  ];
  const rampFactor=(l,k)=> k<=0?0:Math.min(1,k/l.lead);

  const ICON={
    drone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="5" cy="5" r="2.4"/><circle cx="19" cy="5" r="2.4"/><circle cx="5" cy="19" r="2.4"/><circle cx="19" cy="19" r="2.4"/><path d="M6.7 6.7l4 4M17.3 6.7l-4 4M6.7 17.3l4-4M17.3 17.3l-4-4"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/></svg>',
    inspector:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="6"/><path d="M15.4 15.4L21 21"/><path d="M8.5 11h5M11 8.5v5"/></svg>',
    spark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="3.2"/></svg>',
    ext:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" style="width:12px;height:12px"><path d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6"/></svg>'
  };
  const investigate=[
    {id:'drone', icon:'drone', title:'Send drone — imagery + 3D point cloud', impact:'localise the source · quantify plume geometry', lead:'dispatch in 24–48 h',
     detail:'A UAV photogrammetry run ground-truths severity before any abatement spend: a 2 cm/px orthomosaic plus a colored 3D point cloud pinpoint which tank, train, or unlit flare is leaking, and at what scale.',
     stat:'Example prior survey: 47 DJI Neo frames · 4.56 M-point cloud · 2 cm/px',
     links:[{label:'2D / orthomosaic viewer', url:'https://lceuranie.github.io/DroneImageProcessing/data/visualization/viewer.html'},{label:'3D point cloud', url:'https://lceuranie.github.io/DroneImageProcessing/data/visualization/pointcloud.html'},{label:'Method', url:'https://lceuranie.github.io/project-drone-photogrammetry.html'}]},
    {id:'inspector', icon:'inspector', title:'Send field inspector — OGI survey', impact:'component-level leak detection · regulatory-grade evidence', lead:'dispatch in 3–5 days',
     detail:'An optical-gas-imaging (OGI) camera survey walks the site to tag specific leaking components, producing the audit trail a regulator or OGMP 2.0 Level-5 report needs. Slower than a drone, but evidentiary.',
     stat:'Pairs with the drone pass: drone localises, inspector confirms & tags', links:[]}
  ];

  const core=[
    {_key:'repFill', label:'_repfill', data:repFill, borderWidth:0, pointRadius:0, fill:false, borderColor:'rgba(0,0,0,0)', tension:.35, order:9},
    {_key:'gap', label:'_gap', data:observed.slice(), borderWidth:0, pointRadius:0, fill:'-1', backgroundColor:'rgba(242,181,59,.16)', tension:.35, order:8},
    {_key:'uncUp', label:'_uncup', data:[], borderWidth:0, pointRadius:0, fill:false, borderColor:'rgba(0,0,0,0)', tension:.3, order:7},
    {_key:'uncLo', label:'_unclo', data:[], borderWidth:0, pointRadius:0, fill:'-1', backgroundColor:'rgba(242,181,59,.10)', borderColor:'rgba(0,0,0,0)', tension:.3, order:7},
    {_key:'reported', label:'Reported', data:reported, borderColor:C.reported, borderWidth:1.8, pointRadius:5, pointBackgroundColor:C.reported, pointBorderColor:'#0C1116', pointBorderWidth:2, spanGaps:true, tension:0, order:4},
    {_key:'obs', label:'Observed', data:observed, borderColor:C.amber, borderWidth:2.6, pointRadius:2.4, pointBackgroundColor:C.amber, tension:.35, order:2},
    {_key:'proj', label:'Projection', data:[], borderColor:C.amber, borderWidth:2.4, borderDash:[5,5], pointRadius:0, tension:.35, order:3},
    {_key:'ghost', label:'_ghost', data:Array(N).fill(null), borderColor:'rgba(147,161,177,.45)', borderWidth:1.4, borderDash:[2,4], pointRadius:0, tension:.35, order:6}
  ];
  const nowLine={ id:'nowLine', afterDraw(chart){ const {ctx,chartArea:{top,bottom},scales:{x}}=chart; const xp=x.getPixelForValue(NOW);
    ctx.save(); ctx.fillStyle='rgba(255,255,255,.018)'; ctx.fillRect(xp,top,x.getPixelForValue(N-1)-xp,bottom-top);
    ctx.strokeStyle='rgba(234,240,246,.22)'; ctx.lineWidth=1; ctx.setLineDash([3,4]); ctx.beginPath(); ctx.moveTo(xp,top); ctx.lineTo(xp,bottom); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle=C.muted; ctx.font='10px "IBM Plex Mono", monospace'; ctx.textAlign='center'; ctx.fillText('NOW',xp,top-2); ctx.restore(); }};

  const chart=new Chart(document.getElementById('chart'),{
    type:'line', data:{labels, datasets:core.slice()}, plugins:[nowLine],
    options:{ responsive:true, maintainAspectRatio:false, animation:{duration:650, easing:'easeOutCubic'}, interaction:{mode:'index', intersect:false}, layout:{padding:{top:14,right:6}},
      scales:{ x:{grid:{color:'rgba(40,50,63,.5)', drawTicks:false}, ticks:{color:C.faint, font:{family:'IBM Plex Mono', size:10}, maxRotation:0, autoSkipPadding:8}, border:{color:C.line}},
        y:{grid:{color:'rgba(40,50,63,.4)'}, ticks:{color:C.faint, font:{family:'IBM Plex Mono', size:10}, callback:v=>v.toFixed(2)+'%'}, border:{display:false}, suggestedMin:0.12, suggestedMax:0.26} },
      plugins:{ legend:{display:false},
        tooltip:{ backgroundColor:'#0C1116', borderColor:C.line, borderWidth:1, titleColor:C.text, bodyColor:C.muted, titleFont:{family:'IBM Plex Mono', size:11}, bodyFont:{family:'IBM Plex Mono', size:11}, padding:10, boxWidth:8, boxHeight:8,
          filter:i=>!i.dataset.label.startsWith('_') && i.parsed.y!=null, callbacks:{ label:c=>` ${c.dataset.label}: ${c.parsed.y.toFixed(3)}%` } } }
    }
  });
  const dset = key => chart.data.datasets.find(d=>d._key===key);

  function syncBasisDatasets(){
    chart.data.datasets = chart.data.datasets.filter(d=>!(d._key||'').startsWith('basis:'));
    bases.filter(b=>b.visible).forEach(b=>{ const isP=b.id===primaryId;
      chart.data.datasets.push({ _key:'basis:'+b.id, label:b.name, data:glide(b.end), borderColor:b.color, borderWidth:isP?2.4:1.3, borderDash:isP?[7,5]:[2,4], pointRadius:0, tension:0, order:5 }); });
  }

  let activeLever=-1;
  const verifyWrap=document.getElementById('verifyActions');
  investigate.forEach(a=>{ const b=document.createElement('button'); b.className='actioncard verify'; b.setAttribute('aria-expanded','false');
    b.innerHTML=`<div class="ac-top"><span class="ic2">${ICON[a.icon]}</span><span class="ac-title">${a.title}</span></div>
      <div class="ac-impact">${a.impact}</div><div class="ac-row"><span class="cf">${a.lead}</span><span>does not change projection</span></div>
      <div class="ac-detail"><div>${a.detail}</div>${a.links.length?`<div class="out">${a.links.map(l=>`<a class="link" href="${l.url}" target="_blank" rel="noopener">${l.label} ${ICON.ext}</a>`).join('')}</div>`:''}<div class="stat">${a.stat}</div></div>`;
    b.addEventListener('click',e=>{ if(e.target.closest('a')) return; const open=b.classList.toggle('open'); b.setAttribute('aria-expanded',open);}); verifyWrap.appendChild(b); });

  const abateWrap=document.getElementById('abateActions');
  levers.forEach((a,idx)=>{ const b=document.createElement('button'); b.className='actioncard abate'; b.setAttribute('aria-pressed','false');
    b.innerHTML=`<div class="ac-top"><span class="ic2">${ICON.spark}</span><span class="ac-title">${a.title}</span></div>
      <div class="ac-impact">−${a.lo}% to −${a.hi}% methane intensity</div><div class="ac-row"><span class="cf">${a.conf} confidence</span><span>~${a.lead<2?'1–2':a.lead<4?'3–4':'6+'} mo to effect</span></div><div class="ac-src">${a.src}</div>`;
    b.addEventListener('click',()=>selectLever(idx)); abateWrap.appendChild(b); });

  const yendVal=document.getElementById('yendVal'), yendNote=document.getElementById('yendNote');
  const badgeDot=document.getElementById('badgeDot'), badgeWord=document.getElementById('badgeWord'), badgeSub=document.getElementById('badgeSub'), badgeBar=document.getElementById('badgeBar'), attn=document.getElementById('attn');
  function statusFor(g){ if(g<=4) return {c:C.green,w:'On track',s:'meets target within band',a:'On track'}; if(g<=15) return {c:C.amber,w:'Watch',s:'within uncertainty band',a:'Needs attention'}; return {c:C.red,w:'Off target',s:'miss outside uncertainty band',a:'Off target'}; }
  const currentProjEnd = ()=> dset('proj').data[N-1];
  function recompute(note){ const p=primary(); const g=gapPct(currentProjEnd(), p.end); const st=statusFor(g);
    badgeDot.style.background=st.c; badgeDot.style.boxShadow=`0 0 0 5px ${st.c}22`; badgeBar.style.background=st.c; badgeWord.textContent=st.w;
    badgeSub.innerHTML=`vs ${p.name} <b>(${st.s})</b>`; yendVal.textContent=(g>=0?'+':'')+g+'% vs target'; yendVal.style.color=g<=4?C.green:(g<=15?C.amberSoft:C.red);
    if(note!==undefined) yendNote.textContent=note; attn.textContent=st.a; attn.style.borderColor=st.c; attn.style.color=st.c; attn.style.background=st.c+'14';
    dset('proj').borderColor = g<=4 ? C.green : (activeLever>=0?C.amberSoft:C.amber); }

  function selectLever(idx){ if(activeLever===idx){ resetProjection(); return; } activeLever=idx;
    [...abateWrap.children].forEach((el,i)=>{el.classList.toggle('active',i===idx); el.setAttribute('aria-pressed',i===idx?'true':'false');});
    const a=levers[idx]; const proj=buildProjection(k=>(a.mid/100)*rampFactor(a,k)); const band=uncBand(proj);
    dset('ghost').data=spread(buildProjection(null)); dset('proj').data=spread(proj); dset('uncUp').data=band.up; dset('uncLo').data=band.lo; chart.update();
    recompute(`with “${a.title.toLowerCase()}” · ${a.conf.toLowerCase()} confidence`); }
  function resetProjection(){ activeLever=-1; [...abateWrap.children].forEach(el=>{el.classList.remove('active'); el.setAttribute('aria-pressed','false');});
    const proj=buildProjection(null); const band=uncBand(proj); dset('ghost').data=Array(N).fill(null); dset('proj').data=spread(proj); dset('proj').borderColor=C.amber; dset('uncUp').data=band.up; dset('uncLo').data=band.lo; chart.update();
    recompute('no intervention · status-quo extrapolation'); }
  document.getElementById('reset').addEventListener('click',resetProjection);

  const body=document.getElementById('basisBody');
  function renderBasis(){ body.innerHTML='';
    bases.forEach(b=>{ const d=document.createElement('div'); d.className='bchip'+(b.id===primaryId?' primary':'')+(b.visible?'':' hidden-line');
      d.innerHTML=`<button class="bchip-main" title="Set as primary basis"><span class="bsw" style="background:${b.color}"></span><span class="bmeta"><span class="bname">${b.name}</span><span class="bcat">${b.cat}</span></span><span class="bend" style="color:${b.color}">${b.end.toFixed(3)}%</span>${b.id===primaryId?'<span class="bprime">PRIMARY</span>':''}</button>
        <div class="bbtns"><button class="bbtn eye" title="${b.visible?'Hide on chart':'Show on chart'}" aria-pressed="${b.visible}">${b.visible?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.6-6.5 10-6.5c1.6 0 3 .4 4.2 1M22 12s-3.6 6.5-10 6.5c-1.6 0-3-.4-4.2-1"/><path d="M4 4l16 16"/></svg>'}</button>${b.removable?'<button class="bbtn x" title="Remove">&times;</button>':''}</div>`;
      d.querySelector('.bchip-main').addEventListener('click',()=>{ primaryId=b.id; b.visible=true; refresh(); });
      d.querySelector('.eye').addEventListener('click',()=>{ if(b.id===primaryId) return; b.visible=!b.visible; refresh(); });
      const x=d.querySelector('.x'); if(x) x.addEventListener('click',()=>{ bases=bases.filter(z=>z.id!==b.id); if(primaryId===b.id) primaryId=bases[0].id; refresh(); });
      body.appendChild(d); });
    const add=document.createElement('button'); add.className='badd'; add.textContent='+ ADD TARGET';
    const form=document.createElement('div'); form.className='addform';
    form.innerHTML=`<input class="nm" placeholder="Target name" maxlength="32"><select><option value="Company">Company</option><option value="Industry">Industry</option><option value="Framework">Framework</option><option value="NGO">NGO</option><option value="Regulatory">Regulatory</option></select><input class="val" type="number" step="0.005" min="0.05" max="0.4" placeholder="0.170"><span style="font-family:var(--mono);font-size:11px;color:var(--muted)">% year-end</span><button class="go">Add</button>`;
    add.addEventListener('click',()=>{ form.classList.toggle('open'); if(form.classList.contains('open')) form.querySelector('.nm').focus(); });
    form.querySelector('.go').addEventListener('click',()=>{ const nm=form.querySelector('.nm').value.trim(); const cat=form.querySelector('select').value; const val=parseFloat(form.querySelector('.val').value);
      if(!nm || isNaN(val)){ form.querySelector('.nm').focus(); return; } const id='c'+(addCount++); bases.push({id, name:nm, cat, end:+val.toFixed(3), color:palette[addCount%palette.length], visible:true, removable:true}); primaryId=id; refresh(); });
    body.appendChild(add); body.appendChild(form);
  }
  function refresh(){ renderBasis(); syncBasisDatasets(); chart.update(); recompute(); }

  // expanders (interpretation cards)
  document.querySelectorAll('[data-expand]').forEach(t=>{ t.addEventListener('click',()=>{ const b=t.nextElementSibling; const open=b.classList.toggle('open'); t.setAttribute('aria-expanded',open); const ch=t.querySelector('.chev'); if(ch) ch.classList.toggle('rot',open); }); });

  resetProjection();
  refresh();
})();
