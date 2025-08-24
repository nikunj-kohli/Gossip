const db = require('../config/database');

class GroupMember {
    // Join a group
    static async join(groupId, userId) {
        try {
            // Check if group exists and is active
            const groupQuery = `
                SELECT privacy FROM groups WHERE id = $1 AND is_active = TRUE
            `;
            const groupResult = await db.query(groupQuery, [groupId]);
            
            if (groupResult.rows.length === 0) {
                return { success: false, message: 'Group not found or inactive' };
            }
            
            // Check if user is already a member
            const memberQuery = `
                SELECT id, is_banned FROM group_members
                WHERE group_id = $1 AND user_id = $2
            `;
            const memberResult = await db.query(memberQuery, [groupId, userId]);
            
            // If user is already a member
            if (memberResult.rows.length > 0) {
                // If banned, can't join
                if (memberResult.rows[0].is_banned) {
                    return { success: false, message: 'You are banned from this group' };
                }
                
                // Already a member
                return { success: false, message: 'You are already a member of this group' };
            }
            
            // Add as member
            const joinQuery = `
                INSERT INTO group_members (group_id, user_id, role)
                VALUES ($1, $2, 'member')
                RETURNING *
            `;
            
            const result = await db.query(joinQuery, [groupId, userId]);
            
            return {
                success: true,
                message: 'Successfully joined the group',
                membership: result.rows[0]
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Leave a group
    static async leave(groupId, userId) {
        try {
            // Check if user is a member
            const memberQuery = `
                SELECT id, role FROM group_members
                WHERE group_id = $1 AND user_id = $2 AND is_banned = FALSE
            `;
            const memberResult = await db.query(memberQuery, [groupId, userId]);
            
            // If user is not a member
            if (memberResult.rows.length === 0) {
                return { success: false, message: 'You are not a member of this group' };
            }
            
            // Check if user is the last admin
            if (memberResult.rows[0].role === 'admin') {
                // Count admins in the group
                const adminCountQuery = `
                    SELECT COUNT(*) FROM group_members
                    WHERE group_id = $1 AND role = 'admin' AND is_banned = FALSE
                `;
                const adminResult = await db.query(adminCountQuery, [groupId]);
                const adminCount = parseInt(adminResult.rows[0].count);
                
                if (adminCount === 1) {
                    return { 
                        success: false, 
                        message: 'You are the last admin. Please promote another member to admin before leaving' 
                    };
                }
            }
            
            // Leave the group
            const leaveQuery = `
                DELETE FROM group_members
                WHERE group_id = $1 AND user_id = $2
                RETURNING id
            `;
            
            await db.query(leaveQuery, [groupId, userId]);
            
            return {
                success: true,
                message: 'Successfully left the group'
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Get members of a group
    static async getMembers(groupId, { role = null, limit = 20, offset = 0, search = null }) {
        try {
            // Base query
            let query = `
                SELECT 
                    gm.id as membership_id,
                    gm.user_id,
                    gm.role,
                    gm.joined_at,
                    u.username,
                    u.display_name,
                    u.bio,
                    u.avatar_url
                FROM group_members gm
                JOIN users u ON gm.user_id = u.id
                WHERE gm.group_id = $1
                AND gm.is_banned = FALSE
            `;
            
            const params = [groupId];
            let paramCounter = 2;
            
            // Add role filter
            if (role) {
                const validRoles = ['admin', 'moderator', 'member'];
                if (validRoles.includes(role)) {
                    query += ` AND gm.role = $${paramCounter++}`;
                    params.push(role);
                }
            }
            
            // Add search filter
            if (search) {
                query += ` AND (u.username ILIKE $${paramCounter++} OR u.display_name ILIKE $${paramCounter++})`;
                params.push(`%${search}%`, `%${search}%`);
            }
            
            // Add order and pagination
            query += ` ORDER BY 
                CASE 
                    WHEN gm.role = 'admin' THEN 1
                    WHEN gm.role = 'moderator' THEN 2
                    ELSE 3
                END, 
                u.display_name ASC
                LIMIT $${paramCounter++} OFFSET $${paramCounter++}`;
            params.push(limit, offset);
            
            const result = await db.query(query, params);
            
            // Get count for pagination
            let countQuery = `
                SELECT COUNT(*) FROM group_members gm
                JOIN users u ON gm.user_id = u.id
                WHERE gm.group_id = $1
                AND gm.is_banned = FALSE
            `;
            
            const countParams = [groupId];
            let countParamCounter = 2;
            
            if (role) {
                const validRoles = ['admin', 'moderator', 'member'];
                if (validRoles.includes(role)) {
                    countQuery += ` AND gm.role = $${countParamCounter++}`;
                    countParams.push(role);
                }
            }
            
            if (search) {
                countQuery += ` AND (u.username ILIKE $${countParamCounter++} OR u.display_name ILIKE $${countParamCounter++})`;
                countParams.push(`%${search}%`, `%${search}%`);
            }
            
            const countResult = await db.query(countQuery, countParams);
            const totalCount = parseInt(countResult.rows[0].count);
            
            return {
                members: result.rows,
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
    
    // Change member role
    static async changeRole(groupId, userId, targetUserId, newRole) {
        try {
            // Validate role
            const validRoles = ['admin', 'moderator', 'member'];
            if (!validRoles.includes(newRole)) {
                return { success: false, message: 'Invalid role' };
            }
            
            // Check if user has permission (must be admin)
            const permissionQuery = `
                SELECT role FROM group_members
                WHERE group_id = $1 AND user_id = $2 AND is_banned = FALSE
            `;
            const permissionResult = await db.query(permissionQuery, [groupId, userId]);
            
            if (permissionResult.rows.length === 0) {
                return { success: false, message: 'You are not a member of this group' };
            }
            
            if (permissionResult.rows[0].role !== 'admin') {
                return { success: false, message: 'Only admins can change member roles' };
            }
            
            // Check if target user is a member
            const targetQuery = `
                SELECT id, role FROM group_members
                WHERE group_id = $1 AND user_id = $2 AND is_banned = FALSE
            `;
            const targetResult = await db.query(targetQuery, [groupId, targetUserId]);
            
            if (targetResult.rows.length === 0) {
                return { success: false, message: 'Target user is not a member of this group' };
            }
            
            // Check if trying to demote self as last admin
            if (parseInt(userId) === parseInt(targetUserId) && 
                permissionResult.rows[0].role === 'admin' && 
                newRole !== 'admin') {
                
                // Count admins
                const adminCountQuery = `
                    SELECT COUNT(*) FROM group_members
                    WHERE group_id = $1 AND role = 'admin' AND is_banned = FALSE
                `;
                const adminResult = await db.query(adminCountQuery, [groupId]);
                const adminCount = parseInt(adminResult.rows[0].count);
                
                if (adminCount === 1) {
                    return { 
                        success: false, 
                        message: 'You are the last admin. Please promote another member to admin first' 
                    };
                }
            }
            
            // Update role
            const updateQuery = `
                UPDATE group_members
                SET role = $1
                WHERE group_id = $2 AND user_id = $3
                RETURNING *
            `;
            
            const result = await db.query(updateQuery, [newRole, groupId, targetUserId]);
            
            return {
                success: true,
                message: `Member role updated to ${newRole}`,
                membership: result.rows[0]
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Remove member from group (by admin/moderator)
    static async removeMember(groupId, adminId, targetUserId) {
        try {
            // Check if admin has permission
            const adminQuery = `
                SELECT role FROM group_members
                WHERE group_id = $1 AND user_id = $2 AND is_banned = FALSE
            `;
            const adminResult = await db.query(adminQuery, [groupId, adminId]);
            
            if (adminResult.rows.length === 0) {
                return { success: false, message: 'You are not a member of this group' };
            }
            
            const adminRole = adminResult.rows[0].role;
            if (adminRole !== 'admin' && adminRole !== 'moderator') {
                return { success: false, message: 'You do not have permission to remove members' };
            }
            
            // Check if target is a member
            const targetQuery = `
                SELECT role FROM group_members
                WHERE group_id = $1 AND user_id = $2 AND is_banned = FALSE
            `;
            const targetResult = await db.query(targetQuery, [groupId, targetUserId]);
            
            if (targetResult.rows.length === 0) {
                return { success: false, message: 'Target user is not a member of this group' };
            }
            
            const targetRole = targetResult.rows[0].role;
            
            // Check permissions based on roles
            if (adminRole === 'moderator') {
                // Moderators can only remove regular members
                if (targetRole === 'admin' || targetRole === 'moderator') {
                    return { 
                        success: false, 
                        message: 'Moderators cannot remove admins or other moderators' 
                    };
                }
            } else if (adminRole === 'admin') {
                // Admins can't remove themselves as the last admin
                if (parseInt(adminId) === parseInt(targetUserId) && targetRole === 'admin') {
                    const adminCountQuery = `
                        SELECT COUNT(*) FROM group_members
                        WHERE group_id = $1 AND role = 'admin' AND is_banned = FALSE
                    `;
                    const adminCountResult = await db.query(adminCountQuery, [groupId]);
                    const adminCount = parseInt(adminCountResult.rows[0].count);
                    
                    if (adminCount === 1) {
                        return { 
                            success: false, 
                            message: 'You are the last admin and cannot remove yourself' 
                        };
                    }
                }
            }
            
            // Remove the member
            const removeQuery = `
                DELETE FROM group_members
                WHERE group_id = $1 AND user_id = $2
                RETURNING id
            `;
            
            await db.query(removeQuery, [groupId, targetUserId]);
            
            return {
                success: true,
                message: 'Member removed from group'
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Ban member from group
    static async banMember(groupId, adminId, targetUserId) {
        try {
            // Check if admin has permission
            const adminQuery = `
                SELECT role FROM group_members
                WHERE group_id = $1 AND user_id = $2 AND is_banned = FALSE
            `;
            const adminResult = await db.query(adminQuery, [groupId, adminId]);
            
            if (adminResult.rows.length === 0) {
                return { success: false, message: 'You are not a member of this group' };
            }
            
            const adminRole = adminResult.rows[0].role;
            if (adminRole !== 'admin' && adminRole !== 'moderator') {
                return { success: false, message: 'You do not have permission to ban members' };
            }
            
            // Check if target is a member
            const targetQuery = `
                SELECT role, is_banned FROM group_members
                WHERE group_id = $1 AND user_id = $2
            `;
            const targetResult = await db.query(targetQuery, [groupId, targetUserId]);
            
            if (targetResult.rows.length === 0) {
                // Create banned entry if user was not a member
                const insertQuery = `
                    INSERT INTO group_members (group_id, user_id, role, is_banned)
                    VALUES ($1, $2, 'member', TRUE)
                    RETURNING id
                `;
                
                await db.query(insertQuery, [groupId, targetUserId]);
                
                return {
                    success: true,
                    message: 'User has been banned from the group'
                };
            }
            
            // User exists, check permissions based on roles
            const targetRole = targetResult.rows[0].role;
            const isBanned = targetResult.rows[0].is_banned;
            
            // If already banned
            if (isBanned) {
                return { success: false, message: 'User is already banned from this group' };
            }
            
            if (adminRole === 'moderator') {
                // Moderators can only ban regular members
                if (targetRole === 'admin' || targetRole === 'moderator') {
                    return { 
                        success: false, 
                        message: 'Moderators cannot ban admins or other moderators' 
                    };
                }
            }
            
            // Cannot ban self
            if (parseInt(adminId) === parseInt(targetUserId)) {
                return { success: false, message: 'You cannot ban yourself' };
            }
            
            // Ban the member
            const banQuery = `
                UPDATE group_members
                SET is_banned = TRUE
                WHERE group_id = $1 AND user_id = $2
                RETURNING id
            `;
            
            await db.query(banQuery, [groupId, targetUserId]);
            
            return {
                success: true,
                message: 'Member banned from group'
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Unban member from group
    static async unbanMember(groupId, adminId, targetUserId) {
        try {
            // Check if admin has permission
            const adminQuery = `
                SELECT role FROM group_members
                WHERE group_id = $1 AND user_id = $2 AND is_banned = FALSE
            `;
            const adminResult = await db.query(adminQuery, [groupId, adminId]);
            
            if (adminResult.rows.length === 0) {
                return { success: false, message: 'You are not a member of this group' };
            }
            
            const adminRole = adminResult.rows[0].role;
            if (adminRole !== 'admin' && adminRole !== 'moderator') {
                return { success: false, message: 'You do not have permission to unban members' };
            }
            
            // Check if target is banned
            const targetQuery = `
                SELECT is_banned FROM group_members
                WHERE group_id = $1 AND user_id = $2
            `;
            const targetResult = await db.query(targetQuery, [groupId, targetUserId]);
            
            if (targetResult.rows.length === 0 || !targetResult.rows[0].is_banned) {
                return { success: false, message: 'User is not banned from this group' };
            }
            
            // Unban the member
            const unbanQuery = `
                UPDATE group_members
                SET is_banned = FALSE
                WHERE group_id = $1 AND user_id = $2
                RETURNING id
            `;
            
            await db.query(unbanQuery, [groupId, targetUserId]);
            
            return {
                success: true,
                message: 'Member unbanned from group'
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Get banned members
    static async getBannedMembers(groupId, adminId, { limit = 20, offset = 0 }) {
        try {
            // Check if admin has permission
            const adminQuery = `
                SELECT role FROM group_members
                WHERE group_id = $1 AND user_id = $2 AND is_banned = FALSE
            `;
            const adminResult = await db.query(adminQuery, [groupId, adminId]);
            
            if (adminResult.rows.length === 0) {
                return { success: false, message: 'You are not a member of this group' };
            }
            
            const adminRole = adminResult.rows[0].role;
            if (adminRole !== 'admin' && adminRole !== 'moderator') {
                return { success: false, message: 'You do not have permission to view banned members' };
            }
            
            // Get banned members
            const bannedQuery = `
                SELECT 
                    gm.id as membership_id,
                    gm.user_id,
                    gm.role,
                    gm.joined_at,
                    u.username,
                    u.display_name,
                    u.avatar_url
                FROM group_members gm
                JOIN users u ON gm.user_id = u.id
                WHERE gm.group_id = $1 AND gm.is_banned = TRUE
                ORDER BY u.display_name
                LIMIT $2 OFFSET $3
            `;
            
            const result = await db.query(bannedQuery, [groupId, limit, offset]);
            
            // Get count for pagination
            const countQuery = `
                SELECT COUNT(*) FROM group_members
                WHERE group_id = $1 AND is_banned = TRUE
            `;
            
            const countResult = await db.query(countQuery, [groupId]);
            const totalCount = parseInt(countResult.rows[0].count);
            
            return {
                success: true,
                bannedMembers: result.rows,
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
}

module.exports = GroupMember;