const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { countries, languages } = require('../data/cardmarket-data');

/**
 * Scrapes Cardmarket for singles/cards by search string
 * Handles redirect: search URL -> redirected to actual card page -> then applies language/country filters
 * 
 * Usage: node src/scrape-singles.js <searchString> <country> <language>
 * Example: node src/scrape-singles.js lor042 switzerland french
 * 
 * Flow:
 * 1. Go to search URL with card ID
 * 2. Cardmarket redirects to the actual card page
 * 3. Extract productPath from redirected URL
 * 4. Add language/country filters and scrape sellers
 */

(async () => {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log(JSON.stringify({ 
      success: false, 
      error: 'Usage: node scrape-singles.js <searchString> <country> <language>' 
    }));
    return;
  }

  const searchString = args[0];
  const countryInput = args[1];
  const langInput = args[2];

  // Find country value
  const countryMatch = countries.find(c => 
    c.text.toLowerCase() === countryInput.toLowerCase() || 
    c.code.toLowerCase() === countryInput.toLowerCase()
  );
  if (!countryMatch) {
    console.log(JSON.stringify({ success: false, error: 'Country not found' }));
    return;
  }

  // Find language value
  const langMatch = languages.find(l => 
    l.text.toLowerCase() === langInput.toLowerCase() || 
    l.code.toLowerCase() === langInput.toLowerCase()
  );
  if (!langMatch) {
    console.log(JSON.stringify({ success: false, error: 'Language not found' }));
    return;
  }

  // URL for singles search - uses searchString parameter
  const searchUrl = `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(searchString)}&searchMode=v2`;

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

    // Go to search URL and wait for navigation (including redirects)
    await page.goto(searchUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Get the final URL after redirect
    const finalUrl = page.url();
    
    // Check if we were redirected to a product page (single result)
    const isProductPage = finalUrl.includes('/Products/Singles/') || 
                          (finalUrl.includes('/Products/') && !finalUrl.includes('/Search'));

    if (isProductPage) {
      // Redirected to single product - extract productPath and add filters
      const match = finalUrl.match(/\/Products\/([^?]+)/);
      const productPath = match ? match[1] : null;

      if (!productPath) {
        console.log(JSON.stringify({ success: false, error: 'Could not extract product path from redirect' }));
        await browser.close();
        return;
      }

      // Now navigate to the product page with language/country filters
      const filteredUrl = `https://www.cardmarket.com/fr/Pokemon/Products/${productPath}?sellerCountry=${countryMatch.value}&language=${langMatch.value}`;
      
      await page.goto(filteredUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      // Wait for sellers table or no-sellers message
      await page.waitForSelector('.table-body, .alert-info', { timeout: 15000 }).catch(() => {});

      // Scrape product info and sellers
      const result = await page.evaluate(() => {
        // Get product name
        const titleEl = document.querySelector('h1');
        const productName = titleEl ? titleEl.textContent.trim() : 'Unknown';

        // Get product image - use 2nd img.is-front (1st is previous card in carousel)
        const imgElements = document.querySelectorAll('img.is-front');
        const imgEl = imgElements.length > 1 ? imgElements[1] : imgElements[0];
        let productImage = null;
        if (imgEl) {
          productImage = imgEl.getAttribute('data-echo') || imgEl.src;
          // Ignore placeholder images
          if (productImage && productImage.includes('transparent.gif')) {
            productImage = null;
          }
        }

        // Check for no sellers
        const noSellersEl = document.querySelector('.alert-info');
        if (noSellersEl && noSellersEl.textContent.includes('no offers')) {
          return {
            noSellers: true,
            productName,
            productImage
          };
        }

        // Scrape sellers (using same selectors as scrapper-direct.js)
        const sellers = [];
        const rows = document.querySelectorAll('.table-body .row');
        
        rows.forEach(row => {
          // Get seller info
          const sellerEl = row.querySelector('.d-flex span');
          if (!sellerEl) return;
          
          const sellerText = sellerEl.innerText.trim();
          const parts = sellerText.split('\n');
          const sellerName = parts.pop().trim();
          const sellerSales = parts.join('').trim();
          
          // Get price - must exist and be valid
          const priceEl = row.querySelector('.price-container span');
          const price = priceEl ? priceEl.innerText.trim() : null;
          
          // Skip rows without a valid price
          if (!sellerName || !price || price === '' || price === '-') return;
          
          // Get amount
          const amountEl = row.querySelector('.amount-container span');
          const amount = amountEl ? amountEl.innerText.trim() : '1';
          
          // Get comment
          const commentEl = row.querySelector('.text-truncate.text-muted.fst-italic.small');
          const comment = commentEl ? commentEl.innerText.trim() : '';

          sellers.push({
            sellerName: sellerName,
            sellerLevel: sellerSales || '-',
            articlePrice: price,
            articleAmount: amount,
            sellerComment: comment
          });
        });

        return {
          productName,
          productImage,
          sellers
        };
      });

      // Download product image locally
      let localImage = null;
      if (result.productImage) {
        const imagesDir = path.join(__dirname, '..', 'public', 'images');
        if (!fs.existsSync(imagesDir)) {
          fs.mkdirSync(imagesDir, { recursive: true });
        }

        try {
          const hash = crypto.createHash('md5').update(result.productImage).digest('hex');
          const ext = result.productImage.includes('.png') ? '.png' : '.jpg';
          const localFilename = `${hash}${ext}`;
          const localPath = path.join(imagesDir, localFilename);

          // Check if file exists and is valid (> 1KB)
          let needsDownload = !fs.existsSync(localPath);
          if (!needsDownload) {
            const stats = fs.statSync(localPath);
            if (stats.size < 1000) {
              needsDownload = true; // Re-download corrupted file
              fs.unlinkSync(localPath);
            }
          }

          if (needsDownload) {
            const cookies = await page.cookies();
            const imgPage = await browser.newPage();
            await imgPage.setCookie(...cookies);
            await imgPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
            await imgPage.setExtraHTTPHeaders({ 'Referer': 'https://www.cardmarket.com/' });
            
            const response = await imgPage.goto(result.productImage, { waitUntil: 'networkidle0', timeout: 30000 });
            if (response && response.ok()) {
              const buffer = await response.buffer();
              // Only save if buffer is valid size
              if (buffer.length > 1000) {
                fs.writeFileSync(localPath, buffer);
              }
            }
            await imgPage.close();
          }

          // Verify file exists and is valid
          if (fs.existsSync(localPath) && fs.statSync(localPath).size > 1000) {
            localImage = localFilename;
          }
        } catch (err) {
          // Image download failed, continue without it
        }
      }

      // Output result for single product (direct scrape with sellers)
      console.log(JSON.stringify({
        success: true,
        searchUrl: searchUrl,
        searchString: searchString,
        redirected: true,
        productPath: productPath,
        productName: result.productName,
        articleImage: localImage,
        noSellers: result.noSellers || false,
        sellers: result.sellers || [],
        sellersCount: result.sellers ? result.sellers.length : 0
      }));

    } else {
      // Multiple results - return list of products for user to choose
      // (This case happens when search string matches multiple cards)
      
      await page.waitForSelector('.table-body, .alert', { timeout: 15000 }).catch(() => {});

      const products = await page.evaluate(() => {
        const results = [];
        const rows = document.querySelectorAll('.table-body .row');
        const seen = new Set();

        rows.forEach(row => {
          const link = row.querySelector('a[href*="/Products/"]');
          if (!link) return;

          const href = link.href;
          const name = link.textContent.trim();
          const match = href.match(/\/Products\/([^?]+)/);
          const productPath = match ? match[1] : null;

          // Get image
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
              name,
              productPath,
              url: href,
              image
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

      const cookies = await page.cookies();

      for (const product of products) {
        if (product.image) {
          try {
            const hash = crypto.createHash('md5').update(product.image).digest('hex');
            const ext = product.image.includes('.png') ? '.png' : '.jpg';
            const localFilename = `${hash}${ext}`;
            const localPath = path.join(imagesDir, localFilename);

            if (!fs.existsSync(localPath)) {
              const imgPage = await browser.newPage();
              await imgPage.setCookie(...cookies);
              await imgPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
              await imgPage.setExtraHTTPHeaders({ 'Referer': 'https://www.cardmarket.com/' });
              
              const response = await imgPage.goto(product.image, { waitUntil: 'networkidle0', timeout: 30000 });
              if (response && response.ok()) {
                const buffer = await response.buffer();
                fs.writeFileSync(localPath, buffer);
              }
              await imgPage.close();
              await new Promise(r => setTimeout(r, 500));
            }

            if (fs.existsSync(localPath)) {
              product.localImage = localFilename;
            }
          } catch (err) {
            product.localImage = null;
          }
        }
      }

      console.log(JSON.stringify({
        success: true,
        searchUrl: searchUrl,
        searchString: searchString,
        redirected: false,
        productsCount: products.length,
        products: products
      }));
    }

  } catch (err) {
    console.log(JSON.stringify({ 
      success: false, 
      error: err.message 
    }));
  } finally {
    await browser.close();
  }
})();
