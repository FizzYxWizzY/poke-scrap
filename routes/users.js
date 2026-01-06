const express = require('express');
const router = express.Router();
const User = require('../db/models/User');
const { ensureAuth, ensureAdmin, ensureRole } = require('../middlewares/auth');

// Read all - ADMIN ONLY
router.get('/', ensureAdmin, async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Get system statistics - BETATESTER AND ABOVE
router.get('/stats', ensureRole('betatester'), async (req, res) => {
  console.log('Stats route called by user:', req.user ? req.user.userEmail : 'unknown');
  try {
    // User stats by role
    const userStats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    let totalWatchlists = 0;
    let totalArticles = 0;
    let recentSearches = 0;

    try {
      // Watchlist stats
      const Watchlist = require('../db/models/Watchlist');
      totalWatchlists = await Watchlist.countDocuments();
    } catch (error) {
      console.warn('Could not fetch watchlist stats:', error.message);
    }

    try {
      // Article stats
      const Article = require('../db/models/Article');
      totalArticles = await Article.countDocuments();
    } catch (error) {
      console.warn('Could not fetch article stats:', error.message);
    }

    try {
      // Recent searches (last 24 hours)
      const RecentSearch = require('../db/models/RecentSearch');
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      recentSearches = await RecentSearch.countDocuments({ 
        searchedAt: { $gte: yesterday } 
      });
    } catch (error) {
      console.warn('Could not fetch recent search stats:', error.message);
    }

    // Format user stats
    const roleStats = {};
    userStats.forEach(stat => {
      roleStats[stat._id] = stat.count;
    });

    res.json({
      users: {
        total: userStats.reduce((sum, stat) => sum + stat.count, 0),
        byRole: roleStats
      },
      watchlists: {
        total: totalWatchlists
      },
      articles: {
        total: totalArticles
      },
      activity: {
        recentSearches: recentSearches
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get current user profile
router.get('/me', ensureAuth, async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json(user);
});

// Get user preferences
router.get('/preferences', ensureAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('favoriteCountry favoriteLanguage');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      favoriteCountry: user.favoriteCountry || '',
      favoriteLanguage: user.favoriteLanguage || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user preferences
router.put('/preferences', ensureAuth, async (req, res) => {
  try {
    const { favoriteCountry, favoriteLanguage } = req.body;
    
    // Validate inputs if provided
    if (favoriteCountry !== undefined && typeof favoriteCountry !== 'string') {
      return res.status(400).json({ error: 'favoriteCountry must be a string' });
    }
    if (favoriteLanguage !== undefined && typeof favoriteLanguage !== 'string') {
      return res.status(400).json({ error: 'favoriteLanguage must be a string' });
    }

    const updateData = {};
    if (favoriteCountry !== undefined) updateData.favoriteCountry = favoriteCountry;
    if (favoriteLanguage !== undefined) updateData.favoriteLanguage = favoriteLanguage;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('favoriteCountry favoriteLanguage');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Preferences updated successfully',
      preferences: {
        favoriteCountry: user.favoriteCountry || '',
        favoriteLanguage: user.favoriteLanguage || ''
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read one - AUTHENTICATED USERS
router.get('/:id', ensureAuth, async (req, res) => {
  console.log('User by ID route called with id:', req.params.id);
  // Validate that id is a valid ObjectId
  if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
    console.log('Invalid ObjectId format:', req.params.id);
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  
  const user = await User.findById(req.params.id);
  res.json(user);
});

// Update user role - ADMIN ONLY
router.put('/:id/role', ensureAdmin, async (req, res) => {
  const { role } = req.body;
  const validRoles = ['free', 'paid', 'betatester', 'admin'];
  
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be one of: free, paid, betatester, admin' });
  }
  
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { role }, 
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: `User role updated to ${role}`, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;