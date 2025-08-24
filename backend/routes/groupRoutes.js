const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const {
    createGroup,
    getAllGroups,
    getUserGroups,
    getUserMemberships,
    getGroupById,
    updateGroup,
    deleteGroup
} = require('../controllers/groupController');

const { 
    createGroupPost,
    getGroupPosts
} = require('../controllers/postController');

const {
    joinGroup,
    leaveGroup,
    getGroupMembers,
    changeMemberRole,
    removeMember,
    banMember,
    unbanMember,
    getBannedMembers
} = require('../controllers/groupMemberController');

const router = express.Router();

// Public routes with optional auth
router.get('/', optionalAuth, getAllGroups);
router.get('/:groupId', optionalAuth, getGroupById);
router.get('/:groupId/members', optionalAuth, getGroupMembers);

// Protected routes
router.use(authenticateToken);

// Group management
router.post('/', createGroup);
router.get('/user/owned', getUserGroups);
router.get('/user/member', getUserMemberships);
router.put('/:groupId', updateGroup);
router.delete('/:groupId', deleteGroup);

// Group posts
router.post('/:groupId/posts', createGroupPost);
router.get('/:groupId/posts', getGroupPosts);

// Group membership
router.post('/:groupId/join', joinGroup);
router.post('/:groupId/leave', leaveGroup);
router.put('/:groupId/members/:userId/role', changeMemberRole);
router.delete('/:groupId/members/:userId', removeMember);

// Ban management
router.post('/:groupId/ban/:userId', banMember);
router.post('/:groupId/unban/:userId', unbanMember);
router.get('/:groupId/banned', getBannedMembers);

module.exports = router;