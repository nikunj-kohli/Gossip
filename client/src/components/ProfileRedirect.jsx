import React from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const ProfileRedirect = () => {
  const { user, loading } = React.useContext(AuthContext);

  if (loading) {
    return null;
  }

  if (!user?.username) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={`/profile/${user.username}`} replace />;
};

export default ProfileRedirect;
