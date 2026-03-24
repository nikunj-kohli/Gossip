import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { getCommunities, joinCommunity, createCommunity } from '../api';

const CommunitiesPage = () => {
  const { user } = React.useContext(AuthContext);
  const { id } = useParams();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [newCommunity, setNewCommunity] = useState({
    name: '',
    description: '',
    category: 'gaming',
    type: 'Public',
    image: ''
  });

  // Check if we're viewing a specific community or the list
  const isViewingSpecificCommunity = id && id !== 'undefined';

  const communityCategories = [
    { id: 'all', name: 'All Communities' },
    { id: 'general', name: 'General' },
    { id: 'gaming', name: 'Gaming' },
    { id: 'tech', name: 'Technology' },
    { id: 'memes', name: 'Memes' },
    { id: 'support', name: 'Support' },
    { id: 'local', name: 'Local' }
  ];

  const fetchCommunities = async () => {
    try {
      setLoading(true);
      console.log('CommunitiesPage: Fetching communities...');
      const { data, error } = await getCommunities();
      console.log('CommunitiesPage: API response:', { data, error });
      
      if (error) {
        console.error('Error fetching communities:', error);
        setCommunities([]);
      } else {
        console.log('CommunitiesPage: Setting communities with:', data);
        // Handle both data formats: direct array or nested in groups property
        const communitiesArray = Array.isArray(data) ? data : (data?.groups || []);
        setCommunities(Array.isArray(communitiesArray) ? communitiesArray : []);
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
      const result = await joinCommunity(communityId);
      if (result.error) {
        console.error('Error joining community:', result.error);
        alert('Failed to join community');
      } else {
        alert('Successfully joined community!');
        fetchCommunities();
      }
    } catch (error) {
      console.error('Error joining community:', error);
      alert('Failed to join community');
    }
  };

  const handleCreateCommunity = async (e) => {
    e.preventDefault();
    try {
      const result = await createCommunity(newCommunity);
      if (result.error) {
        console.error('Error creating community:', result.error);
        alert('Failed to create community');
      } else {
        alert('Community created successfully!');
        setShowCreateModal(false);
        setNewCommunity({
          name: '',
          description: '',
          category: 'gaming',
          type: 'Public',
          image: ''
        });
        fetchCommunities();
      }
    } catch (error) {
      console.error('Error creating community:', error);
      alert('Failed to create community');
    }
  };

  const filteredCommunities = selectedCategory === 'all' 
    ? (Array.isArray(communities) ? communities : [])
    : (Array.isArray(communities) ? communities.filter(community => community.category === selectedCategory) : []);

  useEffect(() => {
    fetchCommunities();
  }, []);

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
          {/* Show specific community if ID is provided */}
          {isViewingSpecificCommunity ? (
            <div className="lg:col-span-2">
              {communities.filter(c => c.id == id).map(community => (
                <div key={community.id} className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-start space-x-4">
                    <img
                      className="h-16 w-16 rounded-lg"
                      src={community.image || `https://ui-avatars.com/api/?name=${community.name || 'community'}&background=3B82F6&color=fff&size=64`}
                      alt={community.name || 'Community'}
                    />
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">{community.name || 'Community'}</h2>
                      <p className="text-gray-600 mb-4">{community.description || 'No description available'}</p>
                      <div className="flex items-center space-x-4">
                        <span className={`px-3 py-1 text-sm font-medium rounded ${
                          community.type === 'Public' 
                            ? 'bg-green-100 text-green-800' 
                            : community.type === 'Private'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {community.type}
                        </span>
                        <span className={`px-3 py-1 text-sm font-medium rounded ${
                          communityCategories.find(cat => cat.id === community.category)?.name || 'General'
                        }`}>
                          {communityCategories.find(cat => cat.id === community.category)?.name || 'General'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleJoinCommunity(community.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
                      >
                        {community.joined ? 'Leave' : 'Join'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Show communities list if no specific ID */
            <>
              <div className="lg:col-span-2">
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
                            src={community.image || `https://ui-avatars.com/api/?name=${community.name || 'community'}&background=3B82F6&color=fff&size=64`}
                            alt={community.name || 'Community'}
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                  g/{community.name ? community.name.toLowerCase().replace(/\s+/g, '') : 'unknown'}
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">{community.description || 'No description available'}</p>
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
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  communityCategories.find(cat => cat.id === community.category)?.name || 'General'
                                }`}>
                                  {communityCategories.find(cat => cat.id === community.category)?.name || 'General'}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleJoinCommunity(community.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                            >
                              Join
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  )}
                </div>
              </div>
            </>
          )}
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
                communities.filter(c => c.joined).map((community, index) => (
                  <Link
                    key={community.id}
                    to={`/community/${community.id}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <img
                        className="h-8 w-8 rounded"
                        src={community.image || `https://ui-avatars.com/api/?name=${community.name}&background=3B82F6&color=fff&size=64`}
                        alt={community.name}
                      />
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
                  </Link>
                ))
              )}
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
  );
};

export default CommunitiesPage;
