import React from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const SettingsPage = () => {
  const { user } = React.useContext(AuthContext);

  return (
    <div className="min-h-screen bg-[#f7f4ee] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="editorial-card p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[#0F766E] font-semibold">Account</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-sm text-gray-600">
            Basic account settings will live here.
          </p>

          <div className="mt-6 rounded-lg border border-[#d8d2c6] bg-white p-4">
            <div className="text-sm text-gray-500">Signed in as</div>
            <div className="mt-1 font-semibold text-gray-900">{user?.displayName || user?.username || 'Unknown user'}</div>
            <div className="text-sm text-gray-600">{user?.email || 'No email available'}</div>
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
