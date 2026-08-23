const axios = require('axios');
const { logger } = require('../config/logger');

const DEFAULT_BRAND = {
  code: 'bytrait',
  displayName: 'ByTrait',
  fromName: 'ByTrait',
  supportEmail: null,
  primaryColor: '#0f172a',
};

/**
 * Resolve email/UI brand from tenantSlug.
 * Calls the career gateway tenant API when TENANT_SERVICE_URL is set.
 */
async function resolveBrand(tenantSlug) {
  const slug = (tenantSlug || 'bytrait').toString().trim().toLowerCase() || 'bytrait';

  const base =
    process.env.TENANT_SERVICE_URL ||
    process.env.BILLING_SERVICE_URL?.replace(/\/api\/v1\/billing\/?$/, '') ||
    'http://127.0.0.1:4000';

  try {
    const url = `${base.replace(/\/$/, '')}/api/v1/tenant`;
    const res = await axios.get(url, {
      params: { slug },
      headers: { 'X-Tenant-Slug': slug },
      timeout: 4000,
    });

    const data = res.data || {};
    const customization = data.customization || {};
    const theme = data.theme || {};

    return {
      code: data.code || slug,
      displayName:
        customization.displayName || data.name || DEFAULT_BRAND.displayName,
      fromName:
        customization.emailFromName ||
        theme.fromName ||
        data.name ||
        DEFAULT_BRAND.fromName,
      supportEmail: customization.supportEmail || null,
      primaryColor: theme.primaryColor || DEFAULT_BRAND.primaryColor,
    };
  } catch (err) {
    logger.warn(
      `Tenant brand resolve failed for slug=${slug}: ${err.message}. Using defaults.`
    );

    if (slug === 'mappu') {
      return {
        code: 'mappu',
        displayName: 'Mapp My University',
        fromName: 'MapU',
        supportEmail: 'contact@mappmyuniversity.com',
        primaryColor: '#012A9E',
      };
    }

    return { ...DEFAULT_BRAND, code: slug };
  }
}

module.exports = {
  DEFAULT_BRAND,
  resolveBrand,
};
