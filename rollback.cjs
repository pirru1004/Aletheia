const https = require('https');
const fs = require('fs');
const os = require('os');

const config = JSON.parse(fs.readFileSync(os.homedir() + '/.config/configstore/firebase-tools.json', 'utf8'));
const token = config.tokens.access_token;
const site = 'synapse-davidrazo';
const targetVersion = 'sites/synapse-davidrazo/versions/870e234e7dda173a';

const options = {
  hostname: 'firebasehosting.googleapis.com',
  path: `/v1beta1/sites/${site}/releases?versionName=${encodeURIComponent(targetVersion)}`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Length': 0
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    console.log('Rollback response:', data);
  });
});
req.end();
