const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;
const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY || '';

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Boolean Search API with ScraperAPI on Render',
    hasApiKey: !!SCRAPERAPI_KEY
  });
});

// Search endpoint
app.post('/api/search', async (req, res) => {
  const { domain, query } = req.body;

  if (!domain || !query) {
    return res.status(400).json({ error: 'Dominio e query sono richiesti' });
  }

  if (!SCRAPERAPI_KEY) {
    return res.status(500).json({ error: 'ScraperAPI key non configurata' });
  }

  const cleanDomain = domain.replace(/\.\*$/, '').replace(/\*$/, '').replace(/\.$/, '').trim();
  const searchQuery = `site:${cleanDomain} "${query}"`;

  try {
    console.log(`🔍 Searching: ${searchQuery}`);

    // Build Google search URL
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&hl=it&gl=it&num=10`;
    
    // ScraperAPI URL
    const scraperUrl = `http://api.scraperapi.com/?api_key=${SCRAPERAPI_KEY}&url=${encodeURIComponent(googleUrl)}`;

    // Fetch from ScraperAPI
    const response = await fetch(scraperUrl);
    
    if (!response.ok) {
      console.error(`❌ ScraperAPI error: ${response.status}`);
      return res.status(500).json({
        url: '',
        title: '',
        description: '',
        error: `Errore ScraperAPI: HTTP ${response.status}`
      });
    }

    const html = await response.text();
    console.log(`📄 HTML received: ${html.length} chars`);

    // Parse Google results
    const results = parseGoogleResults(html, query);

    if (results.length > 0) {
      const best = results[0];
      console.log(`✅ Found: ${best.url}`);
      
      return res.json({
        url: best.url,
        title: best.title,
        description: best.description,
        error: null
      });
    }

    console.log('⚠️ No results found');
    return res.json({
      url: '',
      title: '',
      description: '',
      error: 'Nessun risultato trovato'
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({
      url: '',
      title: '',
      description: '',
      error: `Errore: ${error.message}`
    });
  }
});

function parseGoogleResults(html, originalQuery) {
  const results = [];

  // Pattern 1: Extract URLs from Google search results
  const urlRegex = /<a[^>]+href="\/url\?q=([^"&]+)[^"]*"/g;
  let match;
  const urls = [];

  while ((match = urlRegex.exec(html)) !== null) {
    try {
      const url = decodeURIComponent(match[1]);
      if (url && !url.includes('google.com') && !url.includes('youtube.com') && url.startsWith('http')) {
        urls.push(url);
      }
    } catch (e) {
      // Skip invalid URLs
    }
  }

  // Pattern 2: Extract titles (Google uses <h3> for result titles)
  const titleRegex = /<h3[^>]*class="[^"]*"[^>]*>([^<]+)<\/h3>/g;
  const titles = [];
  
  while ((match = titleRegex.exec(html)) !== null) {
    titles.push(match[1].trim());
  }

  // Pattern 3: Extract descriptions (snippets)
  const descRegex = /<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([^<]+)<\/div>/g;
  const descriptions = [];
  
  while ((match = descRegex.exec(html)) !== null) {
    descriptions.push(match[1].trim());
  }

  // Combine results
  for (let i = 0; i < urls.length; i++) {
    results.push({
      url: urls[i],
      title: titles[i] || urls[i],
      description: descriptions[i] || '',
      similarity: calculateSimilarity(titles[i] || '', originalQuery)
    });
  }

  // Sort by similarity
  results.sort((a, b) => b.similarity - a.similarity);

  return results;
}

function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  let matches = 0;
  
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1.length > 3 && word2.length > 3 && word1 === word2) {
        matches++;
      }
    }
  }
  
  return matches / Math.max(words1.length, words2.length);
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 ScraperAPI key: ${SCRAPERAPI_KEY ? 'configured ✅' : 'MISSING ❌'}`);
});