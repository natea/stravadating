import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { FitnessStats, User } from '../types/api';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [fitnessStats, setFitnessStats] = useState<FitnessStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Get user from localStorage or fetch from API
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        const userResponse = await api.get('/users/profile');
        setUser(userResponse.data.data);
        localStorage.setItem('user', JSON.stringify(userResponse.data.data));
      }

      // Fetch fitness stats
      const statsResponse = await api.get('/users/fitness-stats');
      setFitnessStats(statsResponse.data.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Welcome back, {user?.firstName}!</h1>
            <nav className="flex gap-4">
              <button
                onClick={() => navigate('/profile')}
                className="text-gray-600 hover:text-gray-900"
              >
                Profile
              </button>
              <button
                onClick={() => navigate('/matching')}
                className="text-gray-600 hover:text-gray-900"
              >
                Find Matches
              </button>
              <button
                onClick={() => navigate('/messages')}
                className="text-gray-600 hover:text-gray-900"
              >
                Messages
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  navigate('/login');
                }}
                className="text-red-600 hover:text-red-700"
              >
                Logout
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Weekly Distance</h3>
            <p className="text-3xl font-bold text-blue-600">
              {fitnessStats ? `${(fitnessStats.weeklyDistance / 1000).toFixed(1)} km` : '--'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Weekly Activities</h3>
            <p className="text-3xl font-bold text-green-600">
              {fitnessStats?.weeklyActivities || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Average Pace</h3>
            <p className="text-3xl font-bold text-purple-600">
              {fitnessStats?.averagePace ? `${fitnessStats.averagePace} min/km` : '--'}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Find Your Match</h2>
            <p className="text-gray-600 mb-4">
              Discover fitness enthusiasts who share your passion for staying active.
            </p>
            <button
              onClick={() => navigate('/matching')}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Start Matching
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Your Profile</h2>
            <p className="text-gray-600 mb-4">
              Keep your profile updated to attract compatible matches.
            </p>
            <button
              onClick={() => navigate('/profile')}
              className="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              Edit Profile
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            <p className="text-gray-600">• Last synced with Strava: Today</p>
            <p className="text-gray-600">• Profile views this week: Coming soon</p>
            <p className="text-gray-600">• New matches: Check the matching page</p>
            <p className="text-gray-600">• Unread messages: Check your messages</p>
          </div>
        </div>

        {/* Fitness Goals */}
        {user?.bio && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">About You</h2>
            <p className="text-gray-600">{user.bio}</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
