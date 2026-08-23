// auth-service/src/utils/billingClient.util.js
//
// Internal client for talking to the billing service from auth-service.
// Use this for anything that lives in the billing domain (e.g. token
// prices) but is triggered as a side effect of an auth-service action.

const axios = require('axios');
const { logger } = require('../config/logger');

const billingClient = axios.create({
  baseURL: process.env.BILLING_SERVICE_URL,
  timeout: 5000,
});

const internalHeaders = (requestId) => ({
  'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET,
  'x-request-id': requestId,
});

/**
 * Master switch for the billing integration. When `false` (e.g. during
 * local dev when the billing service isn't running yet), the helpers below
 * log a warning and resolve with `null` instead of throwing. Default is
 * "enabled" so production isn't accidentally silent.
 */
const isBillingEnabled = () => {
  const raw = (process.env.BILLING_INTEGRATION_ENABLED ?? 'true')
    .toString()
    .trim()
    .toLowerCase();
  return !['false', '0', 'no', 'off'].includes(raw);
};

/**
 * Build a human-readable diagnostic string from an axios error so it shows
 * up in winston (whose default printf only renders the `message` field and
 * silently drops the metadata object).
 */
const describeAxiosError = (error) => {
  if (!error) return 'unknown error';

  // Server responded with a non-2xx
  if (error.response) {
    const { status, statusText, data } = error.response;
    const bodyText =
      typeof data === 'string'
        ? data.slice(0, 500)
        : JSON.stringify(data ?? {}).slice(0, 500);
    return `HTTP ${status} ${statusText || ''} — body: ${bodyText}`;
  }

  // Request made but no response (network / DNS / timeout)
  if (error.request) {
    return `no response (code=${error.code || 'n/a'}, message=${
      error.message
    })`;
  }

  return error.message || String(error);
};

/**
 * Upsert the price attached to a reference token.
 *
 * The token itself lives in auth-service (`ReferenceCode` row). Pricing is
 * owned by the billing service - we forward the price + lifecycle dates so
 * the billing side can keep its own dedicated price record in sync.
 *
 * Behavior:
 *   - When `BILLING_INTEGRATION_ENABLED=false`, this no-ops with a warning
 *     log. Useful for local dev when billing isn't running yet.
 *   - When enabled, a failure throws so the caller can roll back the
 *     half-created token row.
 *
 * Expected billing endpoint:
 *   POST {BILLING_SERVICE_URL}/reference-token-internal/reference-token-price/upsert
 */
exports.upsertReferenceTokenPrice = async ({
  tokenId,
  code,
  type,
  targetId,
  counsellorId,
  price,
  currency = 'INR',
  startDate,
  expiryDate,
  label,
  requestId,
}) => {
  if (!isBillingEnabled()) {
    logger?.warn?.(
      `Billing integration disabled — skipping price upsert (tokenId=${tokenId}, code=${code}, price=${price})`
    );
    return null;
  }

  if (!process.env.BILLING_SERVICE_URL) {
    logger?.warn?.(
      `BILLING_SERVICE_URL not configured — skipping price upsert (tokenId=${tokenId}, code=${code})`
    );
    return null;
  }

  try {
    const response = await billingClient.post(
      '/reference-token-internal/reference-token-price/upsert',
      {
        tokenId,
        code,
        type,
        targetId,
        counsellorId,
        price,
        currency,
        startDate,
        expiryDate,
        label,
      },
      { headers: internalHeaders(requestId) }
    );

    return response.data?.data ?? response.data;
  } catch (error) {
    const detail = describeAxiosError(error);
    logger?.error?.(
      `Upsert reference token price failed [tokenId=${tokenId}, code=${code}, requestId=${
        requestId || 'n/a'
      }] — ${detail}`
    );

    // Bubble the underlying server message up to the API caller when
    // available; otherwise prefix the wrapper with the diagnostic so the
    // FE / Postman user sees the real cause instead of a vague string.
    throw new Error(
      error.response?.data?.message ||
        `Failed to store reference token price in billing service (${detail})`
    );
  }
};

/**
 * Tell billing to drop / archive the price record for a token (e.g. when the
 * token is deactivated). Failures here are non-fatal for the auth flow - the
 * caller decides whether to throw or just log.
 *
 * Expected billing endpoint:
 *   POST {BILLING_SERVICE_URL}/reference-token-internal/reference-token-price/deactivate
 */
exports.isBillingEnabled = isBillingEnabled;

exports.deactivateReferenceTokenPrice = async ({ tokenId, requestId }) => {
  if (!isBillingEnabled() || !process.env.BILLING_SERVICE_URL) {
    logger?.warn?.(
      `Billing integration disabled / unconfigured — skipping price deactivation (tokenId=${tokenId})`
    );
    return null;
  }

  try {
    const response = await billingClient.post(
      '/reference-token-internal/reference-token-price/deactivate',
      { tokenId },
      { headers: internalHeaders(requestId) }
    );

    return response.data?.data ?? response.data;
  } catch (error) {
    const detail = describeAxiosError(error);
    logger?.warn?.(
      `Deactivate reference token price failed [tokenId=${tokenId}, requestId=${
        requestId || 'n/a'
      }] — ${detail}`
    );
    return null;
  }
};

/**
 * Grant initial counsellor credits after counsellor registration.
 * Non-fatal: counsellor account remains if billing is down or grant fails.
 *
 * Billing endpoint:
 *   POST {BILLING_SERVICE_URL}/internal/grant-signup-credits
 */
exports.grantSignupCredits = async ({ counsellorId, requestId }) => {
  if (!isBillingEnabled()) {
    logger?.warn?.(
      `Billing integration disabled — skipping signup credits (counsellorId=${counsellorId})`
    );
    return null;
  }

  if (!process.env.BILLING_SERVICE_URL) {
    logger?.warn?.(
      `BILLING_SERVICE_URL not configured — skipping signup credits (counsellorId=${counsellorId})`
    );
    return null;
  }

  try {
    const response = await billingClient.post(
      '/internal/grant-signup-credits',
      { counsellorId, requestId },
      { headers: internalHeaders(requestId) }
    );

    return response.data?.data ?? response.data;
  } catch (error) {
    const detail = describeAxiosError(error);
    logger?.warn?.(
      `Grant signup credits failed [counsellorId=${counsellorId}, requestId=${
        requestId || 'n/a'
      }] — ${detail}`
    );
    return null;
  }
};
