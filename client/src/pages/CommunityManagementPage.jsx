import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import {
  getCommunityById,
  getCommunityByName,
  updateGroup,
  deleteGroup,
  uploadPostMedia,
  getCommunityMembers,
  getBannedCommunityMembers,
  banCommunityMember,
  unbanCommunityMember,
  changeCommunityMemberRole,
  removeCommunityMember,
} from '../api';
import { SkeletonBlock, SkeletonCard } from '../components/Skeletons';
import { cropImageToBlob } from '../utils/imageCrop';

const CommunityManagementPage = () => {
  const { user } = React.useContext(AuthContext);
  const { communityName, id } = useParams();
  const navigate = useNavigate();
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [members, setMembers] = useState([]);
  const [bannedMembers, setBannedMembers] = useState([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privacy: 'public',
    avatarUrl: '',
    coverUrl: '',
  });
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [coverPreview, setCoverPreview] = useState('');
  const [coverZoom, setCoverZoom] = useState(1);

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

  const loadMembers = async (groupId) => {
    if (!groupId) return;
    setMemberLoading(true);
    try {
      const [membersRes, bannedRes] = await Promise.all([
        getCommunityMembers(groupId),
        getBannedCommunityMembers(groupId),
      ]);

      setMembers(Array.isArray(membersRes.data?.members) ? membersRes.data.members : []);
      setBannedMembers(Array.isArray(bannedRes.data?.bannedMembers) ? bannedRes.data.bannedMembers : []);
    } catch (error) {
      setMembers([]);
      setBannedMembers([]);
    } finally {
      setMemberLoading(false);
    }
  };

  useEffect(() => {
    if (community?.id) {
      loadMembers(community.id);
    }
  }, [community?.id]);

  const setFilePreview = (file, onPreview, onZoom) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onPreview(String(reader.result || ''));
      onZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const uploadCropped = async ({ preview, zoom, width, height, baseName }) => {
    if (!preview) return null;
    const blob = await cropImageToBlob({
      dataUrl: preview,
      zoom,
      outputWidth: width,
      outputHeight: height,
    });
    if (!blob) return null;
    const file = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
    const uploadRes = await uploadPostMedia(file);
    if (uploadRes.error || !uploadRes.data?.url) {
      throw new Error(uploadRes.error?.response?.data?.message || uploadRes.error?.message || 'Failed to upload media');
    }
    return uploadRes.data.url;
  };

  const handleUpdateCommunity = async (e) => {
    e.preventDefault();
    
    if (!community) return;
    
    try {
      const payload = { ...formData };

      if (avatarPreview) {
        payload.avatarUrl = await uploadCropped({
          preview: avatarPreview,
          zoom: avatarZoom,
          width: 512,
          height: 512,
          baseName: `${community.name || 'community'}-avatar`,
        });
      }

      if (coverPreview) {
        payload.coverUrl = await uploadCropped({
          preview: coverPreview,
          zoom: coverZoom,
          width: 1200,
          height: 400,
          baseName: `${community.name || 'community'}-cover`,
        });
      }

      const { data, error } = await updateGroup(community.id, payload);
      
      if (error) {
        console.error('Error updating community:', error);
        alert(error.message || 'Failed to update community');
      } else {
        alert('Community updated successfully!');
        setCommunity(data.group);
        setAvatarPreview('');
        setCoverPreview('');
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

  const handleMemberRoleChange = async (memberUserId, role) => {
    const { error } = await changeCommunityMemberRole(community.id, memberUserId, role);
    if (error) {
      alert(error.response?.data?.message || 'Failed to update role');
      return;
    }
    await loadMembers(community.id);
  };

  const handleBanMember = async (memberUserId) => {
    const { error } = await banCommunityMember(community.id, memberUserId);
    if (error) {
      alert(error.response?.data?.message || 'Failed to ban member');
      return;
    }
    await loadMembers(community.id);
  };

  const handleUnbanMember = async (memberUserId) => {
    const { error } = await unbanCommunityMember(community.id, memberUserId);
    if (error) {
      alert(error.response?.data?.message || 'Failed to unban member');
      return;
    }
    await loadMembers(community.id);
  };

  const handleRemoveMember = async (memberUserId) => {
    const confirmed = window.confirm('Remove this member from the community?');
    if (!confirmed) return;
    const { error } = await removeCommunityMember(community.id, memberUserId);
    if (error) {
      alert(error.response?.data?.message || 'Failed to remove member');
      return;
    }
    await loadMembers(community.id);
  };

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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Avatar (1:1)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => setFilePreview(e.target.files?.[0], setAvatarPreview, setAvatarZoom)}
                  />
                  <p className="mt-1 text-xs text-gray-500">Square avatars stay crisp in community cards.</p>
                  {avatarPreview && (
                    <div className="mt-3 space-y-2">
                      <div className="h-28 w-28 overflow-hidden rounded-xl border border-gray-200">
                        <img src={avatarPreview} alt="Avatar preview" className="h-full w-full object-cover" style={{ transform: `scale(${avatarZoom})` }} />
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="2.5"
                        step="0.05"
                        value={avatarZoom}
                        onChange={(e) => setAvatarZoom(Number(e.target.value))}
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
                    onChange={(e) => setFilePreview(e.target.files?.[0], setCoverPreview, setCoverZoom)}
                  />
                  <p className="mt-1 text-xs text-gray-500">Wide banners are the best fit for the top cover section.</p>
                  {coverPreview && (
                    <div className="mt-3 space-y-2">
                      <div className="h-24 w-full overflow-hidden rounded-xl border border-gray-200">
                        <img src={coverPreview} alt="Cover preview" className="h-full w-full object-cover" style={{ transform: `scale(${coverZoom})` }} />
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="2.5"
                        step="0.05"
                        value={coverZoom}
                        onChange={(e) => setCoverZoom(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  )}
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
                  <p className="text-gray-600">{members.length} active members</p>
                </div>
              </div>
            )}

            {canManage && (
              <div className="mt-8 border-t pt-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Manage Members</h3>
                  {memberLoading ? (
                    <p className="text-sm text-gray-500">Loading members...</p>
                  ) : members.length === 0 ? (
                    <p className="text-sm text-gray-500">No members found.</p>
                  ) : (
                    <div className="space-y-2">
                      {members.map((member) => (
                        <div key={member.user_id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.display_name || member.username)}&background=3B82F6&color=fff`}
                              alt={member.display_name || member.username}
                              className="h-9 w-9 rounded-full object-cover border border-gray-200"
                              loading="lazy"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{member.display_name || member.username}</p>
                              <p className="text-xs text-gray-500">@{member.username} · {member.role}</p>
                            </div>
                          </div>
                          {String(member.user_id) !== String(user?.id) && (
                            <div className="flex items-center gap-2">
                              <select
                                value={member.role}
                                onChange={(e) => handleMemberRoleChange(member.user_id, e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded text-xs"
                              >
                                <option value="member">Member</option>
                                <option value="moderator">Moderator</option>
                                <option value="admin">Admin</option>
                              </select>
                              <button
                                onClick={() => handleBanMember(member.user_id)}
                                className="px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs hover:bg-amber-200"
                              >
                                Ban
                              </button>
                              <button
                                onClick={() => handleRemoveMember(member.user_id)}
                                className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs hover:bg-red-200"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Banned Members</h3>
                  {bannedMembers.length === 0 ? (
                    <p className="text-sm text-gray-500">No banned members.</p>
                  ) : (
                    <div className="space-y-2">
                      {bannedMembers.map((member) => (
                        <div key={`banned-${member.user_id}`} className="border rounded-lg p-3 flex items-center justify-between gap-3 bg-amber-50/40">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{member.display_name || member.username}</p>
                            <p className="text-xs text-gray-500">@{member.username}</p>
                          </div>
                          <button
                            onClick={() => handleUnbanMember(member.user_id)}
                            className="px-3 py-1 rounded bg-emerald-100 text-emerald-800 text-xs hover:bg-emerald-200"
                          >
                            Unban
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
