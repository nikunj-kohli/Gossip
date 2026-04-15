import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import {
  getFeedPreferences,
  updateFeedPreferences,
  getNotificationPreferences,
  updateNotificationPreference,
  updateMyProfile,
  uploadPostMedia,
} from '../api';
import { cropImageToBlob } from '../utils/imageCrop';

const SettingsPage = () => {
  const { user, updateUser } = React.useContext(AuthContext);
  const avatarInputRef = useRef(null);

  const [profileForm, setProfileForm] = useState({
    displayName: user?.displayName || user?.username || '',
    bio: user?.bio || '',
    avatarUrl: user?.avatar_url || '',
  });
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFileName, setAvatarFileName] = useState('');
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [savingProfile, setSavingProfile] = useState(false);

  const [notificationPrefs, setNotificationPrefs] = useState({});
  const [savingNotifications, setSavingNotifications] = useState(false);

  const [feedPrefs, setFeedPrefs] = useState({
    pulse_ratio: 0.5,
    tribes_ratio: 0.3,
    discover_ratio: 0.2,
  });
  const [savingFeed, setSavingFeed] = useState(false);
  const [banner, setBanner] = useState('');

  const avatarDisplay = avatarPreview || profileForm.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileForm.displayName || user?.username || 'User')}&background=3B82F6&color=fff`;

  const feedPercent = useMemo(() => {
    return {
      pulse: Math.round(Number(feedPrefs.pulse_ratio || 0) * 100),
      tribes: Math.round(Number(feedPrefs.tribes_ratio || 0) * 100),
      discover: Math.round(Number(feedPrefs.discover_ratio || 0) * 100),
    };
  }, [feedPrefs]);

  useEffect(() => {
    const load = async () => {
      const [feedRes, notifRes] = await Promise.all([
        getFeedPreferences(),
        getNotificationPreferences(),
      ]);

      if (!feedRes.error && feedRes.data) {
        setFeedPrefs({
          pulse_ratio: Number(feedRes.data.pulse_ratio ?? feedRes.data.pulse ?? 0.5),
          tribes_ratio: Number(feedRes.data.tribes_ratio ?? feedRes.data.tribes ?? 0.3),
          discover_ratio: Number(feedRes.data.discover_ratio ?? feedRes.data.discover ?? 0.2),
        });
      }

      if (!notifRes.error && Array.isArray(notifRes.data)) {
        const mapped = notifRes.data.reduce((acc, row) => {
          acc[row.notification_type] = row.status === 'enabled';
          return acc;
        }, {});
        setNotificationPrefs(mapped);
      }
    };

    load();
  }, []);

  const onSelectAvatar = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(String(reader.result || ''));
      setAvatarFileName(file.name);
      setAvatarZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      let avatarUrl = profileForm.avatarUrl;

      if (avatarPreview) {
        const blob = await cropImageToBlob({
          dataUrl: avatarPreview,
          zoom: avatarZoom,
          outputWidth: 512,
          outputHeight: 512,
        });

        if (blob) {
          const file = new File([blob], (avatarFileName || 'avatar').replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
          const uploadResult = await uploadPostMedia(file);
          if (uploadResult.error || !uploadResult.data?.url) {
            setBanner('Failed to upload avatar');
            return;
          }
          avatarUrl = uploadResult.data.url;
        }
      }

      const payload = {
        displayName: profileForm.displayName,
        bio: profileForm.bio,
        avatarUrl,
      };

      const result = await updateMyProfile(payload);
      if (result.error || !result.data?.user) {
        setBanner(result.error?.response?.data?.message || 'Failed to save profile');
        return;
      }

      const nextUser = {
        ...user,
        displayName: result.data.user.displayName,
        bio: result.data.user.bio,
        avatar_url: result.data.user.avatar_url,
      };
      updateUser(nextUser);
      setProfileForm((prev) => ({ ...prev, avatarUrl: result.data.user.avatar_url || prev.avatarUrl }));
      setAvatarPreview('');
      setAvatarFileName('');
      setBanner('Profile settings saved');
    } catch (error) {
      setBanner('Failed to save profile settings');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveNotifications = async () => {
    try {
      setSavingNotifications(true);
      const updates = Object.entries(notificationPrefs).map(([type, enabled]) => (
        updateNotificationPreference({ type, status: enabled ? 'enabled' : 'disabled' })
      ));

      await Promise.all(updates);
      setBanner('Notification preferences saved');
    } catch (error) {
      setBanner('Failed to save notification preferences');
    } finally {
      setSavingNotifications(false);
    }
  };

  const saveFeed = async () => {
    try {
      setSavingFeed(true);
      const total = Number(feedPrefs.pulse_ratio || 0) + Number(feedPrefs.tribes_ratio || 0) + Number(feedPrefs.discover_ratio || 0);
      const normalized = total > 0
        ? {
            pulse_ratio: Number(feedPrefs.pulse_ratio || 0) / total,
            tribes_ratio: Number(feedPrefs.tribes_ratio || 0) / total,
            discover_ratio: Number(feedPrefs.discover_ratio || 0) / total,
          }
        : { pulse_ratio: 0.5, tribes_ratio: 0.3, discover_ratio: 0.2 };

      const result = await updateFeedPreferences(normalized);
      if (result.error) {
        setBanner('Failed to save feed preferences');
        return;
      }

      setFeedPrefs({
        pulse_ratio: Number(result.data?.pulse_ratio ?? normalized.pulse_ratio),
        tribes_ratio: Number(result.data?.tribes_ratio ?? normalized.tribes_ratio),
        discover_ratio: Number(result.data?.discover_ratio ?? normalized.discover_ratio),
      });
      setBanner('Feed preferences saved');
    } catch (error) {
      setBanner('Failed to save feed preferences');
    } finally {
      setSavingFeed(false);
    }
  };

  const notificationItems = [
    { key: 'like', label: 'Likes' },
    { key: 'comment', label: 'Comments' },
    { key: 'friend_request', label: 'Friend requests' },
    { key: 'friend_accepted', label: 'Request accepted' },
    { key: 'post_mention', label: 'Post mentions' },
    { key: 'comment_mention', label: 'Comment mentions' },
    { key: 'group_invite', label: 'Group invites' },
    { key: 'group_post', label: 'Community posts' },
  ];

  return (
    <div className="min-h-screen bg-[#f7f4ee] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="editorial-card p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[#0F766E] font-semibold">Account</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-sm text-gray-600">
            Control your account details, notifications, and feed defaults.
          </p>

          {banner && (
            <div className="mt-4 rounded-md border border-[#d8d2c6] bg-white px-4 py-2 text-sm text-gray-700">
              {banner}
            </div>
          )}

          <div className="mt-6 rounded-lg border border-[#d8d2c6] bg-white p-4 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Profile</h2>
            <div className="flex items-start gap-4">
              <img src={avatarDisplay} alt="Profile" className="h-20 w-20 rounded-full border border-[#d8d2c6] object-cover" />
              <div className="flex-1 space-y-3">
                <input
                  type="file"
                  ref={avatarInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => onSelectAvatar(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-3 py-2 rounded-md bg-gray-100 text-gray-800 text-sm font-medium hover:bg-gray-200"
                >
                  Change avatar
                </button>
                {avatarPreview && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Zoom crop</label>
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
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Display name</label>
                <input
                  type="text"
                  value={profileForm.displayName}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, displayName: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#d8d2c6] rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bio</label>
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-[#d8d2c6] rounded-md"
                />
              </div>
              <button
                type="button"
                onClick={saveProfile}
                disabled={savingProfile}
                className="justify-self-start px-4 py-2 rounded-md bg-[#E4572E] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-60"
              >
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-[#d8d2c6] bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Notifications</h2>
            {notificationItems.map((item) => (
              <label key={item.key} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-800">{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(notificationPrefs[item.key])}
                  onChange={(e) => setNotificationPrefs((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>
            ))}
            <button
              type="button"
              onClick={saveNotifications}
              disabled={savingNotifications}
              className="px-4 py-2 rounded-md bg-[#E4572E] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-60"
            >
              {savingNotifications ? 'Saving...' : 'Save notifications'}
            </button>
          </div>

          <div className="mt-6 rounded-lg border border-[#d8d2c6] bg-white p-4 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Feed Mix</h2>
            <p className="text-xs text-gray-500">Tune how much of each feed type appears in your hybrid feed.</p>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm text-gray-700"><span>General</span><span>{feedPercent.pulse}%</span></div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={feedPrefs.pulse_ratio}
                  onChange={(e) => setFeedPrefs((prev) => ({ ...prev, pulse_ratio: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm text-gray-700"><span>Communities</span><span>{feedPercent.tribes}%</span></div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={feedPrefs.tribes_ratio}
                  onChange={(e) => setFeedPrefs((prev) => ({ ...prev, tribes_ratio: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm text-gray-700"><span>Discover</span><span>{feedPercent.discover}%</span></div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={feedPrefs.discover_ratio}
                  onChange={(e) => setFeedPrefs((prev) => ({ ...prev, discover_ratio: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={saveFeed}
              disabled={savingFeed}
              className="px-4 py-2 rounded-md bg-[#E4572E] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-60"
            >
              {savingFeed ? 'Saving...' : 'Save feed settings'}
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={user?.username ? `/profile/${user.username}` : '/profile'} className="px-4 py-2 rounded-md bg-[#E4572E] text-white font-semibold hover:brightness-95">
              View Profile
            </Link>
            <Link to="/feed" className="px-4 py-2 rounded-md bg-gray-100 text-gray-800 font-semibold hover:bg-gray-200">
              Back to Feed
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
