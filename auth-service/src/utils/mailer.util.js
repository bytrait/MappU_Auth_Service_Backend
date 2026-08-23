const transporter = require('../config/mailer.config');
const { logger } = require('../config/logger');
const { DEFAULT_BRAND } = require('./brand.util');

/**
 * Send OTP email (tenant-branded).
 *
 * @param {string} email
 * @param {string} otp
 * @param {'registration' | 'login'} type
 * @param {object} [brand]
 */
const sendOtpEmail = async (email, otp, type = 'login', brand = DEFAULT_BRAND) => {
  const isRegistration = type === 'registration';
  const displayName = brand.displayName || DEFAULT_BRAND.displayName;
  const fromName = brand.fromName || DEFAULT_BRAND.fromName;

  const subject = isRegistration
    ? `Your OTP for ${displayName} Registration`
    : `Your OTP for ${displayName} Login`;

  const html = isRegistration
    ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f9fafb; color: #333; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1f2937; margin: 0;">
            ${displayName}
          </h1>
        </div>

        <p style="font-size: 16px; margin-bottom: 16px;">
          Dear Student,
        </p>

        <p style="font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          Thank you for choosing ${displayName}.
        </p>

        <p style="font-size: 15px; line-height: 1.7; margin-bottom: 20px;">
          To complete your registration, please use the One Time Password (OTP) below:
        </p>

        <div style="text-align: left; margin: 30px 0;">
          <div style="display: inline-block; background-color: #eef2ff; color: #111827; font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 14px 28px; border-radius: 10px; border: 1px dashed #6366f1;">
            ${otp}
          </div>
        </div>

        <p style="font-size: 15px; line-height: 1.7; margin-bottom: 12px;">
          This OTP is valid for the next 5 minutes. Please do not share it with anyone for security reasons.
        </p>

        <p style="font-size: 15px; line-height: 1.7; margin-bottom: 12px;">
          If you did not request this, you can safely ignore this email.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

        <p style="font-size: 15px; margin-bottom: 4px;">
          Warm regards,
        </p>

        <p style="font-size: 15px; font-weight: 600; color: #111827; margin: 0;">
          Team ${displayName}
        </p>
      </div>
    `
    : `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background-color: #f9fafb; color: #333; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1f2937; margin: 0;">
            Login Verification
          </h2>
        </div>

        <p style="font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          We received a request to log in to your ${displayName} account.
        </p>

        <p style="font-size: 15px; line-height: 1.7; margin-bottom: 20px;">
          Please use the OTP below to continue:
        </p>

        <div style="text-align: left; margin: 30px 0;">
          <div style="display: inline-block; background-color: #eef2ff; color: #111827; font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 14px 28px; border-radius: 10px; border: 1px dashed #6366f1;">
            ${otp}
          </div>
        </div>

        <p style="font-size: 15px; line-height: 1.7; margin-bottom: 12px;">
          This OTP will expire in 5 minutes.
        </p>

        <p style="font-size: 15px; line-height: 1.7; margin-bottom: 0;">
          If you did not request this login, please ignore this email.
        </p>

        <p style="font-size: 14px; color: #111827; margin-top: 24px;">
          Team ${displayName}
        </p>
      </div>
    `;

  const mailOptions = {
    from: `"${fromName}" <${process.env.SMTP_EMAIL}>`,
    to: email,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`${type} OTP email sent to ${email} (brand=${fromName})`);
  } catch (error) {
    logger.error(`Failed to send ${type} OTP email to ${email}`, error);
    throw new Error('Failed to send OTP');
  }
};

module.exports = { sendOtpEmail };
