const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const db = require('./models/db');
const local=require("./middleware/local")
const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
passport.use(local)
const flash=require("connect-flash")
app.use(flash())
// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/books', require('./routes/books'));
app.use('/cart',require("./routes/cart"));
app.use('/admin',require("./routes/admin"))
app.use('/order',require("./routes/order"))
// Error handling
app.use((req, res, next) => {
  res.status(404).render('error', { message: 'Page Not Found' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

