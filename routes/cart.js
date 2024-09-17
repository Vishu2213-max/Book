
const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { ensureAuthenticated } = require('../auth');
const stripe = require('stripe')('sk_test_51PqXkc09DulGjp03i9SXh8RtXMN6pU2fzTdx38nOHDj128D1RFHRzpJrBhGylcxfSrrvdIRdIUcwLVzr4KAn85dE001qZA0yiO')

router.get('/add/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        await db.query('INSERT INTO cart (user_id, book_id) VALUES (?, ?)', [userId, id]);
        const [items] = await db.query(
            `SELECT c.cart_id, b.*, c.quantity 
         FROM cart c 
         JOIN books b ON c.book_id = b.id 
         WHERE c.user_id = ?`,
            [userId]
        );
        res.redirect(`/books/${id}`)
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Error occurred while adding item to cart' });
    }
});

router.get('/decrease/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    // Fetch the cart item
    const [cartItem] = await db.query('SELECT * FROM cart WHERE user_id = ? AND cart_id = ?', [userId, id]);
    const newQuantity = cartItem[0].quantity - 1;

    if (newQuantity <= 0) {
        await db.query('DELETE FROM cart WHERE user_id = ? AND cart_id = ?', [userId, id]);
    }
    else {
        await db.query('UPDATE cart SET quantity = ? WHERE user_id = ? AND cart_id = ?', [newQuantity, userId, id]);
    }
    res.redirect('/cart/show');
});

router.get('/increase/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const [cartItem] = await db.query('SELECT * FROM cart WHERE user_id = ? AND cart_id = ?', [userId, id]);
    const newQuantity = cartItem[0].quantity + 1;
    await db.query('UPDATE cart SET quantity = ? WHERE user_id = ? AND cart_id = ?', [newQuantity, userId, id]);
    res.redirect('/cart/show');

})

router.get('/show', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const [items] = await db.query(
            `SELECT c.cart_id , b.*, c.quantity 
         FROM cart c 
         JOIN books b ON c.book_id = b.id 
         WHERE c.user_id = ?`,
            [userId]
        );
        const totalPrice = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
        res.render('cart', { cartItems: items, totalPrice: totalPrice });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Error occurred while adding item to cart' });
    }
});

router.get('/remove/:id', ensureAuthenticated, async (req, res) => {
    try {
        const cartId = req.user.id;
        const { id } = req.params;
        await db.query('DELETE FROM cart WHERE user_id = ? AND cart_id = ?', [cartId, id]);
        res.redirect('/cart/show')
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Error occurred while adding item to cart' });
    }
});

router.get('/checkout', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch cart items for the logged-in user, joining with the book table to get book details
        const [cartItems] = await db.query(`
            SELECT c.quantity, b.title, b.price 
            FROM cart c 
            INNER JOIN books b ON c.book_id = b.id 
            WHERE c.user_id = ?
        `, [userId]);

        // If the cart is empty, handle the case (e.g., redirect or send a message)
        if (cartItems.length === 0) {
            return res.render('error', { message: "Your cart is empty" });
        }

        // Calculate total amount and prepare line_items for Stripe
        const lineItems = cartItems.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.title, // 'name' fetched from the 'book' table
                },
                unit_amount: Math.round(item.price * 100) // 'price' fetched from the 'book' table
            },
            quantity: item.quantity // 'quantity' from the 'cart' table
        }));

        // Calculate total amount
        const totalAmount = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;  // Get protocol dynamically
        const host = req.headers.host;  // Get the host dynamically

        // Build the baseUrl to support IP address and hostname usage
        const baseUrl =`${ protocol }://${host}`
            // Create a Stripe checkout session
            const session = await stripe.checkout.sessions.create({
                line_items: lineItems,
                mode: 'payment',
                shipping_address_collection: {
                    allowed_countries: ['IN'],
                },
                success_url: `${baseUrl}/cart/complete?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${baseUrl}/cart/cancel?session_id={CHECKOUT_SESSION_ID}`,
            });
        console.log(session);
        
        const sessionId = session.id;
        const successUrl = session.success_url.replace('{CHECKOUT_SESSION_ID}', sessionId);
        const cancelUrl = session.cancel_url.replace('{CHECKOUT_SESSION_ID}', sessionId);

        await db.query(`INSERT INTO transactions (user_id, transaction_id, amount, currency, payment_status) VALUES (?, ?, ?, ?, ?)`, [
            userId,
            session.id,
            totalAmount,
            'USD',
            'pending'
        ]);

        // Redirect to the Stripe checkout page
        res.redirect(session.url);
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).send('An error occurred during checkout.');
    }
});


router.get('/complete', ensureAuthenticated, async (req, res) => {
    const sessionId = req.query.session_id;
    const userId = req.user.id;
    const [cartItems] = await db.query(`
        SELECT c.cart_id, b.title, b.price, c.quantity, b.id as book_id 
        FROM cart c 
        INNER JOIN books b ON c.book_id = b.id 
        WHERE c.user_id = ?
      `, [userId]);

    // Insert cart items into orders table
    await Promise.all(cartItems.map(async (item) => {
        await db.query(`
          INSERT INTO orders (user_id, book_id, quantity, price) 
          VALUES (?, ?, ?, ?)
        `, [userId, item.book_id, item.quantity, item.price]);
    }));
    await db.query(`UPDATE transactions SET payment_status = 'success' WHERE transaction_id = ?`, [sessionId]);
    await db.query(`delete from cart where user_id=?`, [req.user.id]);
    res.render("payment", { message: "success" })
})

router.get('/cancel', ensureAuthenticated, async (req, res) => {
    const sessionId = req.query.session_id
    await db.query(`UPDATE transactions SET payment_status = 'cancelled' WHERE transaction_id = ?`, [sessionId]);
    res.redirect('payment', { message: "cancelled" })
});


module.exports = router;
