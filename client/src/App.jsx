import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthProvider from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RedirectAuth from './components/RedirectAuth';
import Navbar from './components/Navbar';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import FeedPage from './pages/FeedPage';
import FriendsPage from './pages/FriendsPage';
import MessagesPage from './pages/MessagesPage';
import CommunitiesPage from './pages/CommunitiesPage';
import CommunityManagementPage from './pages/CommunityManagementPage';
import CommunityDetailPage from './pages/CommunityDetailPage';
import ProfilePage from './pages/ProfilePage';
import CommonWall from './pages/CommonWall';
import PostDetailPage from './pages/PostDetailPage';
import SettingsPage from './pages/SettingsPage';
import ProfileRedirect from './components/ProfileRedirect';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-shell">
          <Navbar />
          <Routes>
            {/* Public routes - redirect if authenticated */}
            <Route path="/" element={
              <RedirectAuth>
                <LandingPage />
              </RedirectAuth>
            } />
            <Route path="/login" element={
              <RedirectAuth>
                <LoginPage />
              </RedirectAuth>
            } />
            <Route path="/register" element={
              <RedirectAuth>
                <RegisterPage />
              </RedirectAuth>
            } />
            <Route path="/forgot-password" element={
              <RedirectAuth>
                <ForgotPasswordPage />
              </RedirectAuth>
            } />
            
            {/* Protected routes */}
            <Route path="/feed" element={
              <ProtectedRoute>
                <FeedPage />
              </ProtectedRoute>
            } />
            <Route path="/communities" element={
              <ProtectedRoute>
                <CommunitiesPage />
              </ProtectedRoute>
            } />
            <Route path="/communities/:communityName" element={
              <ProtectedRoute>
                <CommunityDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/r/:communityName" element={
              <ProtectedRoute>
                <CommunityDetailPage />
              </ProtectedRoute>
            } />
            {/* ID-based routes first (backward compatibility) */}
            <Route path="/community/:id" element={
              <ProtectedRoute>
                <CommunitiesPage />
              </ProtectedRoute>
            } />
            <Route path="/community/:id/manage" element={
              <ProtectedRoute>
                <CommunityManagementPage />
              </ProtectedRoute>
            } />
            {/* Name-based routes second */}
            <Route path="/community/:communityName" element={
              <ProtectedRoute>
                <CommunitiesPage />
              </ProtectedRoute>
            } />
            <Route path="/community/:communityName/manage" element={
              <ProtectedRoute>
                <CommunityManagementPage />
              </ProtectedRoute>
            } />
            <Route path="/r/:communityName/manage" element={
              <ProtectedRoute>
                <CommunityManagementPage />
              </ProtectedRoute>
            } />
            <Route path="/requests" element={
              <ProtectedRoute>
                <FriendsPage />
              </ProtectedRoute>
            } />
            <Route path="/wall" element={
              <ProtectedRoute>
                <CommonWall />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfileRedirect />
              </ProtectedRoute>
            } />
            <Route path="/inbox" element={
              <ProtectedRoute>
                <MessagesPage />
              </ProtectedRoute>
            } />
            <Route path="/inbox/:conversationId" element={
              <ProtectedRoute>
                <MessagesPage />
              </ProtectedRoute>
            } />
            <Route path="/profile/:username" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            } />
            <Route path="/p/:headline/:dateAndToken" element={
              <ProtectedRoute>
                <PostDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/p/:legacyId" element={
              <ProtectedRoute>
                <PostDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/c/:communitySlug/:headline/:dateAndToken" element={
              <ProtectedRoute>
                <PostDetailPage />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
