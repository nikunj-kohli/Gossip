const buildUnsplashSourceUrl = (query) => {
  const safeQuery = encodeURIComponent(query || 'community discussion abstract');
  return `https://source.unsplash.com/1600x900/?${safeQuery}`;
};

const buildPicsumFallbackUrl = (seed) => {
  const safeSeed = encodeURIComponent(seed || 'gossip-community');
  return `https://picsum.photos/seed/${safeSeed}/1600/900`;
};

const normalizeTopic = (name, description = '') => {
  const raw = `${name || ''} ${description || ''}`.toLowerCase();

  if (/(design|art|ux|ui|typography|creative)/.test(raw)) return 'design studio workspace';
  if (/(tech|ai|startup|code|software|developer)/.test(raw)) return 'technology innovation';
  if (/(fitness|health|gym|sports|running)/.test(raw)) return 'fitness lifestyle';
  if (/(music|movie|cinema|film|series)/.test(raw)) return 'cinema music culture';
  if (/(travel|adventure|mountain|beach)/.test(raw)) return 'travel landscape';
  if (/(food|cooking|recipe|coffee)/.test(raw)) return 'food photography';
  if (/(finance|money|business|invest)/.test(raw)) return 'business finance';

  return `${name || 'community'} abstract`;
};

const getDefaultGroupCoverUrl = ({ name, description }) => {
  const topic = normalizeTopic(name, description);
  return buildUnsplashSourceUrl(topic);
};

const getFallbackGroupCoverUrl = ({ name }) => buildPicsumFallbackUrl(name || 'gossip-community');

module.exports = {
  getDefaultGroupCoverUrl,
  getFallbackGroupCoverUrl,
};
