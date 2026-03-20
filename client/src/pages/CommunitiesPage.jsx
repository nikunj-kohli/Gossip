import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { getCommunities, joinCommunity, createCommunity } from '../api';

const CommunitiesPage = () => {
  const { user } = React.useContext(AuthContext);
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCommunity, setNewCommunity] = useState({
    name: '',
    description: '',
    type: 'Public',
    category: 'general'
  });

  const communityCategories = [
    { id: 'all', name: 'All Communities' },
    { id: 'general', name: 'General' },
    { id: 'gaming', name: 'Gaming' },
    { id: 'tech', name: 'Technology' },
    { id: 'memes', name: 'Memes' },
    { id: 'support', name: 'Support' },
    { id: 'local', name: 'Local' }
  ];

  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchCommunities();
  }, []);

  const fetchCommunities = async () => {
    try {
      setLoading(true);
      const { data, error } = await getCommunities();
      
      if (error) {
        console.error('Error fetching communities:', error);
        // Don't use fallback - show error state
        setCommunities([]);
      } else {
        setCommunities(data || []);
      }
    } catch (error) {
      console.error('Error fetching communities:', error);
      setCommunities([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinCommunity = async (communityId) => {
    try {
      const { error } = await joinCommunity(communityId);
      
      if (error) {
        console.error('Error joining community:', error);
      } else {
        // Update the community in state to show as joined
        setCommunities(communities.map(community => 
          community.id === communityId 
            ? { ...community, joined: true }
            : community
        ));
      }
    } catch (error) {
      console.error('Error joining community:', error);
    }
  };

  const handleCreateCommunity = async () => {
    if (!newCommunity.name.trim()) {
      alert('Please enter a community name');
      return;
    }

    try {
      const { data, error } = await createCommunity({
        name: newCommunity.name,
        description: newCommunity.description,
        type: newCommunity.type.toLowerCase(),
        category: newCommunity.category
      });

      if (error) {
        console.error('Error creating community:', error);
        alert('Failed to create community: ' + (error.message || 'Unknown error'));
        return;
      }

      // Add new community to the list
      setCommunities([data, ...communities]);
      setShowCreateModal(false);
      setNewCommunity({
        name: '',
        description: '',
        type: 'Public',
        category: 'general'
      });
      alert('Community created successfully!');
    } catch (error) {
      console.error('Error creating community:', error);
      alert('Failed to create community');
    }
  };

  const sampleCommunities = [
    {
      id: 1,
      name: 'Rants & Raves',
      description: 'Share your daily frustrations and victories. No judgment zone.',
      type: 'Public',
      members: 15420,
      active: 892,
      category: 'general',
      image: 'https://ui-avatars.com/api/?name=Rants&background=F59E0B&color=fff',
      joined: false
    },
    {
      id: 2,
      name: 'Tech Talk',
      description: 'Discuss the latest in technology, programming, and digital life.',
      type: 'Public',
      members: 8934,
      active: 456,
      category: 'tech',
      image: 'https://ui-avatars.com/api/?name=Tech&background=3B82F6&color=fff',
      joined: false
    },
    {
      id: 3,
      name: 'Meme Lords',
      description: 'Only the finest memes and shitposts allowed.',
      type: 'Public',
      members: 23156,
      active: 1203,
      category: 'memes',
      image: 'https://ui-avatars.com/api/?name=Memes&background=8B5CF6&color=fff',
      joined: false
    },
    {
      id: 4,
      name: 'Support Circle',
      description: 'A safe space to share struggles and get support from the community.',
      type: 'Private',
      members: 5678,
      active: 234,
      category: 'support',
      image: 'https://ui-avatars.com/api/?name=Support&background=10B981&color=fff',
      joined: false
    },
    {
      id: 5,
      name: 'Local Hangout',
      description: 'Connect with people in your area. Events, meetups, and local discussions.',
      type: 'Public',
      members: 3456,
      active: 178,
      category: 'local',
      image: 'https://ui-avatars.com/api/?name=Local&background=EF4444&color=fff',
      joined: false
    }
  ];

  const filteredCommunities = selectedCategory === 'all' 
    ? communities 
    : communities.filter(community => community.category === selectedCategory);

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
              <h1 className="text-xl font-semibold text-gray-900">Communities</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/feed" className="text-gray-600 hover:text-blue-600">Feed</Link>
              <Link to="/friends" className="text-gray-600 hover:text-blue-600">Friends</Link>
              <Link to="/messages" className="text-gray-600 hover:text-blue-600">Messages</Link>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                + Create Community
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Category Filter */}
            <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
              <div className="flex space-x-2">
                {communityCategories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Communities List */}
            <div className="space-y-4">
              {filteredCommunities.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                  <div className="text-gray-500 text-lg">No communities found</div>
                  <p className="text-gray-400 mt-2">Try a different category or create your own!</p>
                </div>
              ) : (
                filteredCommunities.map((community) => (
                  <div key={community.id} className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start space-x-4">
                      <img
                        className="h-16 w-16 rounded-lg"
                        src={community.image || `https://ui-avatars.com/api/?name=${community.name}&background=3B82F6&color=fff&size=64`}
                        alt={community.name}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              g/{community.name.toLowerCase().replace(/\s+/g, '')}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">{community.description}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              community.type === 'Public' 
                                ? 'bg-green-100 text-green-800' 
                                : community.type === 'Private'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {community.type}
                            </span>
                            {community.joined ? (
                              <span className="text-green-600 text-sm font-medium">Joined</span>
                            ) : (
                              <button
                                onClick={() => handleJoinCommunity(community.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium"
                              >
                                Join
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                          <span>{community.members?.toLocaleString() || '0'} members</span>
                          <span>{community.active || '0'} online</span>
                          <span className={`px-2 py-1 bg-gray-100 rounded text-xs`}>
                            {communityCategories.find(cat => cat.id === community.category)?.name || 'General'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Your Communities */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Your Communities</h3>
              <div className="space-y-2">
                {communities.filter(c => c.joined).length === 0 ? (
                  <p className="text-sm text-gray-500">No communities joined yet</p>
                ) : (
                  communities.filter(c => c.joined).map(community => (
                    <Link
                      key={community.id}
                      to={`/community/${community.id}`}
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <img
                          className="h-8 w-8 rounded"
                          src={community.image || `https://ui-avatars.com/api/?name=${community.name}&background=3B82F6&color=fff&size=32`}
                          alt={community.name}
                        />
                        <span className="text-sm font-medium">g/{community.name.toLowerCase().replace(/\s+/g, '')}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Trending Communities */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Trending Communities</h3>
              <div className="space-y-2">
                {communities
                  .sort((a, b) => (b.active || 0) - (a.active || 0))
                  .slice(0, 5)
                  .map((community, index) => (
                    <div key={community.id} className="flex items-center space-x-3">
                      <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                      <div className="flex-1">
                        <Link
                          to={`/community/${community.id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          g/{community.name.toLowerCase().replace(/\s+/g, '')}
                        </Link>
                        <div className="text-xs text-gray-500">
                          {community.active || '0'} active now
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Community Guidelines */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Community Guidelines</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Be respectful to others</li>
                <li>• No hate speech or harassment</li>
                <li>• Keep discussions on-topic</li>
                <li>• Follow community-specific rules</li>
                <li>• Report inappropriate content</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Create Community Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Community</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newCommunity.name}
                  onChange={(e) => setNewCommunity({...newCommunity, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Community name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newCommunity.description}
                  onChange={(e) => setNewCommunity({...newCommunity, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="What's your community about?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newCommunity.type}
                  onChange={(e) => setNewCommunity({...newCommunity, type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Public">Public</option>
                  <option value="Private">Private</option>
                  <option value="Restricted">Restricted</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newCommunity.category}
                  onChange={(e) => setNewCommunity({...newCommunity, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {communityCategories.slice(1).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleCreateCommunity}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunitiesPage;
