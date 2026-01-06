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
    <tr style="border-bottom: 1px solid #2d2d44;">
      <td style="padding: 12px 8px; color: #a0a0b8;">${article.sellerName}</td>
      <td style="padding: 12px 8px; color: #a0a0b8;">${article.sellerLevel}</td>
      <td style="padding: 12px 8px; color: #00b894; font-weight: 600;">${article.articlePrice}</td>
      <td style="padding: 12px 8px; color: #a0a0b8;">${article.articleAmount}</td>
      <td style="padding: 12px 8px; color: #6c6c80; font-style: italic; font-size: 0.9em;">${article.sellerComment || '-'}</td>
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
    <div style="background: #1a1a2e; padding: 24px; border-radius: 12px; margin: 20px 0; border: 1px solid #2d2d44;">
      <h2 style="color: #ffffff; margin: 0 0 16px 0; font-size: 1.3em;">${alert.articleName}</h2>
      
      ${imageUrl ? `<img src="${imageUrl}" width="120" style="display: block; border-radius: 8px; margin-bottom: 16px; border: 2px solid #6c5ce7;">` : ''}
      
      <div style="background: #252542; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">
        <p style="color: #a0a0b8; margin: 6px 0; font-size: 14px;"><span style="color: #6c6c80;">Category:</span> ${alert.category}</p>
        <p style="color: #a0a0b8; margin: 6px 0; font-size: 14px;"><span style="color: #6c6c80;">Language:</span> ${alert.language}</p>
        <p style="color: #a0a0b8; margin: 6px 0; font-size: 14px;"><span style="color: #6c6c80;">Seller Country:</span> ${alert.country}</p>
        <p style="color: #a0a0b8; margin: 6px 0; font-size: 14px;"><span style="color: #6c6c80;">Your target price:</span> ${alert.targetPrice.toFixed(2)} €</p>
      </div>
      
      <div style="background: linear-gradient(135deg, #6c5ce7 0%, #a855f7 100%); padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; text-align: center;">
        <p style="color: #ffffff; margin: 0; font-size: 1.1em; font-weight: 600;">💰 Best price: ${cheapestPrice}</p>
      </div>
      
      <h3 style="color: #a0a0b8; margin: 16px 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">📋 ${articleCount} offer(s) available</h3>
      <table style="width: 100%; border-collapse: collapse; background: #16162a; border-radius: 8px; overflow: hidden;">
        <tr style="background: #252542;">
          <th style="padding: 12px 8px; color: #a0a0b8; text-align: left; font-size: 12px; text-transform: uppercase;">Seller</th>
          <th style="padding: 12px 8px; color: #a0a0b8; text-align: left; font-size: 12px; text-transform: uppercase;">Sales</th>
          <th style="padding: 12px 8px; color: #a0a0b8; text-align: left; font-size: 12px; text-transform: uppercase;">Price</th>
          <th style="padding: 12px 8px; color: #a0a0b8; text-align: left; font-size: 12px; text-transform: uppercase;">Qty</th>
          <th style="padding: 12px 8px; color: #a0a0b8; text-align: left; font-size: 12px; text-transform: uppercase;">Comment</th>
        </tr>
        ${generateArticleRows(alert.matchingArticles)}
      </table>
      
      <p style="text-align: center; margin-top: 20px;">
        <a href="${cardmarketUrl}" style="display: inline-block; background: linear-gradient(135deg, #6c5ce7 0%, #a855f7 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
          🛒 View on Cardmarket
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
    subject: `🎉 Price Alert: ${totalArticles} item(s) with ${totalOffers} offer(s) below your target prices!`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f1a; padding: 0; border-radius: 16px; overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #6c5ce7 0%, #a855f7 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🎴 Poke'Scrap</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">Price Alert</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 24px;">
          <div style="background: #1a1a2e; border: 1px solid #2d2d44; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
            <p style="color: #ffffff; font-size: 18px; margin: 0;">
              🎉 <strong>${totalArticles} item(s)</strong> from your watchlist
            </p>
            <p style="color: #a0a0b8; font-size: 14px; margin: 8px 0 0 0;">
              with <strong style="color: #00b894;">${totalOffers} offer(s)</strong> below your target prices!
            </p>
          </div>
          
          ${alertBlocks}
        </div>
        
        <!-- Footer -->
        <div style="background: #1a1a2e; border-top: 1px solid #2d2d44; padding: 20px 24px; text-align: center;">
          <p style="color: #6c6c80; font-size: 12px; margin: 0;">
            This email was sent automatically by Poke'Scrap
          </p>
          <p style="margin: 8px 0 0 0;">
            <a href="mailto:pokescrap.project@gmail.com" style="color: #8b7cf7; font-size: 12px; text-decoration: none;">Contact</a>
          </p>
        </div>
        
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Consolidated email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email error to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Verify email configuration
 */
async function sendContactMessage({ name, email, subject, message }) {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: process.env.GMAIL_USER, // Send to ourselves
    subject: `Poke'Scrap Contact: ${subject}`,
    html: `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f1a; color: #ffffff; padding: 20px; border-radius: 12px;">
        <h2 style="color: #6c5ce7; margin-bottom: 20px;">📧 New Contact Message</h2>
        
        <div style="background: #1a1a2e; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #a0a0b8; margin-bottom: 15px;">From: ${name}</h3>
          <p style="color: #a0a0b8; margin-bottom: 10px;"><strong>Email:</strong> ${email}</p>
          <p style="color: #a0a0b8; margin-bottom: 15px;"><strong>Subject:</strong> ${subject}</p>
        </div>
        
        <div style="background: #1a1a2e; padding: 20px; border-radius: 8px;">
          <h4 style="color: #a0a0b8; margin-bottom: 10px;">Message:</h4>
          <p style="color: #ffffff; line-height: 1.6; white-space: pre-wrap;">${message}</p>
        </div>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #2d2d44; text-align: center;">
          <p style="color: #6c6c80; font-size: 12px;">This message was sent from the Poke'Scrap contact form</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Contact message sent successfully');
    return { success: true };
  } catch (error) {
    console.error('Error sending contact message:', error);
    return { success: false, error: error.message };
  }
}

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
  sendContactMessage,
  verifyEmailConfig
};
