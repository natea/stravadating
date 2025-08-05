import { api } from './api';

export interface FitnessThreshold {
  id: string;
  name: string;
  description: string;
  metricType: 'distance' | 'activities' | 'pace' | 'duration';
  threshold: number;
  comparisonOperator: 'gte' | 'lte' | 'eq';
  timeWindowDays: number;
  isActive: boolean;
  priority: number;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalMatches: number;
  activeMatches: number;
  avgCompatibilityScore: number;
  totalMessages: number;
  pendingApprovals: number;
  dailySignups: number;
  acceptanceRate: number;
  averageFitnessScore: number;
}

export const adminService = {
  // Fitness Thresholds
  async getThresholds(): Promise<FitnessThreshold[]> {
    try {
      const response = await api.get('/admin/thresholds');
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching thresholds:', error);
      return [];
    }
  },

  async getThreshold(): Promise<FitnessThreshold | null> {
    try {
      const response = await api.get('/admin/threshold');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching threshold:', error);
      return null;
    }
  },

  async createThreshold(threshold: FitnessThreshold): Promise<FitnessThreshold> {
    // Use PUT to update/create threshold (backend doesn't have POST)
    const response = await api.put('/admin/threshold', threshold);
    return response.data.data;
  },

  async updateThreshold(
    id: string,
    threshold: Partial<FitnessThreshold>
  ): Promise<FitnessThreshold> {
    // Use PUT for all threshold updates
    const response = await api.put('/admin/threshold', threshold);
    return response.data.data;
  },

  async deleteThreshold(id: string): Promise<void> {
    await api.delete(`/admin/threshold/${id}`);
  },

  // Statistics
  async getStats(): Promise<AdminStats> {
    const response = await api.get('/admin/stats');
    return response.data.data;
  },

  async getDashboardStats(): Promise<AdminStats> {
    const response = await api.get('/admin/stats');
    return response.data.data;
  },

  // User Management
  async getUsers(page: number = 1, limit: number = 20) {
    const response = await api.get('/admin/users', {
      params: { page, limit },
    });
    // Return the data structure from backend
    return response.data.data || response.data;
  },

  async suspendUser(userId: string, reason: string) {
    const response = await api.post(`/admin/users/${userId}/suspend`, {
      reason,
    });
    return response.data;
  },

  async unsuspendUser(userId: string) {
    const response = await api.post(`/admin/users/${userId}/unsuspend`);
    return response.data;
  },

  // Match Management
  async getMatches(page: number = 1, limit: number = 20) {
    const response = await api.get('/admin/matches', {
      params: { page, limit },
    });
    return response.data;
  },

  async reviewMatch(matchId: string) {
    const response = await api.get(`/admin/matches/${matchId}`);
    return response.data;
  },

  // Activity Logs
  async getActivityLogs(page: number = 1, limit: number = 50) {
    const response = await api.get('/admin/logs', {
      params: { page, limit },
    });
    return response.data;
  },

  // System Health
  async getSystemHealth() {
    const response = await api.get('/admin/health');
    return response.data;
  },
};
