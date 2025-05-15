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

// j ai la flemme et jsp les quelles sont worth a prendre mdr

const categories = [
	["etb", "Elite-Trainer-Boxes", "-Elite-Trainer-Box"],
	["booster", "Boosters", "-Booster"]
];


(async () => {
  
  let args = process.argv.slice(2);
  let i = 0;
  let product = '';
  let productExt = '';
  let categorie = '';
  let rawProduct = '';
  for (i = 0; args[i]; ++i) ;
  if (i != 2) {
	  return console.log("missinput! missinput!");
	//   rawProduct = args.join('-').trim();
    //   product = rawProduct + '-Elite-Trainer-Box';
  } else {
	  const input = args[0];

	  const match = categories.find(([name]) => name === input.toLowerCase());
	  if (match) {
		const [_, cat, prod] = match;
		categorie = cat;
		productExt = prod;
	    console.log(`cat: ${cat}, prod: ${prod}\n`);
	  } else {
		console.log("Not found.");
	  }
	  
	//   categorie = categorie.replace(/ /g,'-');
	  rawProduct = args[1];
	  product = rawProduct.replace(/ /g, '-') +  productExt; // '-Booster'
	  console.log(`product: ${product}\n`);
  }

  const url = 'https://www.cardmarket.com/fr/Pokemon/Products/' + categorie + '/' + product +'?sellerCountry=4&language=2';
  console.log(`url: ${url}\n`);
  const browser = await puppeteer.launch({ headless: true }); // set to false for debugging
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
      if (name && price) items.push({ article, name, sales, price , amount});
    });

    return items;
  });

  console.log(products);
  await browser.close();
})();
