const transporter = require('../config/mailer.config');
const { logger } = require('../config/logger');

const sendOtpEmail = async (email, otp) => {
  const mailOptions = {
    from: `"ByTrait" <${process.env.SMTP_EMAIL}>`,
    to: email,
    subject: 'Your OTP for ByTrait Login',
    html: `
      <div style="font-family: sans-serif;">
        <h2>OTP Verification</h2>
        <p>Your OTP is:</p>
        <h3 style="background: #eee; padding: 10px; display: inline-block;">${otp}</h3>
        <p>This OTP will expire in 5 minutes.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`OTP email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send OTP email to ${email}`, error);
    throw new Error('Failed to send OTP');
  }
};

module.exports = { sendOtpEmail };
