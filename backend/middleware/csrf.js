/**
 * CSRF protection status for the Gossip API.
 *
 * REMOVED (2026-09-28): the previous implementation used the archived,
 * unmaintained `csurf` package. On review it provided no real protection for
 * this application:
 *
 *  1. The frontend authenticates exclusively with an `Authorization: Bearer`
 *     token stored in localStorage (see client/src/services/api.js). Browsers
 *     do NOT attach Bearer tokens cross-site automatically, so the classic
 *     CSRF attack (cookies auto-sent by the browser) cannot forge
 *     authenticated requests here.
 *  2. `csurf` only ran on non-`/api` routes (see `shouldProtectRoute`), and
 *     the backend serves no user-facing forms outside `/api`.
 *  3. The package has been officially deprecated/archived by the Express
 *     team (https://github.com/expressjs/csurf - "no longer maintained").
 *
 * If the app ever moves to cookie-based sessions, reintroduce CSRF defense
 * (e.g. double-submit token or SameSite=strict cookies) at that time.
 *
 * This stub keeps the module surface (`selectiveCsrf`, `handleCsrfError`)
 * so existing requires in server.js keep working unchanged.
 */

const noopMiddleware = (req, res, next) => next();

const selectiveCsrf = noopMiddleware;
const handleCsrfError = noopMiddleware;

const provideCsrfToken = (req, res, next) => {
  res.locals.csrfToken = '';
  next();
};

const csrfProtection = noopMiddleware;

module.exports = {
  selectiveCsrf,
  handleCsrfError,
  provideCsrfToken,
  csrfProtection
};
