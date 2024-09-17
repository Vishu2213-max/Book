const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { session } = require('passport');
const { ensureAuthenticated } = require('../auth');

router.get('/', async (req, res) => {
    try {
        const [newBooks] = await db.query('SELECT * FROM books ORDER BY published_date DESC LIMIT 5');
        const [bestsellers] = await db.query('SELECT * FROM books ORDER BY RAND() LIMIT 5');
        const [categories] = await db.query('SELECT * FROM categories');
        let message = ''; 
        if (req.isAuthenticated() && req.user) {
            const userName = req.user.username;
            const firstLetter = userName.charAt(0);
            message = `${firstLetter}`;
        }
        res.render('index', { newBooks, bestsellers, categories, message });
    } catch (error) {
        // Handle errors
        console.error('Error rendering index page:', error);
        res.status(500).send(error);
    }
});

module.exports = router;