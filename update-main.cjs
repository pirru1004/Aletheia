const fs = require('fs');

let mainJS = fs.readFileSync('src/main.js', 'utf8');

// Remove chartPanel references
mainJS = mainJS.replace(/const chartPanel = document\.getElementById\('floating-chart-panel'\);/, '');
mainJS = mainJS.replace(/let currentChart = null;/, '');
mainJS = mainJS.replace(/function renderTrendChart[\s\S]*?\}\n\n/m, '');
mainJS = mainJS.replace(/chartPanel\.classList\.add\('hidden'\);/, '');
mainJS = mainJS.replace(/chartPanel\.classList\.remove\('expanded'\); \/\/ Reset expansion state/, '');
mainJS = mainJS.replace(/document\.getElementById\('btn-expand-chart'\)\.textContent = '⛶ Expand';/, '');

// Remove the event listeners for metric selector and chart expand
mainJS = mainJS.replace(/document\.getElementById\('metric-selector'\)\?\.addEventListener[\s\S]*?\n\}\);\n/m, '');
mainJS = mainJS.replace(/\/\/ Chart Expand Toggle Logic[\s\S]*?\n\}\);\n/m, '');

// Clean up openCompliancePanel to not use the floating panel or old DOM elements
const openPanelRegex = /function openCompliancePanel\(facility\) \{[\s\S]*?\}\n\n/m;
const newOpenPanel = `
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

`;

mainJS = mainJS.replace(openPanelRegex, newOpenPanel);

fs.writeFileSync('src/main.js', mainJS);
console.log('src/main.js updated with basic modal logic');
