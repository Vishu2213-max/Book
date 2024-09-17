const express = require('express');
const router = express.Router();
const db = require('../models/db'); // Ensure this path is correct
const { ensureAuthenticated } = require('../auth');
const multer = require('multer');
const session = require('express-session');


const storage = multer.diskStorage({
  destination: './public/images',
  filename: (req, file, cb) => {
    const date = new Date();
    const filename = `${date.getFullYear()}${date.getMonth()}${date.getDate()}${date.getHours()}${date.getMinutes()}${date.getSeconds()}_${file.originalname}`;
    cb(null, filename);
  }
});

const upload = multer({ storage: storage });

// Middleware to check if admin is logged in
const isAdminLoggedIn = (req, res, next) => {
  if (!req.session.isAdminLoggedIn) {
    res.redirect("/admin/admin_log_in");
  } else {
    next();
  }
};

router.get('/admin_log_in', (req, res) => {
  req.session.isAdminLoggedIn = false;
  res.render('admin_log_in', { message: req.flash('message') });
})

router.post('/admin_log_in', async (req, res) => {
  const body = req.body;
  const admin = await db.query('select * from admin where email=?', [body.email])
  if (admin[0].length === 0) {
    res.render('admin_log_in', { message: 'Only Admin can access this panel' });
  }
  else if (admin[0][0].password != body.password) {
    res.render('admin_log_in', { message: 'Invalid password' });
  }
  req.session.isAdminLoggedIn = true;
  res.redirect('/admin/all');
});

router.get('/all', isAdminLoggedIn, async (req, res) => {
  try {
    const [books] = await db.query('SELECT * FROM books');
    res.render('admin_panel', { books });
  } catch (error) {
    res.status(500).send(error);
  }
});

router.get('/delete/:id', isAdminLoggedIn, async (req, res) => {
  const id = req.params.id;
  const book = await db.query('delete from books where id=?', [id]);
  res.redirect("/admin/all");
});

router.get('/update/:id', isAdminLoggedIn, async (req, res) => {
  const id = req.params.id;
  const books = await db.query('select * from books where id =?', [id]);
  const book = books[0][0]
  res.render("update_book", { bookData: book, id });
});

router.post('/update/:id', isAdminLoggedIn, async(req, res) => {
  const id = req.params.id;
  const title = req.body.title;
  const author = req.body.author;
  const price = req.body.price;
  const description = req.body.description;
  const image = req.body.image;
  const publishedDate = req.body.published_date;
  const categoryId = req.body.category_id;
 
  try {
    const timestamp = new Date(); 
    console.log(publishedDate)
    await db.query('UPDATE books SET title = ?, author = ?, price = ?, description = ?, image = ?, published_date = ?, category_id = ?, updated_at = ? WHERE id = ?', 
    [title, author, price, description, image, publishedDate, categoryId, timestamp, id]);
    res.redirect("/admin/all");
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating book');
  }
});

router.get('/add-book', isAdminLoggedIn, async (req, res) => {
  res.render("add_book");
})

router.post('/add-book', isAdminLoggedIn, upload.single('actualimage'), async (req, res) => {
  const image = req.file.filename;
  const title = req.body.title;
  const author = req.body.author;
  const price = req.body.price;
  const publishedDate = req.body.published_date;
  const categoryId = req.body.category_id;
  const description=req.body.description;

  try {
    const book = await db.query('INSERT INTO books SET ?', {
      title,
      author,
      price,
      image,
      published_date: publishedDate,
      category_id: categoryId,
      description
    });
    res.redirect("/admin/all");
  } catch (error) {
    console.error(error);
    res.status(500).send('Error adding book');
  }
});

router.get('/logout', async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
    } else {
      res.clearCookie('connect.sid');
      res.redirect("/admin/admin_log_in");
    }
  });
});

module.exports = router;