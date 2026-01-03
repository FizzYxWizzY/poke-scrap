const nodemailer = require('nodemailer');

// Base URL for serving images
const BASE_URL = process.env.BASE_URL || 'https://fizzywizzy.gotdns.ch';

// Create Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD // Use App Password, not regular password
  }
});

/**
 * Generate HTML rows for matching articles
 */
function generateArticleRows(articles) {
  return articles.map(article => `
    <tr style="border-bottom: 1px solid #47284c;">
      <td style="padding: 8px; color: #c1c1c1;">${article.sellerName}</td>
      <td style="padding: 8px; color: #c1c1c1;">${article.sellerLevel}</td>
      <td style="padding: 8px; color: #4CAF50; font-weight: bold;">${article.articlePrice}</td>
      <td style="padding: 8px; color: #c1c1c1;">${article.articleAmount}</td>
    </tr>
  `).join('');
}

// Category mappings for building Cardmarket URLs
const categoryMap = {
  'etb': 'Elite-Trainer-Boxes',
  'booster': 'Boosters'
};

const categoryExtMap = {
  'etb': '-Elite-Trainer-Box',
  'booster': '-Booster'
};

const languageMap = {
  'english': '1', 'french': '2', 'german': '3', 'spanish': '4', 'italian': '5', 'portugese': '8'
};

const countryMap = {
  'austria': '1', 'belgium': '2', 'france': '12', 'germany': '7', 'italy': '17',
  'netherlands': '23', 'spain': '10', 'switzerland': '4', 'united kingdom': '13'
};

/**
 * Build Cardmarket URL from alert data
 */
function buildCardmarketUrl(alert) {
  const lang = languageMap[alert.language] || '1';
  const country = countryMap[alert.country] || '12';
  
  // Use productPath if available (new flow)
  if (alert.productPath) {
    return `https://www.cardmarket.com/fr/Pokemon/Products/${alert.productPath}?sellerCountry=${country}&language=${lang}`;
  }
  
  // Legacy URL building
  const cat = categoryMap[alert.category] || alert.category;
  const ext = categoryExtMap[alert.category] || '';
  const product = alert.articleName.replace(/ /g, '-') + ext;
  
  return `https://www.cardmarket.com/fr/Pokemon/Products/${cat}/${product}?sellerCountry=${country}&language=${lang}`;
}

/**
 * Generate HTML block for a single watchlist item alert
 */
function generateAlertBlock(alert) {
  const articleCount = alert.matchingArticles.length;
  const cheapestPrice = alert.matchingArticles[0]?.articlePrice || 'N/A';
  const articleImage = alert.matchingArticles[0]?.articleImage || null;
  const imageUrl = articleImage ? `${BASE_URL}/images/${articleImage}` : null;
  const cardmarketUrl = buildCardmarketUrl(alert);
  
  return `
    <div style="background: #30385a; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h2 style="color: #fff; margin: 0 0 15px 0;">${alert.articleName}</h2>
      
      ${imageUrl ? `<img src="${imageUrl}" width="120" height="120" style="display: block; border-radius: 8px; margin-bottom: 15px;">` : ''}
      
      <p style="color: #c1c1c1; margin: 5px 0;"><strong>Catégorie:</strong> ${alert.category}</p>
      <p style="color: #c1c1c1; margin: 5px 0;"><strong>Langue:</strong> ${alert.language}</p>
      <p style="color: #c1c1c1; margin: 5px 0;"><strong>Pays vendeur:</strong> ${alert.country}</p>
      <p style="color: #c1c1c1; margin: 5px 0;"><strong>Votre prix cible:</strong> ${alert.targetPrice.toFixed(2)} €</p>
      <p style="color: #4CAF50; margin: 5px 0; font-size: 1.2em;"><strong>Meilleur prix: ${cheapestPrice}</strong></p>
      
      <h3 style="color: #c1c1c1; margin-top: 20px;">📋 ${articleCount} offre(s):</h3>
      <table style="width: 100%; border-collapse: collapse; background: #232943;">
        <tr style="border-bottom: 2px solid #47284c;">
          <th style="padding: 8px; color: #c1c1c1; text-align: left;">Vendeur</th>
          <th style="padding: 8px; color: #c1c1c1; text-align: left;">Ventes</th>
          <th style="padding: 8px; color: #c1c1c1; text-align: left;">Prix</th>
          <th style="padding: 8px; color: #c1c1c1; text-align: left;">Qté</th>
        </tr>
        ${generateArticleRows(alert.matchingArticles)}
      </table>
      
      <p style="text-align: center; margin-top: 15px;">
        <a href="${cardmarketUrl}" style="background: #4CAF50; color: white; padding: 8px 16px; text-decoration: none; border-radius: 5px; font-size: 14px;">
          🛒 Voir sur Cardmarket
        </a>
      </p>
    </div>
  `;
}

/**
 * Send consolidated price alert email with all matching watchlist items
 */
async function sendConsolidatedAlert({ to, alerts }) {
  const totalArticles = alerts.length;
  const totalOffers = alerts.reduce((sum, alert) => sum + alert.matchingArticles.length, 0);
  
  // Generate all alert blocks
  const alertBlocks = alerts.map(alert => generateAlertBlock(alert)).join('');
  
  const mailOptions = {
    from: `"Poke'Scrap Alert" <${process.env.GMAIL_USER}>`,
    to: to,
    subject: `🎉 Alerte Prix: ${totalArticles} article(s) avec ${totalOffers} offre(s) sous vos prix cibles!`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #47284c; padding: 20px; border-radius: 10px;">
        <h1 style="color: #c1c1c1; text-align: center;">🎴 Poke'Scrap - Alerte Prix!</h1>
        
        <p style="color: #c1c1c1; text-align: center; font-size: 1.1em;">
          ${totalArticles} article(s) de votre watchlist ont des offres sous vos prix cibles!
        </p>
        
        ${alertBlocks}
        
        <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
          Cet email a été envoyé automatiquement par Poke'Scrap.
        </p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email consolidé envoyé à ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Erreur envoi email à ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Verify email configuration
 */
async function verifyEmailConfig() {
  try {
    await transporter.verify();
    console.log('✅ Email service configured correctly');
    return true;
  } catch (err) {
    console.error('❌ Email configuration error:', err.message);
    return false;
  }
}

module.exports = {
  sendConsolidatedAlert,
  verifyEmailConfig
};
