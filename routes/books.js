const express = require('express');
const router = express.Router();
const db = require('../models/db'); // Ensure this path is correct
const { ensureAuthenticated } = require('../auth'); // This should now work correctly

// Your route handlers...


router.get('/all', async (req, res) => {
    try {
        const [books] = await db.query('SELECT * FROM books');
        res.render('books', { books });
    } catch (error) {
        res.status(500).send(error);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const added = req.query.added;
        const [book] = await db.query('SELECT * FROM books WHERE id = ?', [req.params.id]);
        if (book.length === 0) {
            res.status(404).render('error', { message: 'Book Not Found' });
        } else {
            if (req.user && req.user.id) {
                const [existingItem] = await db.query('SELECT * FROM cart WHERE user_id = ? AND book_id = ?', [req.user.id, req.params.id]);
                console.log(existingItem)
                if (existingItem.length > 0) {
                    res.render('bookDetail', { book: book[0], message: "exist" });
                } else {
                    res.render('bookDetail', { book: book[0] });
                }
            } else {
                res.render('bookDetail', { book: book[0] });
            }
        }
    } catch (error) {
        res.status(500).send(error);
    }
});

router.get("/categories/:id",async(req,res)=>{
    try{
        const [books] = await db.query('SELECT * FROM books WHERE category_id = ?', [req.params.id]); 
    if (books.length === 0) {
        res.status(404).render('error', { message: 'Book Not Found' });
    } else {
        res.render('books', { books });
    }
} catch (error) {
    res.status(500).send(error);
}
});


router.post('/search', async (req, res) => {
    try {
      const name = req.body.name; // Get the search query from the request body
      const [books]= await db.query('SELECT * FROM books WHERE LOWER(title) LIKE ?', [`%${name.toLowerCase()}%`]); 
      res.render('books', { books }); // Render the search results
    } catch (error) {
      res.status(500).send("something went wrong");
    }
  });


router.post('/add/:id', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const bookId = req.params.id;
        const [existingItem] = await db.query('SELECT * FROM cart WHERE user_id = ? AND book_id = ?', [userId, bookId]);

        if (existingItem.length > 0) {
            await db.query('UPDATE cart SET quantity = quantity + 1 WHERE user_id = ? AND book_id = ?', [userId, bookId]);
        } else {
            await db.query('INSERT INTO cart (user_id, book_id, quantity) VALUES (?, ?, 1)', [userId, bookId]);
        }

        res.redirect('/cart');
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;
