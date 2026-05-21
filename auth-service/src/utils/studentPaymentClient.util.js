// auth-service/src/utils/studentPaymentClient.util.js

const axios = require('axios');
const { logger } = require('../config/logger');

const billingClient = axios.create({
  baseURL: process.env.BILLING_SERVICE_URL,
  timeout: 5000,
});

exports.createStudentPaymentRecord = async ({
  studentId,
  counsellorId,
  registrationType,
  schoolId,
  schoolName,
  referenceCode,
  requestId,
}) => {
  try {
    const response = await billingClient.post(
      '/student-payment-internal/student-payment/create',
      {
        studentId,
        counsellorId,
        registrationType,
        schoolId,
        schoolName,
        referenceCode,
      },
      {
        headers: {
          'x-internal-secret':
            process.env.INTERNAL_SERVICE_SECRET,
          'x-request-id': requestId,
        },
      }
    );

    return response.data.data;
  } catch (error) {
    logger.error('Create student payment record failed', {
      requestId,
      error: error.response?.data || error.message,
    });

    throw new Error(
      error.response?.data?.message ||
        'Failed to create student payment record'
    );
  }
};