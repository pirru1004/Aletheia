const fs = require('fs');
const css = `
/* Step 4: Success View */
.ds-success-view {
  text-align: center;
  padding: 40px 20px;
}

.ds-success-icon {
  width: 64px;
  height: 64px;
  background: rgba(31, 111, 107, 0.2);
  color: #1F6F6B;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
}

.ds-success-icon svg {
  width: 32px;
  height: 32px;
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

.ds-success-title {
  font-size: 1.5rem;
  font-weight: 500;
  margin-bottom: 12px;
  color: white;
}

.ds-success-desc {
  font-size: 0.95rem;
  color: rgba(255,255,255,0.7);
  line-height: 1.5;
  margin-bottom: 32px;
}

.ds-done-btn {
  background: white;
  color: #0A0D10;
  border: none;
  padding: 12px 32px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.ds-done-btn:hover {
  opacity: 0.9;
}
`;
fs.appendFileSync('public/demo_scheduler.css', css);
console.log('Appended to css');
