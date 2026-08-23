// auth-service/src/utils/studentPaymentClient.util.js

const axios = require('axios');
const { logger } = require('../config/logger');
const { isBillingEnabled } = require('./billingClient.util');
const { HttpError } = require('./HttpError');

const billingClient = axios.create({
  baseURL: process.env.BILLING_SERVICE_URL,
  timeout: 5000,
});

/**
 * Create the student payment record in billing after registration.
 * Billing uses referenceCode (and optionally referenceCodeId) to resolve
 * the fee for that specific token — not a free-form school picker.
 *
 * Skipped when BILLING_INTEGRATION_ENABLED=false (same flag as token pricing).
 */
exports.createStudentPaymentRecord = async ({
  studentId,
  counsellorId,
  registrationType,
  schoolId,
  schoolName,
  referenceCode,
  referenceCodeId,
  requestId,
}) => {
  if (!isBillingEnabled()) {
    logger.warn(
      `Billing integration disabled — skipping student payment create (studentId=${studentId}, referenceCode=${referenceCode})`
    );
    return null;
  }

  if (!process.env.BILLING_SERVICE_URL) {
    logger.warn(
      `BILLING_SERVICE_URL not configured — skipping student payment create (studentId=${studentId})`
    );
    return null;
  }

  try {
    console.log('Creating student payment record with data:', {
      studentId,
      counsellorId,
      registrationType,
      schoolId,
      schoolName,
      referenceCode,
    });
    const response = await billingClient.post(
      '/student-payment-internal/student-payment/create',
      {
        studentId,
        counsellorId,
        registrationType,
        schoolId,
        schoolName,
        referenceCode,
        referenceCodeId,
      },
      {
        headers: {
          'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET,
          'x-request-id': requestId,
        },
      }
    );
    console.log('Received response from billing service:', response.data);

    return response.data?.data ?? response.data;
  } catch (error) {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      'Failed to create student payment record';
    const detail = error.response
      ? `HTTP ${status} — ${JSON.stringify(error.response.data ?? {}).slice(0, 300)}`
      : error.message;

    logger.error(
      `Create student payment record failed [studentId=${studentId}, referenceCode=${referenceCode}, requestId=${
        requestId || 'n/a'
      }] — ${detail}`
    );

    const httpStatus =
      status && status >= 400 && status < 500 ? status : 502;

    throw new HttpError(httpStatus, message, {
      code: 'BILLING_STUDENT_PAYMENT_FAILED',
    });
  }
};
