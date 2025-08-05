import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './components/Login';
import AuthCallback from './components/AuthCallback';
import Dashboard from './components/Dashboard';
import ProfileComplete from './components/ProfileComplete';
import MatchingInterface from './components/MatchingInterface';
import ChatInterface from './components/ChatInterface';
import UserProfile from './components/UserProfile';
import AdminDashboard from './components/AdminDashboard';
import EditProfile from './components/EditProfile';
import DevLogin from './components/DevLogin';

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('authToken');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// Wrapper components to provide required props
const UserProfileWrapper: React.FC = () => {
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  // In a real app, you'd fetch this from the API
  const fitnessStats = {
    id: '1',
    userId: user?.id || '1',
    weeklyDistance: 50000,
    weeklyActivities: 5,
    averagePace: 5.5,
    favoriteActivities: ['Running', 'Cycling'],
    totalDistance: 500000,
    lastUpdated: new Date(),
  };

  return <UserProfile user={user} fitnessStats={fitnessStats} isCurrentUser={true} />;
};

const ChatInterfaceWrapper: React.FC = () => {
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  return <ChatInterface userId={user?.id || ''} />;
};

const AdminDashboardWrapper: React.FC = () => {
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  return <AdminDashboard adminUser={user} />;
};

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/dev-login" element={<DevLogin />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/complete"
            element={
              <ProtectedRoute>
                <ProfileComplete />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UserProfileWrapper />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute>
                <EditProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/matching"
            element={
              <ProtectedRoute>
                <MatchingInterface />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <ChatInterfaceWrapper />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboardWrapper />
              </ProtectedRoute>
            }
          />

          {/* Default route */}
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
