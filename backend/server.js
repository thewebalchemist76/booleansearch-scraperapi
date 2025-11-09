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

    console.log(`🌐 Fetching from ScraperAPI...`);

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
    
    // DEBUG: Check if we got actual Google results or a block page
    if (html.includes('unusual traffic') || html.includes('captcha')) {
      console.log('⚠️ WARNING: Possible captcha/block detected');
    }
    
    // DEBUG: Save a sample of the HTML
    console.log('📝 HTML sample (first 500 chars):', html.substring(0, 500));

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

  // Remove all newlines and extra spaces for easier parsing
  const cleanHtml = html.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  // Pattern 1: Try multiple URL extraction patterns
  const urlPatterns = [
    // Standard Google result link
    /href="\/url\?q=(https?:\/\/[^"&]+)/gi,
    // Direct link pattern
    /href="(https?:\/\/(?!google|youtube|webcache)[^"]+)"/gi,
    // JSName pattern
    /<a[^>]+jsname="[^"]*"[^>]+href="(https?:\/\/[^"]+)"/gi
  ];

  let urls = new Set(); // Use Set to avoid duplicates

  for (const pattern of urlPatterns) {
    let match;
    while ((match = pattern.exec(cleanHtml)) !== null && urls.size < 20) {
      try {
        let url = match[1];
        // Decode URL
        url = decodeURIComponent(url);
        
        // STRICT FILTER: Remove ALL Google-related URLs
        const isGoogleUrl = 
          url.includes('google.com') || 
          url.includes('google.co') ||  // google.co.uk, google.co.id, etc.
          url.includes('google.it') ||
          url.includes('gstatic.com') ||
          url.includes('youtube.com') ||
          url.includes('webcache.googleusercontent.com') ||
          url.includes('accounts.google') ||
          url.includes('policies.google') ||
          url.includes('support.google');
        
        if (url.startsWith('http') && !isGoogleUrl) {
          urls.add(url);
        }
      } catch (e) {
        // Skip invalid URLs
      }
    }
  }

  // Convert Set to Array
  const urlArray = Array.from(urls);

  // Pattern 2: Extract titles - try multiple patterns
  const titlePatterns = [
    /<h3[^>]*>([^<]+)<\/h3>/gi,
    /<div[^>]*role="heading"[^>]*>([^<]+)<\/div>/gi,
    /class="[^"]*LC20lb[^"]*"[^>]*>([^<]+)</gi
  ];

  const titles = [];
  for (const pattern of titlePatterns) {
    let match;
    while ((match = pattern.exec(cleanHtml)) !== null && titles.length < 20) {
      const title = match[1].trim().replace(/<[^>]+>/g, '');
      if (title && title.length > 5) {
        titles.push(title);
      }
    }
  }

  // Pattern 3: Extract descriptions
  const descPatterns = [
    /<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([^<]+)<\/div>/gi,
    /<span[^>]*class="[^"]*st[^"]*"[^>]*>([^<]+)<\/span>/gi,
    /<div[^>]*data-content-feature="[^"]*"[^>]*>([^<]+)<\/div>/gi
  ];

  const descriptions = [];
  for (const pattern of descPatterns) {
    let match;
    while ((match = pattern.exec(cleanHtml)) !== null && descriptions.length < 20) {
      const desc = match[1].trim().replace(/<[^>]+>/g, '');
      if (desc && desc.length > 10) {
        descriptions.push(desc);
      }
    }
  }

  console.log(`📊 Parsed: ${urlArray.length} URLs, ${titles.length} titles, ${descriptions.length} descriptions`);

  // Log first 3 URLs for debugging
  if (urlArray.length > 0) {
    console.log('🔗 First URLs found:', urlArray.slice(0, 3));
  }

  // Combine results
  for (let i = 0; i < Math.min(urlArray.length, 10); i++) {
    results.push({
      url: urlArray[i],
      title: titles[i] || urlArray[i],
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