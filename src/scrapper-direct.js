const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AnonymizeUA = require('puppeteer-extra-plugin-anonymize-ua');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { countries, languages } = require('../data/cardmarket-data');

// Add stealth plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUA());

/**
 * Simulate human-like behavior to avoid detection
 */
async function simulateHumanBehavior(page) {
  // Random mouse movements
  const viewport = await page.viewport();
  const x = Math.random() * (viewport.width - 100) + 50;
  const y = Math.random() * (viewport.height - 100) + 50;
  await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
  
  // Random scroll
  await page.evaluate(() => {
    const scrollAmount = Math.random() * 500;
    window.scrollTo({
      top: scrollAmount,
      behavior: 'smooth'
    });
  });
  
  // Random pause
  await new Promise(resolve => setTimeout(resolve, Math.random() * 1500 + 500));
  
  // Sometimes click on random elements (safely)
  try {
    const clickableElements = await page.$$('a, button, [role="button"], [onclick]');
    if (clickableElements.length > 0 && Math.random() < 0.1) { // 10% chance
      const randomElement = clickableElements[Math.floor(Math.random() * clickableElements.length)];
      await randomElement.hover();
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 200));
    }
  } catch (e) {
    // Ignore if clicking fails
  }
}

(async () => {
	// Global timeout to prevent hanging
	const globalTimeout = setTimeout(() => {
		console.log(JSON.stringify([]));
		process.exit(0);
	}, 20000); // 20 seconds
	const args = process.argv.slice(2);
	
	if (args.length < 3) {
		console.log(JSON.stringify({ error: 'Usage: node scrapper-direct.js <productPath> <country> <language>' }));
		return;
	}
	
	const productPath = args[0]; // e.g., "Elite-Trainer-Boxes/151-Elite-Trainer-Box"
	const countryInput = args[1];
	const langInput = args[2];
	
	// Find country value
	const countryMatch = countries.find(c => 
		c.text.toLowerCase() === countryInput.toLowerCase() || 
		c.code.toLowerCase() === countryInput.toLowerCase()
	);
	if (!countryMatch) {
		console.log(JSON.stringify({ error: 'Country not found' }));
		return;
	}
	
	// Find language value
	const langMatch = languages.find(l => 
		l.text.toLowerCase() === langInput.toLowerCase() || 
		l.code.toLowerCase() === langInput.toLowerCase()
	);
	if (!langMatch) {
		console.log(JSON.stringify({ error: 'Language not found' }));
		return;
	}
	
	// Build URL with exact product path
	const url = `https://www.cardmarket.com/en/Pokemon/Products/${productPath}?sellerCountry=${countryMatch.value}&language=${langMatch.value}`;
	console.error('Building product URL:', url);
	
	const browser = await puppeteer.launch({
		headless: 'new',
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-dev-shm-usage',
			'--disable-web-security',
			'--disable-blink-features=AutomationControlled',
			'--disable-features=VizDisplayCompositor'
		]
	});
	
	try {
		const page = await browser.newPage();
		
		// Set realistic viewport
		await page.setViewport({
			width: 1920,
			height: 1080
		});
		
		// Add initial delay
		await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
		
		// First visit the main Pokemon page to establish a session
		console.error('Visiting main Pokemon page first...');
		try {
			await page.goto('https://www.cardmarket.com/en/Pokemon', {
				waitUntil: 'networkidle2',
				timeout: 15000
			});
			
			// Wait and simulate human behavior
			await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1500));
			await simulateHumanBehavior(page);
		} catch (mainPageError) {
			console.error('Main page visit failed:', mainPageError.message);
			// Continue anyway
		}
		
		// Now go to the product URL
		console.error('Accessing product URL:', url);
		
		try {
			await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
		} catch (gotoError) {
			console.error('Page goto timeout or error:', gotoError.message);
			console.log(JSON.stringify([]));
			return;
		}
		
		// Check if blocked by Cloudflare
		const title = await page.title();
		console.error('Page title:', title);
		if (title.includes('Just a moment') || title.includes('Checking your browser')) {
			console.error('Cloudflare detected in direct scrapper');
			console.log(JSON.stringify([]));
			return;
		}
		
		// Wait for listings
		await page.waitForSelector('.table-body', { timeout: 5000 }).catch(() => {});
		
		// Get the image URL first - use 2nd img.is-front (1st is previous card in carousel)
		const imageUrl = await page.evaluate(() => {
			const imgElements = document.querySelectorAll('img.is-front');
			const imgElement = imgElements.length > 1 ? imgElements[1] : imgElements[0];
			if (!imgElement) return null;
			const dataEcho = imgElement.getAttribute('data-echo');
			const src = imgElement.src;
			// Prefer data-echo (real image), ignore transparent placeholder
			if (dataEcho) return dataEcho;
			if (src && !src.includes('transparent.gif')) return src;
			return null;
		});
		
		// Download image
		let localImageFilename = null;
		if (imageUrl) {
			try {
				const imgPage = await browser.newPage();
				const cookies = await page.cookies();
				await imgPage.setCookie(...cookies);
				
				const response = await imgPage.goto(imageUrl, { waitUntil: 'networkidle0' });
				
				if (response && response.ok()) {
					const buffer = await response.buffer();
					const hash = crypto.createHash('md5').update(imageUrl).digest('hex');
					const contentType = response.headers()['content-type'] || '';
					const ext = contentType.includes('jpeg') ? '.jpg' : '.png';
					localImageFilename = `${hash}${ext}`;
					
					const imagesDir = path.join(__dirname, '..', 'public', 'images');
					if (!fs.existsSync(imagesDir)) {
						fs.mkdirSync(imagesDir, { recursive: true });
					}
					
					fs.writeFileSync(path.join(imagesDir, localImageFilename), buffer);
				}
				
				await imgPage.close();
			} catch (err) {
				console.error('Image download error:', err.message);
			}
		}
		
		// Extract products
		const products = await page.evaluate(() => {
			const items = [];
			const listings = document.querySelectorAll('.table-body .row');
			const articleImage = document.querySelector('img.is-front')?.src || null;
			const articleTitle = document.querySelector('h1')?.innerText.trim() || null;
			
			const isProductPage = document.querySelector('.table-body') !== null && 
			                      document.querySelector('.info-list-container') !== null;
			
			listings.forEach(row => {
				const seller = row.querySelector('.d-flex span')?.innerText.trim();
				if (!seller) return;
				const parts = seller.split('\n');
				const name = parts.pop().trim();
				const sales = parts.join('').trim();
				const price = row.querySelector('.price-container span')?.innerText.trim();
				const amount = row.querySelector('.amount-container span')?.innerText.trim();
				const comment = row.querySelector('.text-truncate.text-muted.fst-italic.small')?.innerText.trim() || null;
				
				if (name && price) {
					items.push({ 
						article: articleTitle, 
						articleImage, 
						name, 
						sales, 
						price, 
						amount, 
						comment 
					});
				}
			});
			
			return {
				productExists: !!articleTitle && isProductPage,
				articleTitle,
				articleImage,
				items
			};
		});
		
		// Handle results
		if (!products.productExists) {
			console.log(JSON.stringify([]));
			await browser.close();
			return;
		}
		
		const productsWithLocalImage = products.items.map(p => ({
			...p,
			localImage: localImageFilename
		}));
		
		if (productsWithLocalImage.length === 0) {
			console.log(JSON.stringify({
				noSellers: true,
				articleTitle: products.articleTitle,
				localImage: localImageFilename,
				productPath: productPath
			}));
		} else {
			console.log(JSON.stringify(productsWithLocalImage));
		}
		
	} catch (err) {
		console.log(JSON.stringify({ error: err.message }));
	} finally {
		clearTimeout(globalTimeout);
		await browser.close();
	}
})();
