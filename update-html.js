const fs = require('fs');

let aletheiaHTML = fs.readFileSync('aletheia_groundbirch (4).html', 'utf8');
let reportContentMatch = aletheiaHTML.match(/<div class="wrap">([\s\S]*?)<\/script>/);
let reportContent = reportContentMatch ? reportContentMatch[0].replace('</script>', '') : '';
// strip out the script part at the bottom
reportContent = reportContent.split('<script>')[0];

let indexHTML = fs.readFileSync('index.html', 'utf8');

// Replace the Compliance panel content
const newSidebar = `
        <!-- Compliance Gap Side Panel -->
        <aside id="compliance-panel" class="side-panel hidden">
          <div class="panel-header">
            <h2 id="cp-name">Groundbirch</h2>
            <button id="cp-close" class="close-btn">&times;</button>
          </div>
          <div class="panel-content">
            <div class="meta-info" style="margin-bottom: 20px;">
              <span class="badge">Shell plc</span>
              <span class="badge">Montney shale gas</span>
            </div>
            
            <h3 style="color: var(--text-secondary); margin-bottom: 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">AI Insight Summary</h3>
            <div style="background: rgba(242,181,59,.1); border: 1px solid rgba(242,181,59,.3); padding: 16px; border-radius: 12px; margin-bottom: 24px;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <span style="width: 14px; height: 14px; border-radius: 50%; background: #F2B53B; display: inline-block;"></span>
                <span style="font-weight: 600; font-size: 18px; color: #f8fafc;">Watch</span>
              </div>
              <p style="margin: 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;">
                Observed methane intensity is <strong style="color: #FFC64D;">8% higher</strong> than Shell’s 2026 disclosure, with high confidence (±3%).
              </p>
            </div>

            <button id="btn-open-report" style="width: 100%; padding: 14px; background: var(--accent-color); color: #0f172a; border: none; border-radius: 8px; font-weight: 600; font-size: 15px; cursor: pointer; transition: background 0.2s;">
              ⛶ View Full Analysis Report
            </button>
          </div>
        </aside>
`;

indexHTML = indexHTML.replace(/<!-- Compliance Gap Side Panel -->[\s\S]*?<\/aside>/, newSidebar.trim());

// Remove the floating panel
indexHTML = indexHTML.replace(/<!-- Floating Predictive Chart Panel -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, '');

// Inject the modal before </body>
const modalHTML = `
  <!-- Full Screen Aletheia Report Modal -->
  <div id="aletheia-report-modal" class="hidden">
    <button id="btn-close-report" class="aletheia-close-btn">&times;</button>
    <div id="aletheia-report-modal-content">
      ${reportContent}
    </div>
  </div>
`;

if (!indexHTML.includes('aletheia-report-modal')) {
  indexHTML = indexHTML.replace('</body>', `${modalHTML}\n</body>`);
}

fs.writeFileSync('index.html', indexHTML);
console.log('index.html updated successfully');
