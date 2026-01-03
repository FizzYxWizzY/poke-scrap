const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { countries, languages } = require('../data/cardmarket-data');

/**
 * Direct product scrapper
 * Scrapes a specific product using its exact Cardmarket path
 * 
 * Usage: node src/scrapper-direct.js "productPath" "country" "language"
 * Example: node src/scrapper-direct.js "Elite-Trainer-Boxes/151-Elite-Trainer-Box" "switzerland" "french"
 */

(async () => {
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
	const url = `https://www.cardmarket.com/fr/Pokemon/Products/${productPath}?sellerCountry=${countryMatch.value}&language=${langMatch.value}`;
	
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
		
		await page.goto(url, { waitUntil: 'domcontentloaded' });
		
		// Wait for listings
		await page.waitForSelector('.table-body', { timeout: 15000 }).catch(() => {});
		
		// Get the image URL first
		const imageUrl = await page.evaluate(() => {
			const imgElement = document.querySelector('img.is-front');
			return imgElement?.src || null;
		});
		
		// Download image
		let localImageFilename = null;
		if (imageUrl) {
			try {
				const imgPage = await browser.newPage();
				const cookies = await page.cookies();
				await imgPage.setCookie(...cookies);
				await imgPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
				
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
		await browser.close();
	}
})();
