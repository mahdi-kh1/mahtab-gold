const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

async function fetchPricesFromTgju() {
  try {
    console.log('Fetching prices from tgju.org...');
    
    // Fetch the TGJU homepage
    const response = await axios.get('https://www.tgju.org', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    const html = response.data;
    
    // Use regex to extract the prices
    // Gold price (18k)
    const goldRegex = /<li id="l-geram18"[^>]*>[\s\S]*?<span class="info-price">([\d,]+)<\/span>/;
    const goldMatch = html.match(goldRegex);
    
    // USD price
    const dollarRegex = /<li id="l-price_dollar_rl"[^>]*>[\s\S]*?<span class="info-price">([\d,]+)<\/span>/;
    const dollarMatch = html.match(dollarRegex);
    
    // Tether price
    const tetherRegex = /<li id="l-crypto-tether-irr"[^>]*>[\s\S]*?<span class="info-price">([\d,]+)<\/span>/;
    const tetherMatch = html.match(tetherRegex);
    
    if (!goldMatch || !dollarMatch || !tetherMatch) {
      console.error('Failed to extract prices, some data is missing', {
        goldFound: !!goldMatch,
        dollarFound: !!dollarMatch,
        tetherFound: !!tetherMatch
      });
      return null;
    }
    
    // Extract and convert prices from Rial to Toman (divide by 10)
    const goldPrice = parseInt(goldMatch[1].replace(/,/g, '')) / 10;
    const dollarPrice = parseInt(dollarMatch[1].replace(/,/g, '')) / 10;
    const tetherPrice = parseInt(tetherMatch[1].replace(/,/g, '')) / 10;
    
    console.log('Extracted prices (in Toman):', {
      gold: goldPrice,
      dollar: dollarPrice,
      tether: tetherPrice
    });
    
    // Current time for lastUpdated field
    const now = new Date();
    const persianTime = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'numeric', 
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZone: 'Asia/Tehran'
    }).format(now);
    
    return {
      lastUpdate: persianTime, // For display at the top
      gold: goldPrice,
      dollar: dollarPrice,
      tether: tetherPrice,
      lastUpdated: now.toISOString() // Keep ISO format for calculations
    };
  } catch (error) {
    console.error('Error fetching data from TGJU:', error.message);
    return null;
  }
}

async function updatePricesFile() {
  const prices = await fetchPricesFromTgju();
  
  if (!prices) {
    console.error('Failed to fetch prices, aborting update.');
    process.exit(1);
  }
  
  // Get the path to prices.json in the repo root
  const pricesFilePath = path.join(process.cwd(), 'prices.json');
  
  // Write the updated prices to the file
  fs.writeFileSync(
    pricesFilePath, 
    JSON.stringify(prices, null, 2), 
    'utf8'
  );
  
  console.log('prices.json updated successfully!');
}

// Run the update
updatePricesFile().catch(error => {
  console.error('Error in update process:', error);
  process.exit(1);
}); 