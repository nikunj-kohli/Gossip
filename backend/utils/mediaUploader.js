const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure local storage for temporary files
const tempDir = path.join(__dirname, '../uploads/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'gossip',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ quality: 'auto' }],
    public_id: (req, file) => `${Date.now()}-${uuidv4()}`
  }
});

// Configure multer for direct uploads to Cloudinary
const directUpload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Configure multer for local temporary storage
const localTempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const localUpload = multer({
  storage: localTempStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

class MediaUploader {
  // Upload media with optimization
  static async uploadWithOptimization(file, options = {}) {
    try {
      // Default options
      const defaultOptions = {
        width: 1200,       // Default max width
        quality: 80,       // Default quality (0-100)
        contentType: null, // Auto-detect
        folder: 'gossip'   // Default folder
      };

      const opts = { ...defaultOptions, ...options };

      // Read the file
      const fileBuffer = fs.readFileSync(file.path);
      
      // Optimize the image
      let optimizedBuffer;
      
      // Use different optimization based on image type
      if (file.mimetype === 'image/gif') {
        // GIFs should be uploaded as-is to preserve animation
        optimizedBuffer = fileBuffer;
      } else {
        // Process other images with sharp
        let sharpInstance = sharp(fileBuffer);
        
        // Resize if width is provided
        if (opts.width) {
          sharpInstance = sharpInstance.resize({
            width: opts.width,
            fit: 'inside',
            withoutEnlargement: true
          });
        }
        
        // Convert based on content type or keep original format
        if (opts.contentType === 'image/webp') {
          optimizedBuffer = await sharpInstance.webp({ quality: opts.quality }).toBuffer();
        } else if (opts.contentType === 'image/jpeg' || opts.contentType === 'image/jpg') {
          optimizedBuffer = await sharpInstance.jpeg({ quality: opts.quality }).toBuffer();
        } else if (opts.contentType === 'image/png') {
          optimizedBuffer = await sharpInstance.png({ quality: opts.quality }).toBuffer();
        } else {
          // Auto format based on original
          optimizedBuffer = await sharpInstance.toBuffer();
        }
      }

      // Upload to Cloudinary
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: opts.folder,
            resource_type: 'auto'
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        uploadStream.end(optimizedBuffer);
      });

      // Delete temporary file
      fs.unlinkSync(file.path);

      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes
      };
    } catch (error) {
      // Make sure we clean up temp file if there's an error
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  // Delete media from Cloudinary
  static async deleteMedia(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === 'ok';
    } catch (error) {
      console.error('Error deleting media from Cloudinary:', error);
      throw error;
    }
  }

  // Generate image variants (e.g., thumbnails)
  static async generateVariants(url, publicId) {
    try {
      const variants = {
        original: url,
        thumbnail: cloudinary.url(publicId, {
          width: 200,
          height: 200,
          crop: 'fill',
          quality: 'auto'
        }),
        medium: cloudinary.url(publicId, {
          width: 600,
          height: 600,
          crop: 'limit',
          quality: 'auto'
        })
      };
      
      return variants;
    } catch (error) {
      console.error('Error generating image variants:', error);
      throw error;
    }
  }
}

module.exports = {
  cloudinary,
  directUpload,
  localUpload,
  MediaUploader
};