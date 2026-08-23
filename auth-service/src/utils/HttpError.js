// auth-service/src/utils/HttpError.js
//
// A lightweight Error subclass that carries an HTTP status code (and an
// optional machine-readable error code / details payload). The global
// error-handling middleware in app.js maps these to JSON responses so the
// frontend always gets a consistent shape:
//
//   { success: false, message, code?, details? }
//
// Service-layer code should throw `HttpError` for any error that has a
// well-known mapping to an HTTP status (validation 400, auth 401, ownership
// 403, not-found 404, conflict 409). Anything else falls through as a 500.

class HttpError extends Error {
  /**
   * @param {number} status   HTTP status code (e.g. 400, 404, 409)
   * @param {string} message  Human-readable, FE-displayable message
   * @param {object} [opts]
   * @param {string} [opts.code]    Machine-readable error code (e.g. 'CODE_IN_USE')
   * @param {*}      [opts.details] Extra debug payload (validation errors, etc.)
   */
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (code) this.code = code;
    if (details !== undefined) this.details = details;
  }
}

const badRequest = (message, opts) => new HttpError(400, message, opts);
const unauthorized = (message = 'Unauthorized', opts) =>
  new HttpError(401, message, opts);
const forbidden = (message = 'Forbidden', opts) =>
  new HttpError(403, message, opts);
const notFound = (message = 'Not found', opts) =>
  new HttpError(404, message, opts);
const conflict = (message, opts) => new HttpError(409, message, opts);

module.exports = {
  HttpError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
};
