import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { 
  getFriends, 
  getPendingRequests, 
  getSentRequests, 
  acceptFriendRequest, 
  declineFriendRequest, 
  sendFriendRequest, 
  removeFriend,
  checkFriendshipStatus,
  searchUsers
} from '../api';

const FriendsPage = () => {
  const { user } = React.useContext(AuthContext);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [suggestedFriends, setSuggestedFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchFriendsData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearchUsers(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleSearchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await searchUsers(query);
      
      if (error) {
        console.error('Error searching users:', error);
        setSearchResults([]);
      } else {
        setSearchResults(data?.users || []);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchFriendsData = async () => {
    try {
      setLoading(true);
      
      // Fetch real data from backend
      const [friendsRes, requestsRes, sentRes] = await Promise.all([
        getFriends(),
        getPendingRequests(),
        getSentRequests()
      ]);

      // SAFETY CHECKS - Ensure data is always an array
      const friendsData = Array.isArray(friendsRes.data) ? friendsRes.data : [];
      const pendingData = Array.isArray(requestsRes.data) ? requestsRes.data : [];
      const sentData = Array.isArray(sentRes.data) ? sentRes.data : [];

      console.log('Friends data:', friendsData);
      console.log('Pending requests:', pendingData);
      console.log('Sent requests:', sentData);

      if (friendsRes.error) {
        console.error('Error fetching friends:', friendsRes.error);
      } else {
        setFriends(friendsData);
      }

      if (requestsRes.error) {
        console.error('Error fetching requests:', requestsRes.error);
      } else {
        setFriendRequests(pendingData);
      }

      if (sentRes.error) {
        console.error('Error fetching sent requests:', sentRes.error);
      } else {
        // Add sent requests to suggested friends with different status
        setSuggestedFriends(sentData.map(req => ({
          ...req,
          status: 'sent',
          displayName: req.displayName || req.username,
          mutualFriends: req.mutualFriends || 0
        })));
      }

    } catch (error) {
      console.error('Error fetching friends data:', error);
    } finally {
      setLoading(false);
    }
  };

  const mockFriends = [
    {
      id: 1,
      username: 'johndoe',
      displayName: 'John Doe',
      avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=3B82F6&color=fff',
      status: 'online',
      lastSeen: '2m ago',
      mutualFriends: 12
    },
    {
      id: 2,
      username: 'janesmith',
      displayName: 'Jane Smith',
      avatar: 'https://ui-avatars.com/api/?name=Jane+Smith&background=EC4899&color=fff',
      status: 'offline',
      lastSeen: '1h ago',
      mutualFriends: 8
    },
    {
      id: 3,
      username: 'mikejohnson',
      displayName: 'Mike Johnson',
      avatar: 'https://ui-avatars.com/api/?name=Mike+Johnson&background=10B981&color=fff',
      status: 'online',
      lastSeen: 'Active now',
      mutualFriends: 15
    }
  ];

  const mockFriendRequests = [
    {
      id: 4,
      username: 'sarahwilson',
      displayName: 'Sarah Wilson',
      avatar: 'https://ui-avatars.com/api/?name=Sarah+Wilson&background=F59E0B&color=fff',
      mutualFriends: 5,
      requestDate: '2 days ago'
    },
    {
      id: 5,
      username: 'davidbrown',
      displayName: 'David Brown',
      avatar: 'https://ui-avatars.com/api/?name=David+Brown&background=8B5CF6&color=fff',
      mutualFriends: 3,
      requestDate: '1 week ago'
    }
  ];

  const mockSuggestedFriends = [
    {
      id: 6,
      username: 'emilydavis',
      displayName: 'Emily Davis',
      avatar: 'https://ui-avatars.com/api/?name=Emily+Davis&background=EF4444&color=fff',
      mutualFriends: 7,
      reason: 'Friends with John Doe and Jane Smith'
    },
    {
      id: 7,
      username: 'chrismiller',
      displayName: 'Chris Miller',
      avatar: 'https://ui-avatars.com/api/?name=Chris+Miller&background=06B6D4&color=fff',
      mutualFriends: 4,
      reason: 'Member of Tech Talk community'
    },
    {
      id: 8,
      username: 'lisagarcia',
      displayName: 'Lisa Garcia',
      avatar: 'https://ui-avatars.com/api/?name=Lisa+Garcia&background=84CC16&color=fff',
      mutualFriends: 6,
      reason: 'From your university'
    }
  ];

  const handleAcceptRequest = async (friendId) => {
    try {
      const result = await acceptFriendRequest(friendId);
      if (result.error) {
        console.error('Error accepting request:', result.error);
        alert('Failed to accept friend request');
        return;
      }

      // Update local state
      setFriendRequests(friendRequests.filter(req => req.id !== friendId));
      const acceptedRequest = friendRequests.find(req => req.id === friendId);
      if (acceptedRequest) {
        setFriends([...friends, { 
          ...acceptedRequest, 
          status: 'online', 
          lastSeen: 'Active now',
          isOnline: true
        }]);
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      alert('Failed to accept friend request');
    }
  };

  const handleDeclineRequest = async (friendId) => {
    try {
      const result = await declineFriendRequest(friendId);
      if (result.error) {
        console.error('Error declining request:', result.error);
        alert('Failed to decline friend request');
        return;
      }

      setFriendRequests(friendRequests.filter(req => req.id !== friendId));
    } catch (error) {
      console.error('Error declining friend request:', error);
      alert('Failed to decline friend request');
    }
  };

  const handleSendFriendRequest = async (friendId) => {
    try {
      const result = await sendFriendRequest(friendId);
      if (result.error) {
        console.error('Error sending friend request:', result.error);
        alert('Failed to send friend request');
        return;
      }

      // Update local state
      setSuggestedFriends(suggestedFriends.filter(friend => friend.id !== friendId));
      alert('Friend request sent!');
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert('Failed to send friend request');
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;

    try {
      const result = await removeFriend(friendId);
      if (result.error) {
        console.error('Error removing friend:', result.error);
        alert('Failed to remove friend');
        return;
      }

      setFriends(friends.filter(friend => friend.id !== friendId));
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Failed to remove friend');
    }
  };

  const filteredFriends = (Array.isArray(friends) ? friends : []).filter(friend =>
    friend.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSuggested = (Array.isArray(suggestedFriends) ? suggestedFriends : []).filter(friend =>
    friend.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/feed" className="text-2xl font-bold text-blue-600">Gossip</Link>
              <span className="mx-3 text-gray-300">/</span>
              <h1 className="text-xl font-semibold text-gray-900">Friends</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/feed" className="text-gray-600 hover:text-blue-600">Feed</Link>
              <Link to="/communities" className="text-gray-600 hover:text-blue-600">Communities</Link>
              <Link to="/messages" className="text-gray-600 hover:text-blue-600">Messages</Link>
              <div className="flex items-center space-x-2">
                <img
                  className="h-8 w-8 rounded-full"
                  src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.displayName || user?.username}&background=3B82F6&color=fff`}
                  alt={user?.displayName || user?.username}
                />
                <span className="text-sm font-medium text-gray-700">{user?.displayName || user?.username}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Search and Tabs */}
            <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  placeholder="Search friends..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      activeTab === 'all'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All Friends ({friends.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('requests')}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      activeTab === 'requests'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Requests ({friendRequests.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('search')}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      activeTab === 'search'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Search Users
                  </button>
                </div>
              </div>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'all' && (
              <div className="space-y-4">
                {filteredFriends.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                    <div className="text-gray-500 text-lg">No friends found</div>
                    <p className="text-gray-400 mt-2">Try adjusting your search or add new friends!</p>
                  </div>
                ) : (
                  filteredFriends.map((friend) => (
                    <div key={friend.id} className="bg-white rounded-lg shadow-sm border p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <img
                              className="h-12 w-12 rounded-full"
                              src={friend.avatar}
                              alt={friend.displayName}
                            />
                            <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                              friend.status === 'online' ? 'bg-green-400' : 'bg-gray-300'
                            }`}></span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{friend.displayName}</h3>
                            <p className="text-sm text-gray-600">@{friend.username}</p>
                            <p className="text-xs text-gray-500">
                              {friend.status === 'online' ? 'Active now' : `Last seen ${friend.lastSeen}`} • {friend.mutualFriends} mutual friends
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/messages/${friend.user_id}`}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                          >
                            Message
                          </Link>
                          <button
                            onClick={() => handleRemoveFriend(friend.user_id)}
                            className="text-gray-500 hover:text-red-600 transition-colors"
                            title="Remove friend"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'requests' && (
              <div className="space-y-4">
                {friendRequests.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                    <div className="text-gray-500 text-lg">No friend requests</div>
                    <p className="text-gray-400 mt-2">You're all caught up!</p>
                  </div>
                ) : (
                  friendRequests.map((request) => (
                    <div key={request.friendship_id} className="bg-white rounded-lg shadow-sm border p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <img
                            className="h-12 w-12 rounded-full"
                            src={request.avatar}
                            alt={request.displayName}
                          />
                          <div>
                            <h3 className="font-semibold text-gray-900">{request.displayName}</h3>
                            <p className="text-sm text-gray-600">@{request.username}</p>
                            <p className="text-xs text-gray-500">
                              {request.mutualFriends} mutual friends • Request sent {request.requestDate}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAcceptRequest(request.requester_id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleDeclineRequest(request.requester_id)}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'search' && (
              <div className="space-y-4">
                {isSearching ? (
                  <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <div className="text-gray-500">Searching users...</div>
                  </div>
                ) : searchResults.length === 0 && searchQuery.trim() ? (
                  <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                    <div className="text-gray-500 text-lg">No users found</div>
                    <p className="text-gray-400 mt-2">Try a different search term</p>
                  </div>
                ) : searchQuery.trim() ? (
                  searchResults.map((searchUser) => (
                    <div key={searchUser.id} className="bg-white rounded-lg shadow-sm border p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <img
                            className="h-12 w-12 rounded-full"
                            src={searchUser.avatar || `https://ui-avatars.com/api/?name=${searchUser.displayName || searchUser.username}&background=3B82F6&color=fff`}
                            alt={searchUser.displayName || searchUser.username}
                          />
                          <div>
                            <h3 className="font-semibold text-gray-900">{searchUser.displayName || searchUser.username}</h3>
                            <p className="text-sm text-gray-600">@{searchUser.username}</p>
                            {searchUser.mutualFriends !== undefined && (
                              <p className="text-xs text-gray-500">
                                {searchUser.mutualFriends} mutual friends
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {searchUser.friendship_status === 'friends' ? (
                            <button
                              onClick={() => window.location.href = `/messages/${searchUser.id}`}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                            >
                              Message
                            </button>
                          ) : searchUser.friendship_status === 'pending_sent' ? (
                            <button
                              disabled
                              className="bg-gray-300 text-gray-500 px-4 py-2 rounded-md text-sm font-medium cursor-not-allowed"
                            >
                              Request Sent
                            </button>
                          ) : searchUser.friendship_status === 'pending_received' ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleAcceptRequest(searchUser.id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleDeclineRequest(searchUser.id)}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleSendFriendRequest(searchUser.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                            >
                              Add Friend
                            </button>
                          )}
                          <button className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium">
                            View Profile
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                    <div className="text-gray-500 text-lg">Search for users</div>
                    <p className="text-gray-400 mt-2">Type a username or name to find people</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Friend Stats */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Friend Stats</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Friends</span>
                  <span className="text-sm font-medium">{friends.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Online Now</span>
                  <span className="text-sm font-medium">{friends.filter(f => f.status === 'online').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Pending Requests</span>
                  <span className="text-sm font-medium">{friendRequests.length}</span>
                </div>
              </div>
            </div>

            {/* Online Friends */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Online Friends</h3>
              <div className="space-y-2">
                {friends.filter(f => f.status === 'online').length === 0 ? (
                  <p className="text-sm text-gray-500">No friends online</p>
                ) : (
                  friends.filter(f => f.status === 'online').map(friend => (
                    <Link
                      key={friend.user_id}
                      to={`/messages/${friend.user_id}`}
                      className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 transition-colors"
                    >
                      <div className="relative">
                        <img
                          className="h-8 w-8 rounded-full"
                          src={friend.avatar}
                          alt={friend.displayName}
                        />
                        <span className="absolute bottom-0 right-0 h-2 w-2 bg-green-400 rounded-full border border-white"></span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{friend.displayName}</p>
                        <p className="text-xs text-gray-500">Active now</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Find Friends */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Find Friends</h3>
              <div className="space-y-2">
                <button className="w-full text-left text-sm text-blue-600 hover:text-blue-700 py-1">
                  📧 Invite by Email
                </button>
                <button className="w-full text-left text-sm text-blue-600 hover:text-blue-700 py-1">
                  📱 Share Invite Link
                </button>
                <button className="w-full text-left text-sm text-blue-600 hover:text-blue-700 py-1">
                  🔍 Find by Username
                </button>
                <button className="w-full text-left text-sm text-blue-600 hover:text-blue-700 py-1">
                  👥 Sync Contacts
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FriendsPage;
