const puppeteer = require('puppeteer');
const { categories, languages, countries } = require('../data/cardmarket-data');

/**
 * Pre-search scrapper
 * Searches Cardmarket and returns all matching products with their URLs
 * 
 * Usage: node src/presearch.js "category" "search term"
 * Example: node src/presearch.js "Elite-Trainer-Boxes" "151"
 */

(async () => {
	const args = process.argv.slice(2);
	
	if (args.length < 2) {
		console.log(JSON.stringify({ error: 'Usage: node presearch.js <category> <search>' }));
		return;
	}
	
	let categorySlug = args[0];
	const searchTerm = args[1];
	
	// Support legacy format
	const legacyMap = { 'etb': 'Elite-Trainer-Boxes', 'booster': 'Boosters' };
	if (legacyMap[categorySlug.toLowerCase()]) {
		categorySlug = legacyMap[categorySlug.toLowerCase()];
	}
	
	// Find category value for the search form
	const categoryData = categories.find(c => c.slug.toLowerCase() === categorySlug.toLowerCase());
	if (!categoryData) {
		console.log(JSON.stringify({ error: 'Category not found', availableCategories: categories.map(c => c.slug) }));
		return;
	}
	
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
		
		// Build search URL
		// https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=151&idCategory=1016
		const searchUrl = `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(searchTerm)}&idCategory=${categoryData.value}`;
		
		await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
		
		// Wait for results
		await page.waitForSelector('.table, .info-container', { timeout: 15000 }).catch(() => {});
		
		// Extract all product links from search results
		const products = await page.evaluate(() => {
			const results = [];
			
			// Find all product rows in search results
			const rows = document.querySelectorAll('.table-body .row');
			
			rows.forEach(row => {
				// Get product link and name
				const linkEl = row.querySelector('a[href*="/Products/"]');
				const imgEl = row.querySelector('img');
				
				if (linkEl) {
					const href = linkEl.href;
					const name = linkEl.innerText.trim() || linkEl.querySelector('span')?.innerText.trim();
					const image = imgEl?.src || null;
					
					// Extract product slug from URL
					// e.g., /en/Pokemon/Products/Elite-Trainer-Boxes/151-Elite-Trainer-Box
					const urlParts = href.split('/Products/');
					let productPath = '';
					if (urlParts[1]) {
						productPath = urlParts[1].split('?')[0]; // Remove query params
					}
					
					if (name && href) {
						results.push({
							name: name,
							url: href,
							productPath: productPath,
							image: image
						});
					}
				}
			});
			
			// Also check for direct product cards (different layout)
			const cards = document.querySelectorAll('.col-12 a[href*="/Products/"]');
			cards.forEach(card => {
				const href = card.href;
				const name = card.innerText.trim();
				const imgEl = card.querySelector('img');
				const image = imgEl?.src || null;
				
				const urlParts = href.split('/Products/');
				let productPath = '';
				if (urlParts[1]) {
					productPath = urlParts[1].split('?')[0];
				}
				
				// Avoid duplicates
				if (name && href && !results.find(r => r.url === href)) {
					results.push({
						name: name,
						url: href,
						productPath: productPath,
						image: image
					});
				}
			});
			
			return results;
		});
		
		console.log(JSON.stringify({
			success: true,
			category: categoryData.text,
			categorySlug: categorySlug,
			searchTerm: searchTerm,
			resultsCount: products.length,
			products: products
		}));
		
	} catch (err) {
		console.log(JSON.stringify({ error: err.message }));
	} finally {
		await browser.close();
	}
})();
