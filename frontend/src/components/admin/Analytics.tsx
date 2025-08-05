import React, { useState, useEffect } from 'react';
import { adminService, AdminStats } from '../../services/adminService';

const Analytics: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const data = await adminService.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center p-8">Loading analytics...</div>;
  }

  if (!stats) {
    return <div className="text-center p-8">Failed to load analytics</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Analytics Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Users</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalUsers}</p>
          <p className="text-sm text-gray-600 mt-2">Active: {stats.activeUsers}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Matches</h3>
          <p className="text-3xl font-bold text-green-600">{stats.totalMatches}</p>
          <p className="text-sm text-gray-600 mt-2">Active: {stats.activeMatches}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Messages</h3>
          <p className="text-3xl font-bold text-purple-600">{stats.totalMessages}</p>
          <p className="text-sm text-gray-600 mt-2">Total sent</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Avg Compatibility</h3>
          <p className="text-3xl font-bold text-orange-600">
            {(stats.avgCompatibilityScore * 100).toFixed(1)}%
          </p>
          <p className="text-sm text-gray-600 mt-2">Average match score</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">User Activity</h3>
          <p className="text-3xl font-bold text-indigo-600">
            {((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}%
          </p>
          <p className="text-sm text-gray-600 mt-2">Active user rate</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Match Success</h3>
          <p className="text-3xl font-bold text-pink-600">
            {((stats.activeMatches / stats.totalMatches) * 100).toFixed(1)}%
          </p>
          <p className="text-sm text-gray-600 mt-2">Active match rate</p>
        </div>
      </div>

      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-2">
          <p className="text-sm text-gray-600">• New users in last 24h: Coming soon</p>
          <p className="text-sm text-gray-600">• New matches in last 24h: Coming soon</p>
          <p className="text-sm text-gray-600">• Messages sent today: Coming soon</p>
          <p className="text-sm text-gray-600">• Peak activity time: Coming soon</p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
