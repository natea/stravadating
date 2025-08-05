import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';

const SystemHealth: React.FC = () => {
  const [health, setHealth] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadHealth = async () => {
    try {
      setIsLoading(true);
      const response = await adminService.getSystemHealth();
      // Handle the actual response structure from backend
      setHealth(response);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load system health:', error);
      // Set default health data on error
      setHealth({
        status: 'unknown',
        database: { status: 'unknown' },
        server: {
          memory: { used: 0, total: 1, percentage: 0 },
          uptime: 0,
        },
        services: {},
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'down':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (isLoading && !health) {
    return <div className="text-center p-8">Loading system health...</div>;
  }

  if (!health) {
    return <div className="text-center p-8">Failed to load system health</div>;
  }

  // Safely access nested properties with defaults
  const server = health.server || { memory: { used: 0, total: 1, percentage: 0 }, uptime: 0 };
  const memoryUsagePercent =
    server.memory?.percentage || ((server.memory?.used || 0) / (server.memory?.total || 1)) * 100;
  const uptimeHours = Math.floor((server.uptime || 0) / 3600);
  const uptimeDays = Math.floor(uptimeHours / 24);

  // Get service statuses with safe defaults
  const databaseStatus = health.database?.status || 'unknown';
  const redisStatus = health.services?.redis?.status || 'unknown';
  const stravaStatus = health.services?.strava?.status || 'unknown';

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">System Health</h2>

      <div className="mb-4 text-sm text-gray-600">
        Last updated: {lastUpdate.toLocaleTimeString()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Database</h3>
          <div className="flex items-center">
            <span className={`w-3 h-3 rounded-full ${getStatusColor(databaseStatus)} mr-2`}></span>
            <span className="capitalize">{databaseStatus}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Redis Cache</h3>
          <div className="flex items-center">
            <span className={`w-3 h-3 rounded-full ${getStatusColor(redisStatus)} mr-2`}></span>
            <span className="capitalize">{redisStatus}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Strava API</h3>
          <div className="flex items-center">
            <span className={`w-3 h-3 rounded-full ${getStatusColor(stravaStatus)} mr-2`}></span>
            <span className="capitalize">{stravaStatus}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Server Metrics</h3>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Uptime</span>
              <span className="text-sm">
                {uptimeDays}d {uptimeHours % 24}h
              </span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Memory Usage</span>
              <span className="text-sm">{memoryUsagePercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${memoryUsagePercent > 80 ? 'bg-red-500' : memoryUsagePercent > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${memoryUsagePercent}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {((server.memory?.used || 0) / 1024).toFixed(2)} GB /
              {((server.memory?.total || 0) / 1024).toFixed(2)} GB
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">CPU Usage</span>
              <span className="text-sm">{(server.cpu || 0).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${(server.cpu || 0) > 80 ? 'bg-red-500' : (server.cpu || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${server.cpu || 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={loadHealth}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh Now
        </button>
      </div>
    </div>
  );
};

export default SystemHealth;
