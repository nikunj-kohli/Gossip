import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthProvider from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RedirectAuth from './components/RedirectAuth';
import Navbar from './components/Navbar';
import { SkeletonBlock, SkeletonCard } from './components/Skeletons';

// Pages

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const CommunitiesPage = lazy(() => import('./pages/CommunitiesPage'));
const CommunityManagementPage = lazy(() => import('./pages/CommunityManagementPage'));
const CommunityDetailPage = lazy(() => import('./pages/CommunityDetailPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CommonWall = lazy(() => import('./pages/CommonWall'));
const PostDetailPage = lazy(() => import('./pages/PostDetailPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ProfileRedirect = lazy(() => import('./components/ProfileRedirect'));
import './App.css';

const RouteFallback = () => (
  <div className="min-h-[60vh] bg-gray-100">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonCard avatar media lines={3} footer />
      <SkeletonCard avatar media lines={3} footer />
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-shell">
          <Navbar />
          <Suspense fallback={<RouteFallback />}>
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
          </Suspense>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
