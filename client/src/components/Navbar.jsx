import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const Navbar = () => {
  const { user, logout, isAuthenticated } = React.useContext(AuthContext);
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isRouteActive = (routeKey) => {
    const path = location.pathname;
    if (routeKey === 'feed') return path === '/feed';
    if (routeKey === 'wall') return path === '/wall';
    if (routeKey === 'requests') return path.startsWith('/requests');
    if (routeKey === 'inbox') return path.startsWith('/inbox');
    if (routeKey === 'communities') {
      return path.startsWith('/communities') || path.startsWith('/community') || path.startsWith('/r/');
    }
    return false;
  };

  const desktopNavClass = (routeKey) => (
    `${isRouteActive(routeKey)
      ? 'border-[#E4572E] text-[#1D232E]'
      : 'border-transparent text-[#5B6472] hover:border-[#D8D2C6] hover:text-[#1D232E]'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold tracking-wide`
  );

  const mobileNavClass = (routeKey) => (
    `${isRouteActive(routeKey)
      ? 'bg-[#ffede8] border-[#E4572E] text-[#1D232E]'
      : 'border-transparent text-[#5B6472] hover:bg-[#f6f4ef] hover:border-[#D8D2C6] hover:text-[#1D232E]'} block pl-3 pr-4 py-2 border-l-4 text-base font-medium`
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="glass-nav sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <h1 className="text-2xl font-bold text-[#1D232E]">Gossip</h1>
            </Link>

            {isAuthenticated && (
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link to="/feed" className={desktopNavClass('feed')}>Feed</Link>
                <Link to="/wall" className={desktopNavClass('wall')}>Wall</Link>
                <Link to="/requests" className={desktopNavClass('requests')}>Requests</Link>
                <Link to="/communities" className={desktopNavClass('communities')}>Communities</Link>
                <Link to="/inbox" className={desktopNavClass('inbox')}>Inbox</Link>
              </div>
            )}
          </div>

          <div className="flex items-center">
            {isAuthenticated ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen((v) => !v)}
                  className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <img
                    className="h-8 w-8 rounded-full"
                    src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.displayName || user?.username}&background=6366f1&color=fff`}
                    alt={user?.displayName || user?.username}
                  />
                  <span className="ml-2 text-[#1D232E] font-semibold">{user?.displayName || user?.username}</span>
                </button>

                <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-[#FFFDF8] ring-1 ring-[#D8D2C6] ${isDropdownOpen ? '' : 'hidden'}`}>
                  <div className="py-1">
                    <Link to={`/profile/${user?.username}`} onClick={() => setIsDropdownOpen(false)} className="block px-4 py-2 text-sm text-[#1D232E] hover:bg-[#f6f4ef]">Your Profile</Link>
                    <Link to="/settings" onClick={() => setIsDropdownOpen(false)} className="block px-4 py-2 text-sm text-[#1D232E] hover:bg-[#f6f4ef]">Settings</Link>
                    <button
                      onClick={() => {
                        logout();
                        setIsDropdownOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-[#1D232E] hover:bg-[#f6f4ef]"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link to="/login" className="text-[#5B6472] hover:text-[#1D232E] px-3 py-2 rounded-md text-sm font-medium">Sign in</Link>
                <Link to="/register" className="bg-[#E4572E] hover:bg-[#cb4d2a] text-white px-4 py-2 rounded-md text-sm font-semibold">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {isAuthenticated && (
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            <Link to="/feed" className={mobileNavClass('feed')}>Feed</Link>
            <Link to="/wall" className={mobileNavClass('wall')}>Wall</Link>
            <Link to="/requests" className={mobileNavClass('requests')}>Requests</Link>
            <Link to="/communities" className={mobileNavClass('communities')}>Communities</Link>
            <Link to="/inbox" className={mobileNavClass('inbox')}>Inbox</Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
