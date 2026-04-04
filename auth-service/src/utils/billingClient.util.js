const axios = require("axios");
const { logger } = require("../config/logger");

const billingClient = axios.create({
  baseURL: process.env.BILLING_SERVICE_URL,
  timeout: 5000
});
console.log(process.env.BILLING_SERVICE_URL);

exports.consumeCredit = async ({ counsellorId, requestId }) => {
  try {
    await billingClient.post(
      "/internal/consume-credit",
      { counsellorId },
      {
        headers: {
          "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET,
          "x-request-id": requestId
        }
      }
    );

    return true;
  } catch (error) {
    console.log(error);
    logger.error("Billing consume credit failed", {
      requestId,
      error: error.response?.data || error.message
    });

    throw new Error(
      error.response?.data?.message || "Registration limit reached"
    );
  }
};

exports.refundCredit = async ({ counsellorId, requestId }) => {
    try {
      await billingClient.post(
        "/internal/refund-credit",
        { counsellorId },
        {
          headers: {
            "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET,
            "x-request-id": requestId
          }
        }
      );
    } catch (error) {
      logger.error("Refund credit failed", {
        requestId,
        error: error.response?.data || error.message
      });
    }
  };

exports.grantSignupCredits = async ({
  counsellorId,
  requestId
}) => {

  await billingClient.post(
    `/internal/grant-signup-credits`,
    {
      counsellorId,
      requestId
    },
    {
      headers: {
        "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET,
        "x-request-id": requestId
      }
    }
  );
};