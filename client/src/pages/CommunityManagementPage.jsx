import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { getCommunityById, getCommunityByName, updateGroup, deleteGroup } from '../api';
import { SkeletonBlock, SkeletonCard } from '../components/Skeletons';

const CommunityManagementPage = () => {
  const { user } = React.useContext(AuthContext);
  const { communityName, id } = useParams();
  const navigate = useNavigate();
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privacy: 'public',
    avatarUrl: '',
    coverUrl: '',
  });

  useEffect(() => {
    const fetchCommunity = async () => {
      const identifier = communityName || id; // Use name if available, otherwise ID
      
      if (!identifier) return;
      
      try {
        let result;
        if (communityName) {
          // Use name-based fetch
          result = await getCommunityByName(communityName);
        } else {
          // Use ID-based fetch for backward compatibility
          result = await getCommunityById(id);
        }
        
        const { data, error } = result;
        
        if (error) {
          console.error('Error fetching community:', error);
          setLoading(false);
          return;
        }
        
        setCommunity(data.group);
        setFormData({
          name: data.group.name || '',
          description: data.group.description || '',
          privacy: data.group.privacy || 'public',
          avatarUrl: data.group.avatar_url || '',
          coverUrl: data.group.cover_url || '',
        });

        // Canonicalize legacy ID routes to slug-based management route.
        if (id && data.group?.slug) {
          navigate(`/r/${data.group.slug}/manage`, { replace: true });
        }
      } catch (error) {
        console.error('Error fetching community:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCommunity();
  }, [communityName, id]);

  const handleUpdateCommunity = async (e) => {
    e.preventDefault();
    
    if (!community) return;
    
    try {
      const { data, error } = await updateGroup(community.id, formData);
      
      if (error) {
        console.error('Error updating community:', error);
        alert(error.message || 'Failed to update community');
      } else {
        alert('Community updated successfully!');
        setCommunity(data.group);
        setEditMode(false);
      }
    } catch (error) {
      console.error('Error updating community:', error);
      alert('Failed to update community');
    }
  };

  const handleDeleteCommunity = async () => {
    if (!community) return;
    
    if (!window.confirm('Are you sure you want to delete this community? This action cannot be undone.')) {
      return;
    }
    
    try {
      const { data, error } = await deleteGroup(community.id);
      
      if (error) {
        console.error('Error deleting community:', error);
        alert(error.message || 'Failed to delete community');
      } else {
        alert('Community deleted successfully!');
        navigate('/communities');
      }
    } catch (error) {
      console.error('Error deleting community:', error);
      alert('Failed to delete community');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <SkeletonBlock className="h-8 w-56" />
          <SkeletonCard media lines={3} footer />
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 text-lg">Community not found</div>
          <button
            onClick={() => navigate('/communities')}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Back to Communities
          </button>
        </div>
      </div>
    );
  }

  const canManage = community.creator_id === user?.id || community.user_role === 'admin' || community.user_role === 'creator';

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="editorial-card overflow-hidden">
          <div className="h-44 w-full overflow-hidden bg-[#f0f3ff]">
            <img
              className="h-full w-full object-cover"
              src={formData.coverUrl || community.cover_url || `https://picsum.photos/seed/${encodeURIComponent(community?.slug || community?.name || 'community')}/1200/440`}
              alt="Community cover preview"
              loading="lazy"
            />
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editMode ? 'Edit Community' : community.name}
              </h2>
              {canManage && (
                <div className="flex space-x-3">
                  {!editMode && (
                    <button
                      onClick={() => setEditMode(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Edit
                    </button>
                  )}
                  {editMode && (
                    <button
                      onClick={() => setEditMode(false)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleDeleteCommunity}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Delete Community
                  </button>
                </div>
              )}
            </div>

            {editMode ? (
              <form onSubmit={handleUpdateCommunity} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Community Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Privacy</label>
                  <select
                    value={formData.privacy}
                    onChange={(e) => setFormData({ ...formData, privacy: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Avatar URL (recommended 1:1, e.g. 512 x 512)</label>
                  <input
                    type="url"
                    value={formData.avatarUrl}
                    onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                  <p className="mt-1 text-xs text-gray-500">Square avatars stay crisp in the community header and cards.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cover URL (recommended 3:1, e.g. 1200 x 400)</label>
                  <input
                    type="url"
                    value={formData.coverUrl}
                    onChange={(e) => setFormData({ ...formData, coverUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave empty to keep current cover"
                  />
                  <p className="mt-1 text-xs text-gray-500">Wide banners are the best fit for the top cover section.</p>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-white hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Description</h3>
                  <p className="text-gray-600">
                    {community.description || 'No description available'}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700">Privacy</h3>
                  <p className="text-gray-600">
                    {community.privacy === 'private' ? 'Private Community' : 'Public Community'}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700">Created</h3>
                  <p className="text-gray-600">
                    {new Date(community.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700">Members</h3>
                  <p className="text-gray-600">
                    Member count and management options would go here
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityManagementPage;
