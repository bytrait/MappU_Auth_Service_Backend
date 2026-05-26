// utils/cookie.utils.js

function getCookieDomain(hostname) {
  if (!hostname) {
    return undefined;
  }

  // Remove port
  const cleanHost = hostname.split(':')[0];

  // localhost / 127.0.0.1
  if (
    cleanHost.includes('localhost') ||
    cleanHost.includes('127.0.0.1')
  ) {
    return undefined;
  }

  // Local multi-tenant
  // auth.bytrait.local
  // => .bytrait.local
  if (cleanHost.endsWith('.local')) {
    const parts = cleanHost.split('.');

    if (parts.length >= 3) {
      return `.${parts.slice(-2).join('.')}`;
    }

    return '.local';
  }

  // Production
  // auth.bytrait.com
  // => .bytrait.com
  const parts = cleanHost.split('.');

  if (parts.length >= 2) {
    return `.${parts.slice(-2).join('.')}`;
  }

  return undefined;
}

// utils/cookie.utils.js

function buildCookieOptions(req) {
  const hostname = req.hostname;

  const isProd = process.env.NODE_ENV === 'prod';

  return {
    httpOnly: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,

    secure: isProd,

    sameSite: isProd ? 'None' : 'Lax',

    domain: getCookieDomain(hostname)
  };
}

module.exports = {
  getCookieDomain,
  buildCookieOptions
};