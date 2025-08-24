const db = require('../config/database');

class Media {
  // Create new media record
  static async create({
    userId,
    url,
    publicId,
    type,
    width,
    height,
    size,
    variants = null,
    alt = null,
    metadata = {}
  }) {
    try {
      const query = `
        INSERT INTO media (
          user_id, url, public_id, type, width, height, 
          size, variants, alt, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const values = [
        userId,
        url,
        publicId,
        type,
        width,
        height,
        size,
        variants ? JSON.stringify(variants) : null,
        alt,
        JSON.stringify(metadata)
      ];

      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get media by ID
  static async findById(id) {
    try {
      const query = `
        SELECT * FROM media WHERE id = $1 AND is_deleted = false
      `;
      
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get all media for a user
  static async findByUser(userId, limit = 20, offset = 0) {
    try {
      const query = `
        SELECT * FROM media 
        WHERE user_id = $1 AND is_deleted = false
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const result = await db.query(query, [userId, limit, offset]);
      
      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) FROM media 
        WHERE user_id = $1 AND is_deleted = false
      `;
      
      const countResult = await db.query(countQuery, [userId]);
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        media: result.rows.map(media => ({
          ...media,
          variants: typeof media.variants === 'string' ? JSON.parse(media.variants) : media.variants,
          metadata: typeof media.metadata === 'string' ? JSON.parse(media.metadata) : media.metadata
        })),
        pagination: {
          total: totalCount,
          limit,
          offset
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Mark media as deleted (soft delete)
  static async delete(id, userId) {
    try {
      // Verify ownership if userId is provided
      if (userId) {
        const checkQuery = `
          SELECT * FROM media WHERE id = $1 AND user_id = $2
        `;
        
        const checkResult = await db.query(checkQuery, [id, userId]);
        
        if (checkResult.rows.length === 0) {
          throw new Error('Media not found or you do not have permission to delete it');
        }
      }
      
      const query = `
        UPDATE media 
        SET is_deleted = true, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await db.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get media associated with a post
  static async findByPost(postId) {
    try {
      const query = `
        SELECT m.* FROM media m
        JOIN post_media pm ON m.id = pm.media_id
        WHERE pm.post_id = $1 AND m.is_deleted = false
        ORDER BY pm.position ASC
      `;
      
      const result = await db.query(query, [postId]);
      
      return result.rows.map(media => ({
        ...media,
        variants: typeof media.variants === 'string' ? JSON.parse(media.variants) : media.variants,
        metadata: typeof media.metadata === 'string' ? JSON.parse(media.metadata) : media.metadata
      }));
    } catch (error) {
      throw error;
    }
  }

  // Associate media with a post
  static async associateWithPost(postId, mediaId, position = 0) {
    try {
      const query = `
        INSERT INTO post_media (post_id, media_id, position)
        VALUES ($1, $2, $3)
        ON CONFLICT (post_id, media_id) DO UPDATE
        SET position = $3
        RETURNING *
      `;
      
      const result = await db.query(query, [postId, mediaId, position]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Disassociate media from a post
  static async disassociateFromPost(postId, mediaId) {
    try {
      const query = `
        DELETE FROM post_media
        WHERE post_id = $1 AND media_id = $2
        RETURNING *
      `;
      
      const result = await db.query(query, [postId, mediaId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Media;