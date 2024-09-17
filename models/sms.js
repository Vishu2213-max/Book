require('dotenv').config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;



const client = require('twilio')(accountSid, authToken);
function SMS(number,user) {
    client.messages
        .create({
            body: `Hey ${user.username}!\nYour account just loged in.`,
            from:  process.env.TWILIO_PHONE_NUMBER,
            to: '+91' + number
        });
}

module.exports = SMS