const prisma = require('../prisma/prisma');
const transporter = require('../config/mailer.config');
const { logger } = require('../config/logger');

const getBasicUserDetails = async (studentId) => {
  const user = await prisma.user.findUnique({
    where: {
      id: studentId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

const formatDate = (date) => {
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const sendPaymentReceiptEmail = async ({
  fullName,
  email,
  receiptNumber,
  amount,
  currency,
  paymentDate,
  razorpayPaymentId,
  registrationType,
  schoolName,
}) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #2563eb, #4f46e5); padding: 32px; color: white;">
        <h1 style="margin: 0; font-size: 28px;">
          Payment Receipt
        </h1>

        <p style="margin-top: 10px; font-size: 14px; opacity: 0.9;">
          Thank you for completing your MapU payment.
        </p>
      </div>

      <div style="padding: 32px;">
        <p style="font-size: 16px; color: #111827; margin-bottom: 20px;">
          Hi ${fullName},
        </p>

        <p style="font-size: 15px; line-height: 1.7; color: #4b5563; margin-bottom: 24px;">
          Your payment has been received successfully. You can now access your assessment,
          downloadable reports, and premium student features.
        </p>

        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #6b7280;">Receipt Number</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #111827;">
                ${receiptNumber}
              </td>
            </tr>

            <tr>
              <td style="padding: 10px 0; color: #6b7280;">Amount Paid</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #111827;">
                ${currency} ${amount}
              </td>
            </tr>

            <tr>
              <td style="padding: 10px 0; color: #6b7280;">Payment Date</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #111827;">
                ${formatDate(paymentDate)}
              </td>
            </tr>

            <tr>
              <td style="padding: 10px 0; color: #6b7280;">Payment ID</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #111827;">
                ${razorpayPaymentId}
              </td>
            </tr>

            <tr>
              <td style="padding: 10px 0; color: #6b7280;">Registration Type</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #111827;">
                ${registrationType}
              </td>
            </tr>

            ${
              schoolName
                ? `
            <tr>
              <td style="padding: 10px 0; color: #6b7280;">School</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #111827;">
                ${schoolName}
              </td>
            </tr>
            `
                : ''
            }
          </table>
        </div>

        <div style="background-color: #ecfeff; border: 1px solid #a5f3fc; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
          <p style="margin: 0; color: #155e75; font-size: 14px; line-height: 1.6;">
            You can now log in and continue your assessment journey on MapU.
          </p>
        </div>

        <p style="font-size: 14px; color: #6b7280; line-height: 1.7;">
          If you have any questions, please contact our support team.
        </p>

        <p style="font-size: 14px; color: #111827; margin-top: 24px;">
          Team MapU
        </p>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"MapU" <${process.env.SMTP_EMAIL}>`,
    to: email,
    subject: `Payment Receipt - ${receiptNumber}`,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);

    logger.info(`Payment receipt email sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send payment receipt email to ${email}`, error);
    throw new Error('Failed to send payment receipt email');
  }
};

module.exports = {
  getBasicUserDetails,
  sendPaymentReceiptEmail,
};