const db = require('../config/database');

class Group {
    // Create new group
    static async create({ name, description, privacy, creatorId, avatarUrl = null, coverUrl = null }) {
        try {
            // Validate inputs
            if (!name || name.trim().length === 0) {
                throw new Error('Group name is required');
            }

            if (name.length > 100) {
                throw new Error('Group name is too long (max 100 characters)');
            }

            const validPrivacy = ['public', 'private'];
            if (!validPrivacy.includes(privacy)) {
                privacy = 'public'; // Default to public if invalid
            }

            // Create the group
            const query = `
                INSERT INTO groups (name, description, privacy, creator_id, avatar_url, cover_url)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;

            const values = [
                name.trim(),
                description ? description.trim() : null,
                privacy,
                creatorId,
                avatarUrl,
                coverUrl
            ];

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505' && error.constraint === 'groups_slug_key') {
                throw new Error('A group with a similar name already exists');
            }
            throw error;
        }
    }

    // Get all groups (with optional filters)
    static async getAll({
        search = null,
        privacy = null,
        limit = 20,
        offset = 0,
        userId = null,
        orderBy = 'created_at',
        sortOrder = 'desc'
    } = {}) {
        try {
            // Build base query
            let query = `
                SELECT 
                    g.*,
                    u.display_name as creator_name,
                    u.username as creator_username
            `;

            // Add membership status if userId is provided
            if (userId) {
                query += `,
                    (SELECT EXISTS(
                        SELECT 1 FROM group_members 
                        WHERE group_id = g.id AND user_id = $4 AND is_banned = FALSE
                    )) as is_member,
                    (SELECT role FROM group_members 
                        WHERE group_id = g.id AND user_id = $4 AND is_banned = FALSE
                    ) as user_role
                `;
            } else {
                query += `, false as is_member, null as user_role`;
            }

            query += `
                FROM groups g
                LEFT JOIN users u ON g.creator_id = u.id
                WHERE g.is_active = TRUE
            `;

            // Add search condition if provided
            if (search) {
                query += ` AND (g.name ILIKE $5 OR g.description ILIKE $5)`;
            }

            // Add privacy filter
            if (privacy) {
                if (privacy === 'public') {
                    query += ` AND g.privacy = 'public'`;
                } else if (privacy === 'private' && userId) {
                    // For private groups, only show if user is a member
                    query += ` AND (g.privacy = 'public' OR (g.privacy = 'private' AND EXISTS(
                        SELECT 1 FROM group_members 
                        WHERE group_id = g.id AND user_id = $4 AND is_banned = FALSE
                    )))`;
                } else {
                    // Default to public if invalid privacy or no userId
                    query += ` AND g.privacy = 'public'`;
                }
            } else if (!userId) {
                // Without userId, only show public groups
                query += ` AND g.privacy = 'public'`;
            } else {
                // With userId, show public and private groups user is a member of
                query += ` AND (g.privacy = 'public' OR (g.privacy = 'private' AND EXISTS(
                    SELECT 1 FROM group_members 
                    WHERE group_id = g.id AND user_id = $4 AND is_banned = FALSE
                )))`;
            }

            // Add order by clause
            const validOrderColumns = ['created_at', 'member_count', 'post_count', 'name'];
            const validSortOrders = ['asc', 'desc'];
            
            const orderByColumn = validOrderColumns.includes(orderBy) ? orderBy : 'created_at';
            const orderDirection = validSortOrders.includes(sortOrder.toLowerCase()) ? sortOrder : 'desc';
            
            query += ` ORDER BY g.${orderByColumn} ${orderDirection.toUpperCase()}`;

            // Add pagination
            query += ` LIMIT $1 OFFSET $2`;

            // Prepare params based on provided filters
            const params = [limit, offset];
            
            // Add count param
            const countQuery = `
                SELECT COUNT(*) 
                FROM groups g
                WHERE g.is_active = TRUE
            `;
            
            let countConditions = '';
            
            if (privacy === 'public') {
                countConditions += ` AND g.privacy = 'public'`;
            } else if (privacy === 'private' && userId) {
                countConditions += ` AND (g.privacy = 'public' OR (g.privacy = 'private' AND EXISTS(
                    SELECT 1 FROM group_members 
                    WHERE group_id = g.id AND user_id = $1 AND is_banned = FALSE
                )))`;
            } else if (!userId) {
                countConditions += ` AND g.privacy = 'public'`;
            } else {
                countConditions += ` AND (g.privacy = 'public' OR (g.privacy = 'private' AND EXISTS(
                    SELECT 1 FROM group_members 
                    WHERE group_id = g.id AND user_id = $1 AND is_banned = FALSE
                )))`;
            }
            
            if (search) {
                countConditions += ` AND (g.name ILIKE $2 OR g.description ILIKE $2)`;
            }
            
            // Add userId param if provided
            if (userId) {
                params.push(userId);
            }
            
            // Add search param if provided
            if (search) {
                params.push(`%${search}%`);
            }
            
            const countResult = await db.query(countQuery + countConditions, userId ? [userId, `%${search}%`] : [`%${search}%`]);
            const totalCount = parseInt(countResult.rows[0].count);

            // Execute the main query
            const result = await db.query(query, params);
            
            return {
                groups: result.rows,
                pagination: {
                    total: totalCount,
                    limit,
                    offset,
                    hasMore: offset + limit < totalCount
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Get group by ID or slug
    static async getByIdOrSlug(identifier, userId = null) {
        try {
            // Check if identifier is numeric (id) or string (slug)
            const isId = !isNaN(identifier);
            
            let query = `
                SELECT 
                    g.*,
                    u.display_name as creator_name,
                    u.username as creator_username
            `;
            
            // Add membership status if userId is provided
            if (userId) {
                query += `,
                    (SELECT EXISTS(
                        SELECT 1 FROM group_members 
                        WHERE group_id = g.id AND user_id = $2 AND is_banned = FALSE
                    )) as is_member,
                    (SELECT role FROM group_members 
                        WHERE group_id = g.id AND user_id = $2 AND is_banned = FALSE
                    ) as user_role
                `;
            } else {
                query += `, false as is_member, null as user_role`;
            }
            
            query += `
                FROM groups g
                LEFT JOIN users u ON g.creator_id = u.id
                WHERE g.is_active = TRUE AND
            `;
            
            // Add condition based on identifier type
            if (isId) {
                query += ` g.id = $1`;
            } else {
                query += ` g.slug = $1`;
            }
            
            // Execute with or without userId
            const params = userId ? [identifier, userId] : [identifier];
            const result = await db.query(query, params);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const group = result.rows[0];
            
            // If group is private and user is not a member (and not public), deny access
            if (group.privacy === 'private' && !group.is_member && !userId) {
                return { id: group.id, privacy: 'private', restricted: true };
            }
            
            return group;
        } catch (error) {
            throw error;
        }
    }

    // Get groups created by a user
    static async getByCreator(creatorId, { limit = 20, offset = 0, currentUserId = null } = {}) {
        try {
            let query = `
                SELECT 
                    g.*,
                    u.display_name as creator_name,
                    u.username as creator_username
            `;
            
            // Add membership status if currentUserId is provided
            if (currentUserId) {
                query += `,
                    (SELECT EXISTS(
                        SELECT 1 FROM group_members 
                        WHERE group_id = g.id AND user_id = $4 AND is_banned = FALSE
                    )) as is_member,
                    (SELECT role FROM group_members 
                        WHERE group_id = g.id AND user_id = $4 AND is_banned = FALSE
                    ) as user_role
                `;
            } else {
                query += `, false as is_member, null as user_role`;
            }
            
            query += `
                FROM groups g
                LEFT JOIN users u ON g.creator_id = u.id
                WHERE g.creator_id = $1 AND g.is_active = TRUE
            `;
            
            // Visibility logic: show all groups if viewing own profile,
            // otherwise only show public groups or private groups where viewer is a member
            if (currentUserId && parseInt(currentUserId) !== parseInt(creatorId)) {
                query += ` AND (g.privacy = 'public' OR EXISTS(
                    SELECT 1 FROM group_members 
                    WHERE group_id = g.id AND user_id = $4 AND is_banned = FALSE
                ))`;
            } else if (!currentUserId) {
                // If not logged in, only show public groups
                query += ` AND g.privacy = 'public'`;
            }
            
            query += ` ORDER BY g.created_at DESC LIMIT $2 OFFSET $3`;
            
            const params = currentUserId 
                ? [creatorId, limit, offset, currentUserId]
                : [creatorId, limit, offset];
                
            const result = await db.query(query, params);
            
            // Count total groups for pagination
            let countQuery = `
                SELECT COUNT(*) FROM groups g
                WHERE g.creator_id = $1 AND g.is_active = TRUE
            `;
            
            if (currentUserId && parseInt(currentUserId) !== parseInt(creatorId)) {
                countQuery += ` AND (g.privacy = 'public' OR EXISTS(
                    SELECT 1 FROM group_members 
                    WHERE group_id = g.id AND user_id = $2 AND is_banned = FALSE
                ))`;
            } else if (!currentUserId) {
                countQuery += ` AND g.privacy = 'public'`;
            }
            
            const countParams = currentUserId && parseInt(currentUserId) !== parseInt(creatorId)
                ? [creatorId, currentUserId]
                : [creatorId];
                
            const countResult = await db.query(countQuery, countParams);
            const totalCount = parseInt(countResult.rows[0].count);
            
            return {
                groups: result.rows,
                pagination: {
                    total: totalCount,
                    limit,
                    offset,
                    hasMore: offset + limit < totalCount
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Get groups a user is a member of
    static async getByMember(memberId, { limit = 20, offset = 0, currentUserId = null } = {}) {
        try {
            let query = `
                SELECT 
                    g.*,
                    u.display_name as creator_name,
                    u.username as creator_username,
                    gm.role as user_role,
                    TRUE as is_member
            `;
            
            if (currentUserId && parseInt(currentUserId) !== parseInt(memberId)) {
                query += `,
                    (SELECT EXISTS(
                        SELECT 1 FROM group_members 
                        WHERE group_id = g.id AND user_id = $4 AND is_banned = FALSE
                    )) as is_viewer_member
                `;
            } else {
                query += `, FALSE as is_viewer_member`;
            }
            
            query += `
                FROM group_members gm
                JOIN groups g ON gm.group_id = g.id
                LEFT JOIN users u ON g.creator_id = u.id
                WHERE gm.user_id = $1 
                AND gm.is_banned = FALSE
                AND g.is_active = TRUE
            `;
            
            // Visibility logic: show all memberships if viewing own profile,
            // otherwise only show public groups or private groups where viewer is also a member
            if (currentUserId && parseInt(currentUserId) !== parseInt(memberId)) {
                query += ` AND (g.privacy = 'public' OR EXISTS(
                    SELECT 1 FROM group_members 
                    WHERE group_id = g.id AND user_id = $4 AND is_banned = FALSE
                ))`;
            } else if (!currentUserId) {
                // If not logged in, only show public groups
                query += ` AND g.privacy = 'public'`;
            }
            
            query += ` ORDER BY g.name ASC LIMIT $2 OFFSET $3`;
            
            const params = currentUserId && parseInt(currentUserId) !== parseInt(memberId)
                ? [memberId, limit, offset, currentUserId]
                : [memberId, limit, offset];
                
            const result = await db.query(query, params);
            
            // Count total memberships for pagination
            let countQuery = `
                SELECT COUNT(*) FROM group_members gm
                JOIN groups g ON gm.group_id = g.id
                WHERE gm.user_id = $1 
                AND gm.is_banned = FALSE
                AND g.is_active = TRUE
            `;
            
            if (currentUserId && parseInt(currentUserId) !== parseInt(memberId)) {
                countQuery += ` AND (g.privacy = 'public' OR EXISTS(
                    SELECT 1 FROM group_members 
                    WHERE group_id = g.id AND user_id = $2 AND is_banned = FALSE
                ))`;
            } else if (!currentUserId) {
                countQuery += ` AND g.privacy = 'public'`;
            }
            
            const countParams = currentUserId && parseInt(currentUserId) !== parseInt(memberId)
                ? [memberId, currentUserId]
                : [memberId];
                
            const countResult = await db.query(countQuery, countParams);
            const totalCount = parseInt(countResult.rows[0].count);
            
            return {
                groups: result.rows,
                pagination: {
                    total: totalCount,
                    limit,
                    offset,
                    hasMore: offset + limit < totalCount
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Update group
    static async update(groupId, userId, { name, description, privacy, avatarUrl, coverUrl }) {
        try {
            // Check if user has permission (must be admin)
            const permissionCheck = await db.query(`
                SELECT EXISTS(
                    SELECT 1 FROM group_members
                    WHERE group_id = $1 AND user_id = $2 AND role = 'admin' AND is_banned = FALSE
                ) as has_permission
            `, [groupId, userId]);
            
            if (!permissionCheck.rows[0].has_permission) {
                throw new Error('Unauthorized to update this group');
            }
            
            // Validate inputs
            const updates = [];
            const values = [groupId];
            let paramCounter = 2;
            
            if (name !== undefined) {
                if (!name || name.trim().length === 0) {
                    throw new Error('Group name cannot be empty');
                }
                
                if (name.length > 100) {
                    throw new Error('Group name is too long (max 100 characters)');
                }
                
                updates.push(`name = $${paramCounter++}`);
                values.push(name.trim());
                
                // Slug is auto-generated from name, but we need to generate it manually for updates
                const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
                
                // Check if slug would conflict, and if so, add a number
                let finalSlug = baseSlug;
                let counter = 1;
                let slugExists = true;
                
                while (slugExists) {
                    const slugCheck = await db.query(`
                        SELECT EXISTS(
                            SELECT 1 FROM groups WHERE slug = $1 AND id != $2
                        ) as exists
                    `, [finalSlug, groupId]);
                    
                    slugExists = slugCheck.rows[0].exists;
                    
                    if (slugExists) {
                        finalSlug = `${baseSlug}-${counter++}`;
                    }
                }
                
                updates.push(`slug = $${paramCounter++}`);
                values.push(finalSlug);
            }
            
            if (description !== undefined) {
                updates.push(`description = $${paramCounter++}`);
                values.push(description ? description.trim() : null);
            }
            
            if (privacy !== undefined) {
                const validPrivacy = ['public', 'private'];
                if (!validPrivacy.includes(privacy)) {
                    throw new Error('Invalid privacy setting');
                }
                
                updates.push(`privacy = $${paramCounter++}`);
                values.push(privacy);
            }
            
            if (avatarUrl !== undefined) {
                updates.push(`avatar_url = $${paramCounter++}`);
                values.push(avatarUrl);
            }
            
            if (coverUrl !== undefined) {
                updates.push(`cover_url = $${paramCounter++}`);
                values.push(coverUrl);
            }
            
            // If no updates, return the group as-is
            if (updates.length === 0) {
                return await this.getByIdOrSlug(groupId, userId);
            }
            
            // Perform the update
            const query = `
                UPDATE groups
                SET ${updates.join(', ')}
                WHERE id = $1 AND is_active = TRUE
                RETURNING *
            `;
            
            const result = await db.query(query, values);
            
            if (result.rows.length === 0) {
                throw new Error('Group not found or already deleted');
            }
            
            return result.rows[0];
        } catch (error) {
            // Handle duplicate slug error
            if (error.code === '23505' && error.constraint === 'groups_slug_key') {
                throw new Error('A group with a similar name already exists');
            }
            throw error;
        }
    }

    // Delete group (soft delete)
    static async delete(groupId, userId) {
        try {
            // Check if user has permission (must be admin)
            const permissionCheck = await db.query(`
                SELECT EXISTS(
                    SELECT 1 FROM group_members
                    WHERE group_id = $1 AND user_id = $2 AND role = 'admin' AND is_banned = FALSE
                ) as has_permission
            `, [groupId, userId]);
            
            if (!permissionCheck.rows[0].has_permission) {
                return { success: false, message: 'Unauthorized to delete this group' };
            }
            
            // Soft delete
            const query = `
                UPDATE groups
                SET is_active = FALSE
                WHERE id = $1
                RETURNING id
            `;
            
            const result = await db.query(query, [groupId]);
            
            if (result.rows.length === 0) {
                return { success: false, message: 'Group not found or already deleted' };
            }
            
            return { success: true, message: 'Group deleted successfully' };
        } catch (error) {
            throw error;
        }
    }

    // Check if user can post in group
    static async canUserPost(groupId, userId) {
        try {
            // First check if group exists and is active
            const groupQuery = `
                SELECT privacy FROM groups WHERE id = $1 AND is_active = TRUE
            `;
            const groupResult = await db.query(groupQuery, [groupId]);
            
            if (groupResult.rows.length === 0) {
                return { canPost: false, message: 'Group not found or inactive' };
            }
            
            // Check if user is a member and not banned
            const memberQuery = `
                SELECT role, is_banned FROM group_members
                WHERE group_id = $1 AND user_id = $2
            `;
            const memberResult = await db.query(memberQuery, [groupId, userId]);
            
            // If user is not a member
            if (memberResult.rows.length === 0) {
                return { canPost: false, message: 'You must join this group to post' };
            }
            
            // If user is banned
            if (memberResult.rows[0].is_banned) {
                return { canPost: false, message: 'You are banned from this group' };
            }
            
            // User can post
            return { 
                canPost: true, 
                role: memberResult.rows[0].role
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Group;