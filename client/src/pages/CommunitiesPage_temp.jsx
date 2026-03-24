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

  const fetchCommunities = async () => {
    try {
      setLoading(true);
      const { data, error } = await getCommunities();
      
      if (error) {
        console.error('Error fetching communities:', error);
        setCommunities([]);
      } else {
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
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                + Create Community
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
              <div className="flex space-x-2">
                <button className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                  All Communities
                </button>
              </div>
            </div>

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
                        src={`https://ui-avatars.com/api/?name=${community.name || 'community'}&background=3B82F6&color=fff&size=64`}
                        alt={community.name || 'Community'}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold text-gray-900">
                                g/{community.name ? community.name.toLowerCase().replace(/\s+/g, '') : 'unknown'}
                              </h3>
                              <p className="text-sm text-gray-600 mt-1">{community.description || 'No description available'}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                                {community.type || 'Public'}
                              </span>
                              <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700">
                                General
                              </span>
                            </div>
                            <button
                              onClick={() => console.log('Join community:', community.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                            >
                              Join
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Your Communities</h3>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">No communities joined yet</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunitiesPage;
