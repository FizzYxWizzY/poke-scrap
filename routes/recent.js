const express = require('express');
const router = express.Router();
const RecentSearch = require('../db/models/RecentSearch');

const MAX_RECENT_SEARCHES = 30;

// GET recent searches (public)
router.get('/', async (req, res) => {
  try {
    const searches = await RecentSearch.find()
      .sort({ searchedAt: -1 })
      .limit(MAX_RECENT_SEARCHES)
      .lean();
    
    res.json(searches);
  } catch (err) {
    console.error('Error fetching recent searches:', err.message);
    res.status(500).json({ error: 'Failed to fetch recent searches' });
  }
});

// POST add a recent search (public - called when user selects a product)
router.post('/', async (req, res) => {
  try {
    const { name, productPath, image } = req.body;
    
    if (!name || !productPath) {
      return res.status(400).json({ error: 'name and productPath required' });
    }
    
    // Upsert - update if exists, insert if not
    await RecentSearch.findOneAndUpdate(
      { productPath },
      { 
        name, 
        productPath, 
        image: image || null,
        searchedAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    // Clean up old entries (keep only MAX)
    const count = await RecentSearch.countDocuments();
    if (count > MAX_RECENT_SEARCHES) {
      const toDelete = await RecentSearch.find()
        .sort({ searchedAt: -1 })
        .skip(MAX_RECENT_SEARCHES)
        .select('_id');
      
      if (toDelete.length > 0) {
        await RecentSearch.deleteMany({ 
          _id: { $in: toDelete.map(d => d._id) } 
        });
      }
    }
    
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Error saving recent search:', err.message);
    res.status(500).json({ error: 'Failed to save recent search' });
  }
});

module.exports = router;
