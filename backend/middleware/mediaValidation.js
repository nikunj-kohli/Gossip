const path = require('path');

// Media validation middleware
const validateMediaUpload = (req, res, next) => {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        message: 'Invalid file type. Only JPG, PNG, GIF and WebP images are allowed' 
      });
    }

    // Check file extension
    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ 
        message: 'Invalid file extension. Only JPG, PNG, GIF and WebP images are allowed' 
      });
    }

    // File passed validation
    next();
  } catch (error) {
    console.error('Error in media validation middleware:', error);
    return res.status(500).json({ message: 'Error validating media' });
  }
};

module.exports = {
  validateMediaUpload
};