const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  getFriends,
  getPendingRequests,
  getSentRequests,
  checkFriendshipStatus,
  getMutualFriends,
} = require('../controllers/friendshipController');

const router = express.Router();

router.use(authenticateToken);

router.post('/users/:userId/request', sendFriendRequest);
router.post('/users/:userId/accept', acceptFriendRequest);
router.post('/users/:userId/decline', declineFriendRequest);
router.post('/users/:userId/cancel', cancelFriendRequest);
router.post('/users/:userId/remove', removeFriend);

router.get('/connections', getFriends);
router.get('/users/:userId/connections', getFriends);
router.get('/incoming', getPendingRequests);
router.get('/outgoing', getSentRequests);

router.get('/status/:username', checkFriendshipStatus);
router.get('/users/:userId/status', checkFriendshipStatus);
router.get('/users/:userId/mutual', getMutualFriends);

module.exports = router;
