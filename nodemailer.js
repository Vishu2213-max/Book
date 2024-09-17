require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,   // use environment variable
        pass: process.env.EMAIL_PASS    // use environment variable
    }
});

module.exports = transporter;
