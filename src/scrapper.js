const puppeteer = require('puppeteer');

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

// j ai la flemme et jsp les quelles sont worth a prendre pour les categories mdr
// le reste est full ;)

const categories = [
	["etb", "Elite-Trainer-Boxes", "-Elite-Trainer-Box"],
	["booster", "Boosters", "-Booster"]
];

const languages = [
	["english", "1", "en"],
	["french", "2", "fr"],
	["german", "3", "de"],
	["spanish", "4", "es"],
	["italian", "5", "it"],
	["portugese", "8", "pt"]
];

const countries = [
	["austria", "1", "at"],
	["belgium", "2", "be"],
	["bulgaria", "3", "bg"],
	["canada", "33", "ca"],
	["croatia", "35", "cr"],
	["cyprus", "5", "cy"],
	["czech republic", "6", "cz"],
	["denmark", "8", "dk"],
	["estonia", "9", "ee"],
	["finland", "11", "fl"],
	["france", "12", "fr"],
	["germany", "7", "de"],
	["greece", "14", "gr"],
	["hungary", "15", "hu"],
	["iceland", "37", "is"],
	["ireland", "16", "ie"],
	["italy", "17", "it"],
	["japan", "36", "jp"],
	["latvia", "21", "lv"],
	["liechtenstein", "18", "li"],
	["lithuania", "19", "lt"],
	["luxembourg", "20", "lu"],
	["malta", "21", "mt"],
	["netherland", "23", "nl"],
	["norway", "24", "no"],
	["poland", "25", "pl"],
	["portugal", "26", "pt"],
	["romania", "27", "ro"],
	["singapore", "29", "sg"],
	["slovakia", "31", "sk"],
	["slovenia", "30", "sl"],
	["spain", "10", "es"],
	["sweden", "28", "se"],
	["switzerland", "4", "ch"],
	["united kingdom", "13", "uk"]
];

// UPGRADE:	add proxy usage like tor etc...
// 			so i could escape possible ip ban

(async () => {
  
	let args = process.argv.slice(2);
	let i = 0;
	let product = '';
	let productExt = '';
	let categorie = '';
	let rawProduct = '';
	let lang = '';
	let langExt = '';
	let country = '';
	let countryExt = '';
	
	if (args.length != 4) {
		return 1;
	} else {
		let input = args[0];

		let match = categories.find(([name]) => name === input.toLowerCase());
		if (match) {
			const [_, cat, prod] = match;
			categorie = cat;
			productExt = prod;
	    	// console.log(`cat: ${cat}, prod: ${prod}\n`);
		} else {
			console.log("Not found.");
		}
	  
		rawProduct = args[1];
		product = rawProduct.replace(/ /g, '-') +  productExt; // '-Booster'
		//   console.log(`product: ${product}\n`);

		input = args[2]
		match = countries.find(([name]) => name === input.toLowerCase());
		if (match) {
			const [_, uri, ext] = match;
			country = uri;
			countryExt = ext;
			// console.log(`cat: ${country}, prod: ${countryExt}\n`);
		} else {
			console.log("Not found.");
		}

		input = args[3]
		match = languages.find(([name]) => name === input.toLowerCase());
		if (match) {
			const [_, uri, ext] = match;
			lang = uri;
			langExt = ext;
	    	// console.log(`cat: ${lang}, prod: ${langExt}\n`);
		} else {
			console.log("Not found.");
		}
	}

	const url = 'https://www.cardmarket.com/fr/Pokemon/Products/' + categorie + '/' + product +'?' + 'sellerCountry=' + country + '&' + 'language=' + lang;
	//   console.log(`\n\nurl: ${url}\n\n\n`);
	const browser = await puppeteer.launch({
		headless: true,
		args: [ // pour etre plus discret (idk if tor proxy blocked or it just doesnt work)
			// '--proxy-server=socks5://127.0.0.1:9050',
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-blink-features=AutomationControlled'
		  ]
	}); // set to false for debugging
	const page = await browser.newPage();

	await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

	await page.goto(url, { waitUntil: 'domcontentloaded' });

	// Wait for a known wrapper that shows listings
	await page.waitForSelector('.table-body');

	const products = await page.evaluate(() => {
    	const items = [];
		const listings = document.querySelectorAll('.table-body .row');

    	listings.forEach(row => {
			const article = document.querySelector('h1').innerText.trim(); // Only 1 product name on the page
    		const seller = row.querySelector('.d-flex span')?.innerText.trim();
			const parts = seller.split('\n');
    		const name = parts.pop().trim(); // last part is the name
    		const sales = parts.join('').trim(); // rest is the number, e.g., '1K' or '4'
			const price = row.querySelector('.price-container span')?.innerText.trim();
			const amount = row.querySelector('.amount-container span')?.innerText.trim();
    		if (name && price) {
				items.push({ article, name, sales, price , amount});
			}
    	});
    	return items;
	});
	console.log(JSON.stringify(products, null, 2));
	await browser.close();
})();
