const Media = require('../models/Media');
const { MediaUploader, localUpload } = require('../utils/mediaUploader');

// Upload media
exports.uploadMedia = async (req, res) => {
  try {
    // Media should already be uploaded to temp storage via multer middleware
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const userId = req.user.id;
    const { alt, type = 'image' } = req.body;

    // Upload and optimize the image
    const uploadResult = await MediaUploader.uploadWithOptimization(req.file, {
      contentType: req.file.mimetype,
      folder: `gossip/users/${userId}`
    });

    // Generate image variants
    const variants = await MediaUploader.generateVariants(
      uploadResult.url,
      uploadResult.publicId
    );

    // Save media record to database
    const media = await Media.create({
      userId,
      url: uploadResult.url,
      publicId: uploadResult.publicId,
      type,
      width: uploadResult.width,
      height: uploadResult.height,
      size: uploadResult.size,
      variants,
      alt: alt || null,
      metadata: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        encoding: req.file.encoding
      }
    });

    return res.status(201).json(media);
  } catch (error) {
    console.error('Error uploading media:', error);
    return res.status(500).json({ message: 'Error uploading media' });
  }
};

// Get user's media
exports.getUserMedia = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const result = await Media.findByUser(userId, limit, offset);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting user media:', error);
    return res.status(500).json({ message: 'Error retrieving media' });
  }
};

// Get media by ID
exports.getMediaById = async (req, res) => {
  try {
    const { mediaId } = req.params;

    const media = await Media.findById(mediaId);

    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }

    return res.status(200).json(media);
  } catch (error) {
    console.error('Error getting media:', error);
    return res.status(500).json({ message: 'Error retrieving media' });
  }
};

// Delete media
exports.deleteMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const userId = req.user.id;

    // Find the media to get the public ID
    const media = await Media.findById(mediaId);

    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }

    // Check ownership
    if (media.user_id !== userId) {
      return res.status(403).json({ message: 'You do not have permission to delete this media' });
    }

    // Soft delete in database
    await Media.delete(mediaId, userId);

    // Delete from Cloudinary (optional - you might want to keep files)
    try {
      await MediaUploader.deleteMedia(media.public_id);
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
      // Continue even if Cloudinary delete fails
    }

    return res.status(200).json({ message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Error deleting media:', error);

    if (error.message === 'Media not found or you do not have permission to delete it') {
      return res.status(403).json({ message: error.message });
    }

    return res.status(500).json({ message: 'Error deleting media' });
  }
};

// Associate media with a post
exports.attachMediaToPost = async (req, res) => {
  try {
    const { postId, mediaId } = req.params;
    const { position } = req.body;
    const userId = req.user.id;

    // Verify media ownership
    const media = await Media.findById(mediaId);
    if (!media || media.user_id !== userId) {
      return res.status(403).json({ message: 'Media not found or you do not have permission to use it' });
    }

    // Verify post ownership (this would be done in your Post model)
    // const post = await Post.findById(postId);
    // if (!post || post.user_id !== userId) {
    //   return res.status(403).json({ message: 'Post not found or you do not have permission to modify it' });
    // }

    // Associate media with post
    const association = await Media.associateWithPost(postId, mediaId, position || 0);

    return res.status(200).json(association);
  } catch (error) {
    console.error('Error attaching media to post:', error);
    return res.status(500).json({ message: 'Error attaching media to post' });
  }
};

// Remove media from a post
exports.removeMediaFromPost = async (req, res) => {
  try {
    const { postId, mediaId } = req.params;
    const userId = req.user.id;

    // Verify post ownership (this would be done in your Post model)
    // const post = await Post.findById(postId);
    // if (!post || post.user_id !== userId) {
    //   return res.status(403).json({ message: 'Post not found or you do not have permission to modify it' });
    // }

    // Remove association
    await Media.disassociateFromPost(postId, mediaId);

    return res.status(200).json({ message: 'Media removed from post successfully' });
  } catch (error) {
    console.error('Error removing media from post:', error);
    return res.status(500).json({ message: 'Error removing media from post' });
  }
};

// Get media for a post
exports.getPostMedia = async (req, res) => {
  try {
    const { postId } = req.params;

    const media = await Media.findByPost(postId);

    return res.status(200).json(media);
  } catch (error) {
    console.error('Error getting post media:', error);
    return res.status(500).json({ message: 'Error retrieving post media' });
  }
};

// Handle file uploads via multer
exports.uploadMiddleware = localUpload.single('media');