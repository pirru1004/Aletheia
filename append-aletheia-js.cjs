const fs = require('fs');

let aletheiaHTML = fs.readFileSync('aletheia_groundbirch (4).html', 'utf8');
let scriptMatch = aletheiaHTML.match(/<script>([\s\S]*?)<\/script>/);

if (scriptMatch) {
  let aletheiaJS = scriptMatch[1];
  // Remove the redundant Chart.js plugin registration if it conflicts
  // The HTML has `Chart.register({ ... })` for the nowLine plugin. That should be fine.
  
  let mainJS = fs.readFileSync('src/main.js', 'utf8');
  mainJS += '\n\n/* ALETHEIA JS LOGIC */\n' + aletheiaJS;
  
  fs.writeFileSync('src/main.js', mainJS);
  console.log('Appended Aletheia JS to main.js');
} else {
  console.log('Script block not found!');
}
