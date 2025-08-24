const GroupMember = require('../models/GroupMember');
const Group = require('../models/Group');

// Join group
const joinGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;
        
        const result = await GroupMember.join(groupId, userId);
        
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }
        
        res.json({
            message: result.message,
            membership: result.member
        });
    } catch (error) {
        console.error('Error joining group:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Leave group
const leaveGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;
        
        const result = await GroupMember.leave(groupId, userId);
        
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }
        
        res.json({ message: result.message });
    } catch (error) {
        console.error('Error leaving group:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get members of a group
const getGroupMembers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { role, limit, offset } = req.query;
        const userId = req.user ? req.user.id : null;
        
        // Check access
        const accessResult = await Group.checkAccess(groupId, userId);
        
        if (!accessResult.access) {
            return res.status(403).json({ message: accessResult.message });
        }
        
        const result = await GroupMember.getMembers(groupId, {
            role,
            limit: parseInt(limit) || 20,
            offset: parseInt(offset) || 0
        });
        
        res.json(result);
    } catch (error) {
        console.error('Error fetching group members:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Change member role
const changeMemberRole = async (req, res) => {
    try {
        const { groupId, userId } = req.params;
        const { role } = req.body;
        const currentUserId = req.user.id;
        
        // Check if current user has permission (must be admin)
        const currentUserRole = await GroupMember.getUserRole(groupId, currentUserId);
        
        if (currentUserRole.role !== 'admin') {
            return res.status(403).json({ 
                message: 'Only group admins can change member roles' 
            });
        }
        
        // Prevent changing own role from admin
        if (userId === currentUserId.toString() && role !== 'admin') {
            return res.status(400).json({ 
                message: 'You cannot demote yourself from admin. Transfer admin to another user first.' 
            });
        }
        
        const result = await GroupMember.changeRole(groupId, userId, role);
        
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }
        
        res.json({
            message: result.message,
            membership: result.member
        });
    } catch (error) {
        console.error('Error changing member role:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Remove member
const removeMember = async (req, res) => {
    try {
        const { groupId, userId } = req.params;
        const currentUserId = req.user.id;
        
        // Check if current user has permission (must be admin or moderator)
        const currentUserRole = await GroupMember.getUserRole(groupId, currentUserId);
        
        if (!['admin', 'moderator'].includes(currentUserRole.role)) {
            return res.status(403).json({ 
                message: 'Only group admins and moderators can remove members' 
            });
        }
        
        // Get target member's role
        const targetRole = await GroupMember.getUserRole(groupId, userId);
        
        // Moderators cannot remove admins or other moderators
        if (currentUserRole.role === 'moderator' && ['admin', 'moderator'].includes(targetRole.role)) {
            return res.status(403).json({ 
                message: 'Moderators cannot remove admins or other moderators' 
            });
        }
        
        // Cannot remove yourself this way (use leave group)
        if (userId === currentUserId.toString()) {
            return res.status(400).json({ 
                message: 'To leave the group, use the leave group endpoint' 
            });
        }
        
        const result = await GroupMember.removeMember(groupId, userId);
        
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }
        
        res.json({ message: result.message });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Ban member
const banMember = async (req, res) => {
    try {
        const { groupId, userId } = req.params;
        const currentUserId = req.user.id;
        
        // Check if current user has permission (must be admin or moderator)
        const currentUserRole = await GroupMember.getUserRole(groupId, currentUserId);
        
        if (!['admin', 'moderator'].includes(currentUserRole.role)) {
            return res.status(403).json({ 
                message: 'Only group admins and moderators can ban members' 
            });
        }
        
        // Get target member's role
        const targetRole = await GroupMember.getUserRole(groupId, userId);
        
        // Moderators cannot ban admins or other moderators
        if (currentUserRole.role === 'moderator' && ['admin', 'moderator'].includes(targetRole.role)) {
            return res.status(403).json({ 
                message: 'Moderators cannot ban admins or other moderators' 
            });
        }
        
        // Cannot ban yourself
        if (userId === currentUserId.toString()) {
            return res.status(400).json({ 
                message: 'You cannot ban yourself from the group' 
            });
        }
        
        const result = await GroupMember.banMember(groupId, userId);
        
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }
        
        res.json({
            message: result.message,
            membership: result.member
        });
    } catch (error) {
        console.error('Error banning member:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Unban member
const unbanMember = async (req, res) => {
    try {
        const { groupId, userId } = req.params;
        const currentUserId = req.user.id;
        
        // Check if current user has permission (must be admin or moderator)
        const currentUserRole = await GroupMember.getUserRole(groupId, currentUserId);
        
        if (!['admin', 'moderator'].includes(currentUserRole.role)) {
            return res.status(403).json({ 
                message: 'Only group admins and moderators can unban members' 
            });
        }
        
        const result = await GroupMember.unbanMember(groupId, userId);
        
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }
        
        res.json({
            message: result.message,
            membership: result.member
        });
    } catch (error) {
        console.error('Error unbanning member:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get banned members
const getBannedMembers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { limit, offset } = req.query;
        const currentUserId = req.user.id;
        
        // Check if current user has permission (must be admin or moderator)
        const currentUserRole = await GroupMember.getUserRole(groupId, currentUserId);
        
        if (!['admin', 'moderator'].includes(currentUserRole.role)) {
            return res.status(403).json({ 
                message: 'Only group admins and moderators can view banned members' 
            });
        }
        
        const result = await GroupMember.getBannedMembers(groupId, {
            limit: parseInt(limit) || 20,
            offset: parseInt(offset) || 0
        });
        
        res.json(result);
    } catch (error) {
        console.error('Error fetching banned members:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    joinGroup,
    leaveGroup,
    getGroupMembers,
    changeMemberRole,
    removeMember,
    banMember,
    unbanMember,
    getBannedMembers
};