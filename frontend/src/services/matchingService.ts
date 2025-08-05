import axios from 'axios';
import { PotentialMatch, MatchingPreferences } from '../types/api';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class MatchingService {
  private getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getPotentialMatches(limit: number = 20, offset: number = 0): Promise<PotentialMatch[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/matching/potential`, {
        params: { limit, offset },
        headers: this.getAuthHeaders(),
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching potential matches:', error);
      throw error;
    }
  }

  async createMatch(
    targetUserId: string,
    compatibilityScore: number
  ): Promise<{ id: string; status: string; createdAt: Date }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/matching/match`,
        { targetUserId, compatibilityScore },
        { headers: this.getAuthHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error creating match:', error);
      throw error;
    }
  }

  async getUserMatches(
    page: number = 1,
    limit: number = 20
  ): Promise<
    Array<{
      id: string;
      userId: string;
      targetUserId: string;
      status: string;
      compatibilityScore: number;
    }>
  > {
    try {
      const response = await axios.get(`${API_BASE_URL}/matching/matches`, {
        params: { page, limit },
        headers: this.getAuthHeaders(),
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching user matches:', error);
      throw error;
    }
  }

  async getMatchStats(): Promise<{
    totalMatches: number;
    activeMatches: number;
    avgCompatibilityScore: number;
  }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/matching/stats`, {
        headers: this.getAuthHeaders(),
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching match stats:', error);
      throw error;
    }
  }

  async archiveMatch(matchId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/matching/matches/${matchId}/archive`,
        {},
        { headers: this.getAuthHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error archiving match:', error);
      throw error;
    }
  }

  async getPreferences(): Promise<MatchingPreferences> {
    try {
      const response = await axios.get(`${API_BASE_URL}/matching/preferences`, {
        headers: this.getAuthHeaders(),
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching preferences:', error);
      throw error;
    }
  }

  async updatePreferences(preferences: Partial<MatchingPreferences>): Promise<MatchingPreferences> {
    try {
      const response = await axios.put(`${API_BASE_URL}/matching/preferences`, preferences, {
        headers: this.getAuthHeaders(),
      });
      return response.data.data;
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  async calculateCompatibility(
    targetUserId: string
  ): Promise<{ score: number; factors: Record<string, number> }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/matching/compatibility/${targetUserId}`, {
        headers: this.getAuthHeaders(),
      });
      return response.data.data;
    } catch (error) {
      console.error('Error calculating compatibility:', error);
      throw error;
    }
  }
}

export const matchingService = new MatchingService();
