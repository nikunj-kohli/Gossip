const MEDIA_URL_REGEX = /https?:\/\/[^\s]+/gi;
const IMAGE_REGEX = /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i;
const VIDEO_REGEX = /\.(mp4|mov|webm|mkv|avi)(\?.*)?$/i;

export const normalizeMediaContent = (content = '') => {
  const urls = String(content).match(MEDIA_URL_REGEX) || [];
  const images = urls.filter((url) => IMAGE_REGEX.test(url) || /\/image\/upload\//i.test(url));
  const videos = urls.filter((url) => VIDEO_REGEX.test(url) || /\/video\/upload\//i.test(url));
  const mediaUrls = new Set([...images, ...videos]);

  const text = String(content)
    .replace(MEDIA_URL_REGEX, (url) => (mediaUrls.has(url) ? '' : url))
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, images, videos };
};

export const getMessagePreviewLabel = (message = {}) => {
  const content = String(message.content || '').trim();
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];

  if (content === '[Message deleted]') {
    return 'Message deleted';
  }

  const attachmentUrls = attachments.map((attachment) => attachment?.url || attachment?.secure_url || attachment?.path || '').filter(Boolean);
  const media = normalizeMediaContent(content);
  const hasMedia = media.images.length > 0 || media.videos.length > 0 || attachmentUrls.length > 0 || String(message.messageType || message.message_type || '').toLowerCase() === 'media';

  if (hasMedia) {
    const allUrls = [...media.images, ...media.videos, ...attachmentUrls];
    const hasImage = allUrls.some((url) => IMAGE_REGEX.test(url) || /\/image\/upload\//i.test(url));
    const hasVideo = allUrls.some((url) => VIDEO_REGEX.test(url) || /\/video\/upload\//i.test(url));

    if (hasImage && !hasVideo) return 'Sent an image';
    if (hasVideo && !hasImage) return 'Sent a video';
    if (hasImage || hasVideo) return 'Sent media';
    return 'Sent an attachment';
  }

  return media.text || content || 'No messages yet';
};