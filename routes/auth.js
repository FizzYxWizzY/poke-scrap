const express = require('express');
const path = require('path');
const router = express.Router();
const passport = require('passport');

// Route vers Google - save returnTo in session
router.get('/google', (req, res, next) => {
    if (req.query.returnTo) {
        req.session.returnTo = req.query.returnTo;
    }
    next();
}, passport.authenticate('google', { scope: ['email', 'profile'] }));

// Callback de Google - redirect to saved returnTo or default
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        req.session.userEmail = req.user.userEmail;
        req.session.displayName = req.user.displayName;
        req.session.googleId = req.user.googleId;
        req.session.userPicture = req.user.userPicture;
        const returnTo = req.session.returnTo || '/dashboard';
        delete req.session.returnTo;
        res.redirect(returnTo);
    }
);

module.exports = router;
