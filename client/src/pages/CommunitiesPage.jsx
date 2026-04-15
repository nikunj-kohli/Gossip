import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { getCommunities, joinCommunity, createCommunity, getUserMemberships, uploadPostMedia } from '../api';
import { SkeletonBlock, SkeletonCard } from '../components/Skeletons';
import { cropImageToBlob } from '../utils/imageCrop';

const CommunitiesPage = () => {
  const { user } = React.useContext(AuthContext);
  const { id } = useParams();
  const [communities, setCommunities] = useState([]);
  const [userCommunities, setUserCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [createError, setCreateError] = useState('');
  const [createAvatarPreview, setCreateAvatarPreview] = useState('');
  const [createAvatarZoom, setCreateAvatarZoom] = useState(1);
  const [createAvatarFile, setCreateAvatarFile] = useState(null);
  const [createCoverPreview, setCreateCoverPreview] = useState('');
  const [createCoverZoom, setCreateCoverZoom] = useState(1);
  const [createCoverFile, setCreateCoverFile] = useState(null);

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

  const fetchUserCommunities = async () => {
    if (!user) return;

    try {
      const { data, error } = await getUserMemberships();

      if (error) {
        console.error('Error fetching user communities:', error);
        setUserCommunities([]);
      } else {
        const userCommArray = Array.isArray(data)
          ? data
          : (data?.groups || data?.memberships || []);
        setUserCommunities(Array.isArray(userCommArray) ? userCommArray : []);
      }
    } catch (error) {
      console.error('Error fetching user communities:', error);
      setUserCommunities([]);
    }
  };

  const handleJoinCommunity = async (communityId) => {
    if (!user) {
      alert('Please log in to join communities');
      return;
    }

    try {
      const { data, error } = await joinCommunity(communityId);
      
      if (error) {
        const errorMessage = error.response?.data?.message || error.message || '';

        if (error.response?.status === 400 && /already a member/i.test(errorMessage)) {
          // Keep UI in sync for users who were already members.
          setUserCommunities((prev) => {
            const exists = prev.some((membership) => (membership.group_id || membership.id) === communityId);
            if (exists) return prev;

            const community = communities.find((c) => c.id === communityId);
            if (!community) return prev;

            return [
              ...prev,
              {
                id: community.id,
                group_id: community.id,
                group_name: community.name,
                creator_id: community.creator_id,
                user_role: 'member',
                is_member: true,
              },
            ];
          });
          return;
        }

        console.error('Error joining community:', error);
        alert(errorMessage || 'Failed to join community');
      } else {
        alert('Successfully joined community!');
        await fetchUserCommunities(); // Refresh user communities
      }
    } catch (error) {
      console.error('Error joining community:', error);
      alert('Failed to join community');
    }
  };

  const filteredCommunities = selectedCategory === 'all'
    ? (Array.isArray(communities) ? communities : [])
    : (Array.isArray(communities) ? communities.filter(community => community.category === selectedCategory) : []);

  const getCommunityPath = (community) => {
    if (community?.slug) return `/r/${community.slug}`;
    return `/r/${community.name ? community.name.toLowerCase().replace(/\s+/g, '') : 'unknown'}`;
  };

  const getCommunityCover = (community) => (
    community?.cover_url
    || `https://picsum.photos/seed/${encodeURIComponent(community?.slug || community?.name || 'community')}/1200/500`
  );

  const getCommunityAvatar = (community) => (
    community?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(community?.name || 'community')}&background=0F766E&color=fff&size=96`
  );

  const getMembershipPath = (membership) => {
    const slug = membership?.slug || membership?.group_slug;
    if (slug) return `/r/${slug}`;
    return `/r/${membership?.group_id || membership?.id}`;
  };

  const getMembershipManagePath = (membership) => {
    const slug = membership?.slug || membership?.group_slug;
    if (slug) return `/r/${slug}/manage`;
    return `/community/${membership?.group_id || membership?.id}/manage`;
  };

  const isUserMemberOfCommunity = (communityId) => {
    const community = filteredCommunities.find(c => c.id === communityId);
    const isMemberFromMemberships = userCommunities.some(
      (membership) => (membership.group_id || membership.id) === communityId
    );
    const isMemberFromCommunityPayload = Boolean(community?.is_member);
    // Also check if user is creator of any community
    const isCreator = user && filteredCommunities.some(community => 
      community.id === communityId && community.creator_id === user.id
    );
    const result = isMemberFromMemberships || isMemberFromCommunityPayload || isCreator;
    return result;
  };

  useEffect(() => {
    fetchCommunities();
    fetchUserCommunities();
  }, [user]);

  const setFilePreview = (file, onPreview, onFile, onZoom) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onPreview(String(reader.result || ''));
      onFile(file);
      onZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const uploadCroppedImage = async ({ preview, zoom, width, height, fileNameBase }) => {
    if (!preview) return null;

    const blob = await cropImageToBlob({
      dataUrl: preview,
      zoom,
      outputWidth: width,
      outputHeight: height,
    });

    if (!blob) return null;

    const file = new File([blob], `${fileNameBase}.jpg`, { type: 'image/jpeg' });
    const uploadResult = await uploadPostMedia(file);
    if (uploadResult.error || !uploadResult.data?.url) {
      throw new Error(uploadResult.error?.response?.data?.message || uploadResult.error?.message || 'Failed to upload media');
    }

    return uploadResult.data.url;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-8 w-40" />
            <SkeletonBlock className="h-10 w-44 rounded-md" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <SkeletonCard avatar media lines={2} footer />
              <SkeletonCard avatar media lines={2} footer />
            </div>
            <div className="space-y-4">
              <SkeletonCard lines={2} />
              <SkeletonCard lines={3} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Communities</h1>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            + Create Community
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="editorial-card p-4 mb-6">
              <div className="flex space-x-2">
                <button className="px-3 py-1 rounded-full text-sm font-medium bg-[#ffede8] text-[#1D232E] border border-[#eec8bd]">
                  All Communities
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {filteredCommunities.length === 0 ? (
                <div className="editorial-card p-8 text-center">
                  <div className="text-gray-500 text-lg">No communities found</div>
                  <p className="text-gray-400 mt-2">Try a different category or create your own!</p>
                </div>
              ) : (
                filteredCommunities.map((community) => (
                  <div key={community.id} className="editorial-card overflow-hidden hover:-translate-y-0.5 transition-transform">
                    <div className="h-28 w-full overflow-hidden">
                      <img
                        className="h-full w-full object-cover"
                        src={getCommunityCover(community)}
                        alt={`${community.name || 'Community'} cover`}
                        loading="lazy"
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex items-start space-x-4">
                        <img
                          className="h-16 w-16 rounded-xl border border-[#d8d2c6]"
                          src={getCommunityAvatar(community)}
                          alt={community.name || 'Community'}
                          loading="lazy"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <Link 
                                to={getCommunityPath(community)}
                                className="text-lg font-semibold text-gray-900 hover:text-blue-600"
                              >
                                g/{community.slug || (community.name ? community.name.toLowerCase().replace(/\s+/g, '') : 'unknown')}
                              </Link>
                              <p className="text-sm text-gray-600 mt-1">{community.description || 'No description available'}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                                {community.privacy || 'Public'}
                              </span>
                              <span className="px-2 py-1 text-xs font-medium rounded bg-[#d8f0ec] text-[#0f766e]">
                                {community.member_count || 0} members
                              </span>
                            </div>
                          </div>
                          {isUserMemberOfCommunity(community.id) ? (
                          <button
                            disabled
                            className="bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium mt-3 cursor-not-allowed"
                          >
                            Joined
                          </button>
                        ) : (
                          <button
                            onClick={() => handleJoinCommunity(community.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium mt-3"
                          >
                            Join
                          </button>
                        )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="editorial-card p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Your Communities</h3>
              <div className="space-y-2">
                {userCommunities.length === 0 ? (
                  <p className="text-sm text-gray-500">No communities joined yet</p>
                ) : (
                  userCommunities.map((membership, index) => {
                    const isCreator = membership.creator_id === user?.id;
                    const isAdmin = membership.user_role === 'admin' || membership.user_role === 'creator';
                    const canManage = isCreator || isAdmin;
                    
                    return (
                    <div key={membership.group_id || membership.id || `${membership.group_name || 'community'}-${index}`} className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <img
                          className="h-8 w-8 rounded"
                          src={membership.avatar_url || `https://ui-avatars.com/api/?name=${membership.group_name || 'community'}&background=0F766E&color=fff&size=32`}
                          alt={membership.group_name || 'Community'}
                          loading="lazy"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{membership.group_name || membership.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">
                            {membership.user_role === 'admin' ? 'Admin' : membership.user_role === 'creator' ? 'Creator' : 'Member'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Link
                          to={getMembershipPath(membership)}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          View
                        </Link>
                        {canManage && (
                          <Link
                            to={getMembershipManagePath(membership)}
                            className="text-blue-600 hover:text-blue-700 text-sm ml-2"
                          >
                            Manage
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    {/* Create Community Modal */}
    {showCreateModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Create New Community</h3>
            <button
              onClick={() => {
                setShowCreateModal(false);
                setCreateAvatarPreview('');
                setCreateAvatarZoom(1);
                setCreateAvatarFile(null);
                setCreateCoverPreview('');
                setCreateCoverZoom(1);
                setCreateCoverFile(null);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            setCreateError('');
            const formData = new FormData(e.target);
            const communityData = {
              name: formData.get('name'),
              description: formData.get('description'),
              privacy: formData.get('privacy') || 'public',
            };
            
            try {
              if (createAvatarPreview) {
                communityData.avatarUrl = await uploadCroppedImage({
                  preview: createAvatarPreview,
                  zoom: createAvatarZoom,
                  width: 512,
                  height: 512,
                  fileNameBase: `${communityData.name || 'community'}-avatar`,
                });
              }

              if (createCoverPreview) {
                communityData.coverUrl = await uploadCroppedImage({
                  preview: createCoverPreview,
                  zoom: createCoverZoom,
                  width: 1200,
                  height: 400,
                  fileNameBase: `${communityData.name || 'community'}-cover`,
                });
              }

              const { data, error } = await createCommunity(communityData);
              
              if (error) {
                console.error('Error creating community:', error);
                const message = error.response?.status === 409
                  ? (error.response?.data?.message || 'A community with this name already exists. Try a different name.')
                  : (error.response?.data?.message || error.message || 'Failed to create community');
                setCreateError(message);
              } else {
                alert('Community created successfully!');
                setShowCreateModal(false);
                setCreateError('');
                setCreateAvatarPreview('');
                setCreateAvatarZoom(1);
                setCreateAvatarFile(null);
                setCreateCoverPreview('');
                setCreateCoverZoom(1);
                setCreateCoverFile(null);
                await fetchCommunities(); // Refresh communities list
                await fetchUserCommunities(); // Refresh user communities
              }
            } catch (error) {
              console.error('Error creating community:', error);
              setCreateError(error?.response?.data?.message || error.message || 'Failed to create community');
            }
          }}>
            <div className="space-y-4">
              {createError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {createError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Community Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter community name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe your community"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Privacy</label>
                <select
                  name="privacy"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avatar (1:1)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => setFilePreview(e.target.files?.[0], setCreateAvatarPreview, setCreateAvatarFile, setCreateAvatarZoom)}
                />
                <p className="mt-1 text-xs text-gray-500">Square image with zoom crop.</p>
                {createAvatarPreview && (
                  <div className="mt-3 space-y-2">
                    <div className="mx-auto h-28 w-28 overflow-hidden rounded-xl border border-gray-200">
                      <img
                        src={createAvatarPreview}
                        alt="Avatar preview"
                        className="h-full w-full object-cover"
                        style={{ transform: `scale(${createAvatarZoom})` }}
                      />
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="2.5"
                      step="0.05"
                      value={createAvatarZoom}
                      onChange={(e) => setCreateAvatarZoom(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover (3:1)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => setFilePreview(e.target.files?.[0], setCreateCoverPreview, setCreateCoverFile, setCreateCoverZoom)}
                />
                <p className="mt-1 text-xs text-gray-500">Wide banner with zoom crop. Leave empty to auto-generate.</p>
                {createCoverPreview && (
                  <div className="mt-3 space-y-2">
                    <div className="mx-auto h-24 w-full overflow-hidden rounded-xl border border-gray-200">
                      <img
                        src={createCoverPreview}
                        alt="Cover preview"
                        className="h-full w-full object-cover"
                        style={{ transform: `scale(${createCoverZoom})` }}
                      />
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="2.5"
                      step="0.05"
                      value={createCoverZoom}
                      onChange={(e) => setCreateCoverZoom(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-white hover:bg-blue-700"
                >
                  Create Community
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>
);
};

export default CommunitiesPage;
