const LocalStrategy = require('passport-local');
const db = require('../models/db');
const bcrypt = require('bcrypt');
const passport = require('passport');

const localStrategy = new LocalStrategy({
  usernameField: 'email',
  passReqToCallback: true
}, async (req,email, password, done) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE email = ? and status = 1', [email]);
    if (result[0].length === 0) {
      req.flash('message', 'User does not exist');
      return done(null, false);
    }

    const user = result[0];
    const passwordIsSame = await bcrypt.compare(password, user[0].password);
    if (passwordIsSame) {
      return done(null, user[0]);
    } else {
      req.flash('message', 'Invalid  password');
      return done(null, false);
    }
  } catch (err) {
    req.flash('message', 'Error while querying');
    return done(err, null);
  }
});

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (result.length === 0) {
      return done(null, false);
    }
    return done(null, result[0][0]);
  } catch (err) {
    return done(err);
  }
});

module.exports = localStrategy;