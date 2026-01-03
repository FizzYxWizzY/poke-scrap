const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Scrapes Cardmarket search results to get all product names and links
 * 
 * Usage: node src/scrape-products.js <categoryId> <expansionId>
 * Example: node src/scrape-products.js 1016 5402
 * 
 * URL format: https://www.cardmarket.com/en/Pokemon/Products/Search?searchMode=v2&idCategory=1016&idExpansion=5402&idRarity=0&perSite=30
 */

(async () => {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(JSON.stringify({ 
      success: false, 
      error: 'Usage: node scrape-products.js <categoryId> <expansionId>' 
    }));
    return;
  }

  const categoryId = args[0];
  const expansionId = args[1];

  const searchUrl = `https://www.cardmarket.com/en/Pokemon/Products/Search?searchMode=v2&idCategory=${categoryId}&idExpansion=${expansionId}&idRarity=0&perSite=50`;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

    await page.goto(searchUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Wait for results table
    await page.waitForSelector('.table-body, .alert', { timeout: 15000 }).catch(() => {});

    const products = await page.evaluate(() => {
      const results = [];
      
      // Find all product rows
      const rows = document.querySelectorAll('.table-body .row');
      
      const seen = new Set(); // Avoid duplicates
      
      rows.forEach(row => {
        // Get the product link
        const link = row.querySelector('a[href*="/Products/"]');
        if (!link) return;
        
        const href = link.href;
        const name = link.textContent.trim();
        
        // Extract product path from URL
        const match = href.match(/\/Products\/([^?]+)/);
        const productPath = match ? match[1] : null;
        
        // Get image from thumbnail-icon's data-bs-title attribute
        // The image URL is embedded in HTML like: <img src="https://...">
        const thumbnailIcon = row.querySelector('.thumbnail-icon.is-pokemon');
        let image = null;
        if (thumbnailIcon) {
          const dataTitle = thumbnailIcon.getAttribute('data-bs-title');
          if (dataTitle) {
            const imgMatch = dataTitle.match(/src="([^"]+)"/);
            if (imgMatch) {
              image = imgMatch[1];
            }
          }
        }
        
        if (productPath && name && !seen.has(productPath)) {
          seen.add(productPath);
          results.push({
            name: name,
            productPath: productPath,
            url: href,
            image: image
          });
        }
      });

      return results;
    });

    // Download images locally
    const imagesDir = path.join(__dirname, '..', 'public', 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Get cookies from main page for image downloads
    const cookies = await page.cookies();

    for (const product of products) {
      if (product.image) {
        try {
          // Create hash-based filename
          const hash = crypto.createHash('md5').update(product.image).digest('hex');
          const ext = product.image.includes('.png') ? '.png' : '.jpg';
          const localFilename = `${hash}${ext}`;
          const localPath = path.join(imagesDir, localFilename);

          // Check if already downloaded
          if (!fs.existsSync(localPath)) {
            const imgPage = await browser.newPage();
            await imgPage.setCookie(...cookies);
            await imgPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
            
            // Set referer to Cardmarket to avoid 403
            await imgPage.setExtraHTTPHeaders({
              'Referer': 'https://www.cardmarket.com/'
            });
            
            const response = await imgPage.goto(product.image, { waitUntil: 'networkidle0', timeout: 30000 });
            
            if (response && response.ok()) {
              const buffer = await response.buffer();
              fs.writeFileSync(localPath, buffer);
            }
            
            await imgPage.close();
            
            // Small delay between downloads to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
          }

          // Only set localImage if file exists
          if (fs.existsSync(localPath)) {
            product.localImage = localFilename;
          } else {
            product.localImage = null;
          }
        } catch (err) {
          // Image download failed, continue without it
          product.localImage = null;
        }
      }
    }

    console.log(JSON.stringify({
      success: true,
      searchUrl: searchUrl,
      categoryId: categoryId,
      expansionId: expansionId,
      productsCount: products.length,
      products: products
    }));

  } catch (err) {
    console.log(JSON.stringify({ 
      success: false, 
      error: err.message 
    }));
  } finally {
    await browser.close();
  }
})();
