const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AnonymizeUA = require('puppeteer-extra-plugin-anonymize-ua');

// Add stealth plugin to make detection harder
puppeteer.use(StealthPlugin());

// Add user agent anonymization
puppeteer.use(AnonymizeUA({
  stripHeadless: true,
  makeWindows: true
}));

/* 
CATEGORIES:
	cartes:
		Singles
	boosters:
		Boosters
	boites de boosters:
		Booster-Boxes
	Produits scellés: (no 'sealed-product/' in url)
		Theme-Decks:
			Theme-Decks
		Trainer-Kits:
			Trainer-Kits
		Tins:
			Tins
		Box-Sets:
			Box-Sets
		Elite-Trainer-Boxes:
			Elite-Trainer-Boxes
		Blisters:
			Blisters
	Sets, Lots et Collections:
		Coins:
			Coins
		Lots:
			Lots
	Accessories:
		Sleeves:
			Sleeves
		Feuilles de Classeur:
			Pocket-Pages
		Classeurs:
			Albums
		Deck-Boxes:
			Deck-Boxes
		Dice:
			Dice
		Tapis de jeu:
			Playmats
		Storage:
			Storage
		Marqueurs:
			Gaming-Stones
		Life-Counter:
			Life-Counter
		Books-Comics-Guides:
			Books-Comics-Guides
		Séparateurs:
			Dividers
		Souvenirs:
			Memorabilia
		Dice-Bags:
			Dice-Bags
		Game-Kits:
			Game-Kits
		Card-Scanners:
			Card-Scanners
		Apparel:
			Apparel
*/

// Load data from cardmarket-data.js
const { categories, languages, countries } = require('../data/cardmarket-data');

// Product suffix mapping for URL building
const productSuffixes = {
	"Elite-Trainer-Boxes": "-Elite-Trainer-Box",
	"Boosters": "-Booster",
	"Booster-Boxes": "-Booster-Box",
	"Blisters": "-Blister",
	"Theme-Decks": "-Theme-Deck",
	"Trainer-Kits": "-Trainer-Kit",
	"Tins": "-Tin",
	"Box-Sets": "-Box-Set",
	"Singles": "", // No suffix for singles
	"Coins": "",
	"Lots": "",
	"Sleeves": "",
	"Playmats": "",
	"Deck-Boxes": "",
	"Albums": "",
	"Storage": "",
	"Pocket-Pages": "",
	"Dice": "",
	"Dividers": "",
	"Memorabilia": "",
	"Life-Counter": "",
	"Gaming-Stones": "",
	"Game-Kits": "",
	"Card-Scanners": "",
	"Apparel": "",
	"Books-Comics-Guides": "",
	"Dice-Bags": "",
	"Grading": "",
	"Sets": ""
};

// UPGRADE:	add proxy usage like tor etc...
// 			so i could escape possible ip ban

(async () => {
  
	let args = process.argv.slice(2);
	let categorySlug = '';
	let productSuffix = '';
	let rawProduct = '';
	let countryValue = '';
	let langValue = '';
	
	if (args.length != 4) {
		return 1;
	} else {
		// args[0] = category slug (e.g., "Elite-Trainer-Boxes" or "etb" for backwards compatibility)
		let input = args[0];
		
		// Support both old format (etb, booster) and new format (slug)
		const legacyMap = { 'etb': 'Elite-Trainer-Boxes', 'booster': 'Boosters' };
		if (legacyMap[input.toLowerCase()]) {
			categorySlug = legacyMap[input.toLowerCase()];
		} else {
			// Try to find by slug
			let match = categories.find(c => c.slug.toLowerCase() === input.toLowerCase());
			if (match) {
				categorySlug = match.slug;
			} else {
				console.log("Category not found.");
				console.log(JSON.stringify([]));
				return;
			}
		}
		productSuffix = productSuffixes[categorySlug] || '';
	  
		// args[1] = product name (e.g., "151", "prismatic evolutions")
		rawProduct = args[1];
		const product = rawProduct.replace(/ /g, '-') + productSuffix;

		// args[2] = country (by name or code)
		input = args[2];
		let countryMatch = countries.find(c => 
			c.text.toLowerCase() === input.toLowerCase() || 
			c.code.toLowerCase() === input.toLowerCase()
		);
		if (countryMatch) {
			countryValue = countryMatch.value;
		} else {
			console.log("Country not found.");
			console.log(JSON.stringify([]));
			return;
		}

		// args[3] = language (by name or code)
		input = args[3];
		let langMatch = languages.find(l => 
			l.text.toLowerCase() === input.toLowerCase() || 
			l.code.toLowerCase() === input.toLowerCase()
		);
		if (langMatch) {
			langValue = langMatch.value;
		} else {
			console.log("Language not found.");
			console.log(JSON.stringify([]));
			return;
		}

		const url = 'https://www.cardmarket.com/fr/Pokemon/Products/' + categorySlug + '/' + product + '?sellerCountry=' + countryValue + '&language=' + langValue;
		// console.log(`\n\nurl: ${url}\n\n\n`);
		
		const browser = await puppeteer.launch({
			headless: 'new',
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-accelerated-2d-canvas',
				'--no-first-run',
				'--no-zygote',
				'--disable-gpu',
				'--disable-web-security',
				'--disable-features=VizDisplayCompositor',
				'--disable-ipc-flooding-protection',
				'--disable-background-timer-throttling',
				'--disable-backgrounding-occluded-windows',
				'--disable-renderer-backgrounding',
				'--disable-field-trial-config',
				'--disable-back-forward-cache',
				'--disable-hang-monitor',
				'--disable-ipc-flooding-protection',
				'--disable-popup-blocking',
				'--disable-prompt-on-repost',
				'--force-color-profile=srgb',
				'--metrics-recording-only',
				'--no-default-browser-check',
				'--no-first-run',
				'--enable-automation=false',
				'--password-store=basic',
				'--use-mock-keychain',
				'--disable-component-extensions-with-background-pages',
				'--disable-default-apps',
				'--disable-sync',
				'--disable-translate',
				'--hide-scrollbars',
				'--metrics-recording-only',
				'--mute-audio',
				'--no-default-browser-check',
				'--no-first-run',
				'--disable-component-update',
				'--disable-domain-reliability',
				'--disable-client-side-phishing-detection',
				'--disable-background-networking',
				'--disable-breakpad',
				'--disable-component-extensions-with-background-pages',
				'--disable-features=TranslateUI,BlinkGenPropertyTrees',
				'--disable-ipc-flooding-protection',
				'--disable-hang-monitor',
				'--disable-prompt-on-repost',
				'--force-color-profile=srgb',
				'--enable-features=NetworkService,NetworkServiceInProcess',
				'--disable-features=VizDisplayCompositor,VizHitTestSurfaceLayer'
			],
			ignoreDefaultArgs: ['--enable-automation'],
			ignoreHTTPSErrors: true
		});
		const page = await browser.newPage();
		
		// Set a realistic viewport
		await page.setViewport({ 
			width: 1366 + Math.floor(Math.random() * 200), 
			height: 768 + Math.floor(Math.random() * 200),
			deviceScaleFactor: 1,
			hasTouch: false,
			isLandscape: true,
			isMobile: false
		});
		
		// Comprehensive browser fingerprinting
		await page.evaluateOnNewDocument(() => {
			// Remove webdriver property
			Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
			
			// Mock realistic navigator properties
			Object.defineProperty(navigator, 'plugins', { 
				get: () => [
					{ name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
					{ name: 'Chrome PDF Viewer', description: '', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
					{ name: 'Native Client', description: '', filename: 'internal-nacl-plugin' }
				] 
			});
			
			Object.defineProperty(navigator, 'languages', { 
				get: () => ['en-US', 'en', 'fr'] 
			});
			
			// Mock permissions
			const originalQuery = window.navigator.permissions.query;
			window.navigator.permissions.query = (parameters) => (
				parameters.name === 'notifications' ?
				Promise.resolve({ state: Notification.permission }) :
				originalQuery(parameters)
			);
			
			// Mock chrome runtime
			window.chrome = {
				runtime: {
					onConnect: undefined,
					onMessage: undefined,
					connect: function() { return {}; },
					sendMessage: function() { return {}; }
				},
				csi: function() { return {}; },
				loadTimes: function() { return {}; },
				app: {
					isInstalled: false
				}
			};
			
			// Mock webkit properties
			window.webkit = {
				messageHandlers: {},
				postMessage: function() {}
			};
			
			// Override toString methods
			const toString = Function.prototype.toString;
			Function.prototype.toString = function() {
				if (this === navigator.webdriver) return 'function webdriver() { [native code] }';
				return toString.apply(this, arguments);
			};
		});
		
		// Intercept and modify requests
		await page.setRequestInterception(true);
		page.on('request', (request) => {
			const headers = {
				...request.headers(),
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
				'Accept-Encoding': 'gzip, deflate, br',
				'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
				'Cache-Control': 'max-age=0',
				'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
				'Sec-Ch-Ua-Mobile': '?0',
				'Sec-Ch-Ua-Platform': '"Windows"',
				'Sec-Fetch-Dest': 'document',
				'Sec-Fetch-Mode': 'navigate',
				'Sec-Fetch-Site': 'none',
				'Sec-Fetch-User': '?1',
				'Upgrade-Insecure-Requests': '1'
			};
			request.continue({ headers });
		});
		
		// Add random delay before navigation
		await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

		await page.goto(url, { waitUntil: 'domcontentloaded' });

		// Wait for a known wrapper that shows listings
		await page.waitForSelector('.table-body');

		// Get the image URL first
		const imageUrl = await page.evaluate(() => {
			const imgElement = document.querySelector('img.is-front');
			return imgElement?.src || null;
		});

		// Download image using page's cookies/context via CDP
		let localImageFilename = null;
		if (imageUrl) {
			try {
				const fs = require('fs');
				const path = require('path');
				const crypto = require('crypto');
				
				// Use page.goto to fetch the image with same session
				const imgPage = await browser.newPage();
				
				// Copy cookies from main page
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
				// Image download failed, continue without it
				console.error('Image download error:', err.message);
			}
		}

		const products = await page.evaluate(() => {
			const items = [];
			const listings = document.querySelectorAll('.table-body .row');
			const articleImage = document.querySelector('img.is-front')?.src || null;
			const articleTitle = document.querySelector('h1')?.innerText.trim() || null;
			
			// Check if this is a product page (has price listings area) or a category page
			const isProductPage = document.querySelector('.table-body') !== null && 
			                      document.querySelector('.info-list-container') !== null;

			listings.forEach(row => {
				const article = articleTitle;
				const seller = row.querySelector('.d-flex span')?.innerText.trim();
				if (!seller) return;
				const parts = seller.split('\n');
				const name = parts.pop().trim(); // last part is the name
				const sales = parts.join('').trim(); // rest is the number, e.g., '1K' or '4'
				const price = row.querySelector('.price-container span')?.innerText.trim();
				const amount = row.querySelector('.amount-container span')?.innerText.trim();
				const comment = row.querySelector('.text-truncate.text-muted.fst-italic.small')?.innerText.trim() || null;
				if (name && price) {
					items.push({ article, articleImage, name, sales, price, amount, comment });
				}
			});
			
			// Return metadata about the product even if no sellers
			return {
				productExists: !!articleTitle && isProductPage,
				articleTitle,
				articleImage,
				items
			};
		});
		
		// If product doesn't exist (no title found), return empty array
		if (!products.productExists) {
			console.log(JSON.stringify([]));
			await browser.close();
			return;
		}
		
		// Replace remote image URL with local filename
		const productsWithLocalImage = products.items.map(p => ({
			...p,
			localImage: localImageFilename
		}));
		
		// If product exists but no sellers, return a special marker with product info
		if (productsWithLocalImage.length === 0) {
			console.log(JSON.stringify({
				noSellers: true,
				articleTitle: products.articleTitle,
				localImage: localImageFilename
			}));
		} else {
			console.log(JSON.stringify(productsWithLocalImage));
		}
		
		await browser.close();
	}
})();
