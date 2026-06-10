import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Proxy endpoint for Planet Labs tiles
app.get('/api/planet-tiles/:mosaic/:z/:x/:y', (req, res) => {
  const { mosaic, z, x, y } = req.params;
  const apiKey = process.env.PLANET_API_KEY;

  if (!apiKey) {
    return res.status(500).send('API key not configured');
  }

  // Planet Labs XYZ URL format
  // We'll just use '0' for simplicity in the proxy
  const targetUrl = `https://tiles0.planet.com/basemaps/v1/planet-tiles/${mosaic}/gmap/${z}/${x}/${y}.png?api_key=${apiKey}`;

  // Use HTTPS module to fetch the image and pipe it to the response
  https.get(targetUrl, (apiRes) => {
    // Copy headers (e.g., content-type)
    res.set(apiRes.headers);
    res.status(apiRes.statusCode);
    
    // Pipe the image stream directly to the client
    apiRes.pipe(res);
  }).on('error', (e) => {
    console.error('Error fetching tile from Planet:', e.message);
    res.status(500).send('Error fetching tile');
  });
});

// Secure Proxy endpoint for NASA FIRMS WMS data
app.get('/api/firms-wms', (req, res) => {
  const apiKey = process.env.FIRMS_MAP_KEY;
  
  if (!apiKey || apiKey === 'YOUR_NASA_MAP_KEY_HERE') {
    return res.status(500).send('NASA FIRMS API key not configured');
  }

  // Extract the original WMS query parameters (bbox, width, height, layers, etc.)
  const queryString = req.url.split('?')[1] || '';
  
  // Construct the target URL using the NASA 'fires' layer structure
  const targetUrl = `https://firms.modaps.eosdis.nasa.gov/mapserver/wms/fires/${apiKey}/?${queryString}`;

  https.get(targetUrl, (apiRes) => {
    res.set(apiRes.headers);
    res.status(apiRes.statusCode);
    apiRes.pipe(res);
  }).on('error', (e) => {
    console.error('Error fetching WMS tile from FIRMS:', e.message);
    res.status(500).send('Error fetching WMS tile');
  });
});

// Secure Proxy endpoint for Sentinel-1 SAR WMS data
app.get('/api/sar-wms', (req, res) => {
  const instanceId = process.env.SH_INSTANCE_ID;
  
  if (!instanceId || instanceId === 'YOUR_SH_INSTANCE_ID_HERE') {
    return res.status(500).send('Sentinel Hub Instance ID not configured');
  }

  // Extract the original WMS query parameters (bbox, width, height, layers, etc.)
  const queryString = req.url.split('?')[1] || '';
  
  // Construct the target URL for Sentinel Hub
  const targetUrl = `https://services.sentinel-hub.com/ogc/wms/${instanceId}?${queryString}`;

  https.get(targetUrl, (apiRes) => {
    res.set(apiRes.headers);
    res.status(apiRes.statusCode);
    apiRes.pipe(res);
  }).on('error', (e) => {
    console.error('Error fetching WMS tile from Sentinel Hub:', e.message);
    res.status(500).send('Error fetching SAR tile');
  });
});

app.listen(PORT, () => {
  console.log(`Backend proxy server running on http://localhost:${PORT}`);
});
