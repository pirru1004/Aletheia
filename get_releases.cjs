const https = require('https');
const fs = require('fs');
const os = require('os');

const config = JSON.parse(fs.readFileSync(os.homedir() + '/.config/configstore/firebase-tools.json', 'utf8'));
const token = config.tokens.access_token;
const site = 'synapse-davidrazo';

const options = {
  hostname: 'firebasehosting.googleapis.com',
  path: `/v1beta1/sites/${site}/releases`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const json = JSON.parse(data);
    const releases = json.releases || [];
    console.log(JSON.stringify(releases.map(r => ({name: r.name, version: r.version.name, time: r.releaseTime})), null, 2));
  });
});
req.end();
