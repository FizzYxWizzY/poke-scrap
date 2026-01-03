const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

/**
 * Generate a unique filename from the URL
 */
function getFilenameFromUrl(url) {
  const hash = crypto.createHash('md5').update(url).digest('hex');
  const ext = path.extname(new URL(url).pathname) || '.png';
  return `${hash}${ext}`;
}

/**
 * Check if image already exists locally
 */
function imageExists(filename) {
  return fs.existsSync(path.join(IMAGES_DIR, filename));
}

/**
 * Get the local path for an image
 */
function getLocalImagePath(filename) {
  return path.join(IMAGES_DIR, filename);
}

/**
 * Get the public URL for a locally stored image
 */
function getPublicImageUrl(filename, baseUrl) {
  return `${baseUrl}/images/${filename}`;
}

/**
 * Download image from buffer (used when downloading within puppeteer context)
 */
function saveImageFromBuffer(buffer, filename) {
  const filepath = path.join(IMAGES_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

module.exports = {
  IMAGES_DIR,
  getFilenameFromUrl,
  imageExists,
  getLocalImagePath,
  getPublicImageUrl,
  saveImageFromBuffer
};
