const express = require('express');
const router = express.Router();
const db = require('../models/db'); 
const { ensureAuthenticated } = require('../auth'); 

router.get('/all',ensureAuthenticated, async (req, res) => {
    try {
        const [books] = await db.query(`
            SELECT orders.*, books.title, books.author, books.price,books.image
            FROM orders
            JOIN books ON orders.book_id = books.id
            WHERE orders.user_id = ?
            ORDER BY orders.created_at DESC
        `, [req.user.id]);
        
        res.render('orders', { books ,email: req.user.email});
    } catch (error) {
        res.status(500).send(error);
    }
});
module.exports = router;