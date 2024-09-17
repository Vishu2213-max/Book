require('dotenv').config();

const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const db = require('../models/db');
const nodemailer = require('../nodemailer');
const router = express.Router();
const middlware = require("../middleware/local")
const { ensureAuthenticated } = require('../auth');
const sms=require("../models/sms")
let Captcha = require('node-captcha-generator');

// Sign Up
router.get('/signup', (req, res) => {
  res.render('signup');
});

router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;
   await db.query('delete FROM users where status = 0');
    const user = await db.query('SELECT * FROM users WHERE email = ? and status = 1', [email]);
    if (user[0].length > 0) {
      res.render('error', { message: 'Email already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (username, email, password,ph,status) VALUES (?, ?, ?,?,?)', [username, email, hashedPassword, phone,0]);

    // Send OTP for verification
    const otp = Math.floor(100000 + Math.random() * 900000);
    const mailOptions = {
      from: 'vishwas2213@gmail.com',
      to: email,
      subject: 'Verify Your Email',
      text: `Your OTP code is ${otp}`
    };
    await nodemailer.sendMail(mailOptions);

    req.session.email = email;
    await db.query(`UPDATE users SET otp = ? WHERE email = ?`, [otp, email]);
    res.redirect('/auth/verify-otp');
  } catch (error) {
    res.status(500).send(error);
  }
});

async function imagecaptcha(req,res){
  var c = new Captcha({
    length:5, // number length
    size:{    // output size
        width: 300,
        height: 50
    }
});
await c.toBase64( async(err , base64)=>{
    if(err){
        console.log(err);
    }
    else{
        cap=c.value;
        req.session.cap=cap;
        console.log( req.session.cap)
        res.render('verify-otp',{ messages: req.flash('messages') , imagepath : base64});
    }
})
};

//verify otp
router.get('/verify-otp',async (req, res) => {
     imagecaptcha(req,res);
});

router.post("/verify-otp", async (req, res) => {
  body = req.body;
  const otp = body.otp;
  const email = req.session.email;
  const userotp = await db.query(`SELECT otp FROM users WHERE email = ?`, [email]);
  const captcha=body.captcha
  const cap= req.session.cap
  console.log(captcha);
  console.log(cap);
  if (cap==captcha) {
    
    if (userotp[0][0].otp == otp) {
      await db.query(`UPDATE users SET otp = null, status = 1 WHERE email = ?`, [email]);
      res.redirect('/auth/login');
    } else {
      res.render('verify-otp', { message: 'Enter valid OTP' });
    }
  } else {
    
    req.flash('messages', 'INVALID capcha! try again');
    imagecaptcha(req,res);
  }
});


router.get('/login', (req, res) => {
  res.render('login', { message: req.flash('message') });
});


router.post('/loginn', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect('/auth/login');
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      console.log("successfully login")

      req.session.email = req.user.email;
    
       sms("8053412213",req.user)
      res.redirect('/');
    });
  })(req, res, next);
});


router.get('/profile', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const client = await db.query('select * from users where id=?', [userId]);

    res.render('profile', { user: client[0][0] });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { message: 'Error fetching user profile' });
  }
});


router.get('/forgot', async (req, res) =>{
  res.render("forgot", { message: req.flash('message') })
});

router.post('/forgot', async (req, res) => {
  const email = req.body.email;
  const user = await db.query('SELECT * FROM users WHERE email = ? and status =1', [email]);
  if (user[0].length === 0) {
    req.flash('message', 'Email not found');
    return res.redirect('/auth/forgot');
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    const mailOptions = {
      from: 'vishwas2213@gmail.com',
      to: email,
      subject: 'Verify Your Email',
      text: `Your OTP code is ${otp}`
    };
    await nodemailer.sendMail(mailOptions);
    req.session.email=email;
    await db.query(`UPDATE users SET otp = ? WHERE email = ?`, [otp, email]);
    res.redirect("/auth/verify-otp2")
});

router.get('/verify-otp2',async (req,res)=>{
  res.render("verify-otp2", { messages: req.flash('messages') })
})

router.post('/verify-otp2',async (req,res)=>{
  const otp = req.body.otp;
   const email = req.session.email
  console.log(email);
  const userotp = await db.query(`SELECT otp FROM users WHERE email = ?`, [email]);
  if(otp==userotp[0][0].otp){
    await db.query(`UPDATE users SET otp = null WHERE email = ?`, [email]);
    res.redirect("/auth/reset-password");
   }
   else{
    req.flash('messages', 'enter valid otp');
    res.redirect('/auth/verify-otp2');
   }
})

router.get('/reset-password',async (req,res)=>{
  res.render("reset-password")
  });

  router.post('/reset-password',async (req,res)=>{
    const password = req.body.password;
    const email = req.session.email
    const hashedPassword = await bcrypt.hash(password, 10);
    const timestamp = new Date().toLocaleString(); 
    await db.query(`UPDATE users SET password = ?, updated_at = ? WHERE email = ?`, [hashedPassword, email,timestamp])
    res.redirect("/auth/login");    
  })

// Logout
router.get('/logout',ensureAuthenticated, (req, res) => {
  req.logout();
  res.redirect('/');
});

module.exports = router;
