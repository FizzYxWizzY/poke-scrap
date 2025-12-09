const express = require('express');
const router = express.Router();
const passport = require('passport');

// Route vers Google
router.get('/google',
    passport.authenticate('google', { scope: ['email', 'profile'] })
);

// Callback de Google
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        req.session.userEmail = req.user.userEmail;
        req.session.displayName = req.user.displayName;
        req.session.googleId = req.user.googleId;
        req.session.userPicture = req.user.userPicture;
        res.sendFile('/home/user/poke-scrap/views/test2.html');
    }
);

module.exports = router;
