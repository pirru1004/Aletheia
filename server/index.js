import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

// --- CDSE Sentinel Hub Catalog Token Management ---
let cdseTokenCache = null;
let cdseTokenExpiry = null;

async function getCdseToken() {
  if (cdseTokenCache && cdseTokenExpiry && Date.now() < cdseTokenExpiry) {
    return cdseTokenCache;
  }
  const clientId = process.env.SH_CLIENT_ID;
  const clientSecret = process.env.SH_CLIENT_SECRET;
  if (!clientId || !clientSecret || clientId === 'YOUR_SH_CLIENT_ID_HERE') {
    throw new Error('SH_CLIENT_ID or SH_CLIENT_SECRET not configured in .env');
  }

  const response = await fetch('https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret
    })
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch CDSE token (${response.status}): ${errText}`);
  }
  
  const data = await response.json();
  cdseTokenCache = data.access_token;
  // Expire 1 minute before actual expiration for safety
  cdseTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cdseTokenCache;
}

// Secure Proxy endpoint for Copernicus Sentinel Hub Catalog API (STAC search)
app.post('/api/sh-catalog', async (req, res) => {
  try {
    const token = await getCdseToken();
    const response = await fetch('https://sh.dataspace.copernicus.eu/catalog/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(req.body)
    });
    
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching from SH Catalog:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend proxy server running on http://localhost:${PORT}`);
});
