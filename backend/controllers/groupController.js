const Group = require('../models/Group');
const User = require('../models/User');

// Create new group
const createGroup = async (req, res) => {
    try {
        const { name, description, privacy = 'public', avatarUrl, coverUrl } = req.body;
        
        // Validate required fields
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ message: 'Group name is required' });
        }
        
        if (name.length > 100) {
            return res.status(400).json({ message: 'Group name is too long (max 100 characters)' });
        }
        
        // Validate privacy
        const validPrivacy = ['public', 'private'];
        if (!validPrivacy.includes(privacy)) {
            return res.status(400).json({ message: 'Invalid privacy setting' });
        }
        
        // Create group
        const group = await Group.create({
            name,
            description,
            privacy,
            creatorId: req.user.id,
            avatarUrl,
            coverUrl
        });
        
        res.status(201).json({
            message: 'Group created successfully',
            group
        });
        
    } catch (error) {
        console.error('Create group error:', error);
        
        // Handle specific errors
        if (error.message === 'A group with a similar name already exists') {
            return res.status(409).json({ message: error.message });
        }
        
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get all groups with filters
const getAllGroups = async (req, res) => {
    try {
        const { search, privacy, limit = 20, offset = 0, orderBy, sortOrder } = req.query;
        const userId = req.user ? req.user.id : null;
        
        const result = await Group.getAll({
            search,
            privacy,
            limit: parseInt(limit),
            offset: parseInt(offset),
            userId,
            orderBy,
            sortOrder
        });
        
        res.json(result);
        
    } catch (error) {
        console.error('Get all groups error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get group by ID or slug
const getGroupById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user ? req.user.id : null;
        
        const group = await Group.getByIdOrSlug(id, userId);
        
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }
        
        // If group is private and restricted
        if (group.restricted) {
            return res.status(403).json({ 
                message: 'This is a private group', 
                private: true,
                id: group.id
            });
        }
        
        res.json({ group });
        
    } catch (error) {
        console.error('Get group error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get groups created by current user
const getUserGroups = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 20, offset = 0 } = req.query;
        
        const result = await Group.getByCreator(userId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json(result);
        
    } catch (error) {
        console.error('Get user groups error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get groups a user is a member of
const getUserMemberships = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 20, offset = 0 } = req.query;
        
        const result = await Group.getByMember(userId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json(result);
        
    } catch (error) {
        console.error('Get user memberships error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Update group
const updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, privacy, avatarUrl, coverUrl } = req.body;
        const userId = req.user.id;
        
        // Update group
        const updatedGroup = await Group.update(id, userId, {
            name,
            description,
            privacy,
            avatarUrl,
            coverUrl
        });
        
        res.json({
            message: 'Group updated successfully',
            group: updatedGroup
        });
        
    } catch (error) {
        console.error('Update group error:', error);
        
        if (error.message === 'Unauthorized to update this group') {
            return res.status(403).json({ message: error.message });
        }
        
        if (error.message === 'Group not found or already deleted') {
            return res.status(404).json({ message: error.message });
        }
        
        if (error.message === 'A group with a similar name already exists') {
            return res.status(409).json({ message: error.message });
        }
        
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Delete group
const deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const result = await Group.delete(id, userId);
        
        if (!result.success) {
            if (result.message === 'Unauthorized to delete this group') {
                return res.status(403).json({ message: result.message });
            } else {
                return res.status(404).json({ message: result.message });
            }
        }
        
        res.json({ message: result.message });
        
    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    createGroup,
    getAllGroups,
    getGroupById,
    getUserGroups,
    getUserMemberships,
    updateGroup,
    deleteGroup
};