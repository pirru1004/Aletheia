const https = require('https');

const evalscript = `//VERSION=3
function setup() {
  return {
    input: ["VV", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  if (sample.VV < 0.015) return [1, 0, 0, 1];
  return [sample.VV * 2.0, sample.VV * 2.0, sample.VV * 2.0, 1];
}`;

const evalscript64 = Buffer.from(evalscript).toString('base64');

// URL for testing (zoom level 10 equivalent to avoid the S1GRD limit)
// Width and Height are small, BBOX is valid EPSG:3857 for Gulf of Mexico
const url = `https://services.sentinel-hub.com/ogc/wms/60de79ca-16a7-4afd-bcbd-0261bf0156fa?SERVICE=WMS&REQUEST=GetMap&LAYERS=9_SAR-URBAN-VV-VH&FORMAT=image/png&TRANSPARENT=true&VERSION=1.1.1&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&BBOX=-10018754.17,3000000,-10000000,3018754.17&EVALSCRIPT64=${evalscript64}`;

https.get(url, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers['content-type']);
  
  let data = [];
  res.on('data', chunk => data.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(data);
    if (res.statusCode !== 200) {
      console.log('Error Body:', buffer.toString());
    } else {
      console.log('Success! Received image of size:', buffer.length);
    }
  });
}).on('error', (e) => {
  console.error('Request Error:', e);
});
