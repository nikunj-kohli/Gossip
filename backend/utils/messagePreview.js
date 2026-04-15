const MEDIA_URL_REGEX = /https?:\/\/[^\s]+/gi;
const IMAGE_REGEX = /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i;
const VIDEO_REGEX = /\.(mp4|mov|webm|mkv|avi)(\?.*)?$/i;

function normalizeAttachments(rawAttachments) {
    if (!rawAttachments) return [];

    if (Array.isArray(rawAttachments)) {
        return rawAttachments;
    }

    if (typeof rawAttachments === 'string') {
        try {
            const parsed = JSON.parse(rawAttachments);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    if (rawAttachments && typeof rawAttachments === 'object') {
        return [rawAttachments];
    }

    return [];
}

function isImageUrl(url = '') {
    return IMAGE_REGEX.test(url) || /\/image\/upload\//i.test(url);
}

function isVideoUrl(url = '') {
    return VIDEO_REGEX.test(url) || /\/video\/upload\//i.test(url);
}

function getMessagePreviewLabel(message = {}) {
    const content = String(message.content || '').trim();

    if (!content) {
        if (normalizeAttachments(message.attachments).length > 0 || String(message.message_type || message.messageType || '').toLowerCase() === 'media') {
            return 'Sent an attachment';
        }

        return 'No messages yet';
    }

    if (content === '[Message deleted]') {
        return 'Message deleted';
    }

    const attachments = normalizeAttachments(message.attachments);
    const urls = content.match(MEDIA_URL_REGEX) || [];
    const mediaUrls = urls.filter((url) => isImageUrl(url) || isVideoUrl(url));
    const attachmentUrls = attachments.map((attachment) => attachment?.url || attachment?.secure_url || attachment?.path || '').filter(Boolean);
    const hasMedia = mediaUrls.length > 0 || attachmentUrls.length > 0 || String(message.message_type || message.messageType || '').toLowerCase() === 'media';

    if (hasMedia) {
        const allUrls = [...mediaUrls, ...attachmentUrls];
        const hasImage = allUrls.some((url) => isImageUrl(url));
        const hasVideo = allUrls.some((url) => isVideoUrl(url));

        if (hasImage && !hasVideo) return 'Sent an image';
        if (hasVideo && !hasImage) return 'Sent a video';
        if (hasImage || hasVideo) return 'Sent media';
        return 'Sent an attachment';
    }

    return content;
}

module.exports = {
    getMessagePreviewLabel,
    normalizeAttachments,
};