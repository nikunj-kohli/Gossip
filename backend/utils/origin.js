/**
 * Normalizes an origin string by removing trailing slashes and ensuring a consistent format.
 */
const normalizeOrigin = (value) => {
  if (!value) return value;
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (error) {
    return value.replace(/\/+$/, '');
  }
};

/**
 * Checks if a given origin matches a rule (which can be a literal or a wildcard).
 */
const originMatchesRule = (origin, rule) => {
  if (!origin || !rule) return false;

  const normalizedOrigin = normalizeOrigin(origin);
  const normalizedRule = normalizeOrigin(rule);

  if (normalizedOrigin === normalizedRule) {
    return true;
  }

  // Wildcard subdomain support: https://*.example.pages.dev
  // This matches both the base domain and any subdomain
  const wildcardMatch = normalizedRule.match(/^(https?:\/\/)\*\.(.+)$/i);
  if (!wildcardMatch) {
    return false;
  }

  const [, protocol, baseHost] = wildcardMatch;

  try {
    const parsedOrigin = new URL(normalizedOrigin);
    // Check protocol match
    if (`${parsedOrigin.protocol}//` !== protocol) {
      return false;
    }

    // Check if it's the base host or a subdomain of the base host
    return parsedOrigin.hostname === baseHost || parsedOrigin.hostname.endsWith(`.${baseHost}`);
  } catch (error) {
    return false;
  }
};

module.exports = {
  normalizeOrigin,
  originMatchesRule
};
