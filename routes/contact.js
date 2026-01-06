const express = require('express');
const router = express.Router();
const { sendContactMessage } = require('../services/emailService');

// POST contact form submission - PUBLIC
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        error: 'All fields are required (name, email, subject, message)'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate field lengths
    if (name.length > 100 || email.length > 100 || subject.length > 200 || message.length > 2000) {
      return res.status(400).json({ error: 'Field lengths exceed maximum allowed' });
    }

    // Send the contact message
    const result = await sendContactMessage({ name, email, subject, message });

    if (result.success) {
      res.json({
        message: 'Thank you for your message! We\'ll get back to you soon.'
      });
    } else {
      console.error('Failed to send contact message:', result.error);
      res.status(500).json({
        error: 'Failed to send message. Please try again later.'
      });
    }
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      error: 'An unexpected error occurred. Please try again later.'
    });
  }
});

module.exports = router;