const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
    },
});

transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP Error:', error);
    } else {
        console.log('✅ SMTP server is ready');
    }
});
module.exports = transporter;

