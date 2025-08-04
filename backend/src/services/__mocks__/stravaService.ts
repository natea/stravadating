import { StravaActivity, StravaAthlete, StravaTokens } from '../../types/strava';
import { FitnessStats } from '../../types/fitness';

export class StravaService {
  async refreshAccessToken(_refreshToken: string): Promise<StravaTokens> {
    return {
      accessToken: 'mock_new_access_token',
      refreshToken: 'mock_new_refresh_token',
      expiresAt: Date.now() / 1000 + 3600,
    };
  }

  async fetchAthleteProfile(_accessToken: string): Promise<StravaAthlete> {
    return {
      id: 12345,
      username: 'mockuser',
      firstname: 'Mock',
      lastname: 'User',
      city: 'Mock City',
      state: 'Mock State',
      country: 'Mock Country',
      sex: 'M',
      profile: 'https://example.com/profile.jpg',
      profile_medium: 'https://example.com/profile_medium.jpg',
    };
  }

  async fetchAthleteActivities(
    _accessToken: string,
    _after?: Date,
    _before?: Date,
    _page: number = 1,
    perPage: number = 200
  ): Promise<StravaActivity[]> {
    const mockActivities: StravaActivity[] = [
      {
        id: 1,
        userId: '',
        name: 'Mock Morning Run',
        type: 'Run',
        distance: 5000,
        movingTime: 1800,
        averageSpeed: 2.78,
        startDate: new Date('2024-01-01T08:00:00Z'),
        elevationGain: 100,
        syncedAt: new Date(),
      },
      {
        id: 2,
        userId: '',
        name: 'Mock Evening Bike',
        type: 'Ride',
        distance: 20000,
        movingTime: 3600,
        averageSpeed: 5.56,
        startDate: new Date('2024-01-02T18:00:00Z'),
        elevationGain: 200,
        syncedAt: new Date(),
      },
    ];

    return mockActivities.slice(0, perPage);
  }

  async fetchLast90DaysActivities(_accessToken: string): Promise<StravaActivity[]> {
    const mockActivities: StravaActivity[] = [];
    
    // Generate 30 mock activities over 90 days
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (i * 3)); // Every 3 days

      mockActivities.push({
        id: i + 1,
        userId: '',
        name: `Mock Activity ${i + 1}`,
        type: i % 3 === 0 ? 'Run' : i % 3 === 1 ? 'Ride' : 'Swim',
        distance: 5000 + (i * 100),
        movingTime: 1800 + (i * 60),
        averageSpeed: 2.5 + (i * 0.1),
        startDate: date,
        elevationGain: 50 + (i * 10),
        syncedAt: new Date(),
      });
    }

    return mockActivities;
  }

  calculateFitnessMetrics(activities: StravaActivity[]): Omit<FitnessStats, 'id' | 'userId'> {
    if (activities.length === 0) {
      return {
        weeklyDistance: 0,
        weeklyActivities: 0,
        averagePace: 0,
        favoriteActivities: [],
        totalDistance: 0,
        longestRun: 0,
        lastSyncDate: new Date(),
      };
    }

    const totalDistance = activities.reduce((sum, activity) => sum + activity.distance, 0);
    const weeklyDistance = totalDistance / 13;
    const weeklyActivities = activities.length / 13;

    const runningActivities = activities.filter(a => 
      a.type.toLowerCase().includes('run') && a.averageSpeed > 0
    );
    
    let averagePace = 0;
    if (runningActivities.length > 0) {
      const totalPace = runningActivities.reduce((sum, activity) => {
        return sum + (1000 / activity.averageSpeed);
      }, 0);
      averagePace = totalPace / runningActivities.length;
    }

    const activityTypeCount = new Map<string, number>();
    activities.forEach(activity => {
      const count = activityTypeCount.get(activity.type) || 0;
      activityTypeCount.set(activity.type, count + 1);
    });

    const favoriteActivities = Array.from(activityTypeCount.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type]) => type);

    const longestRun = Math.max(
      ...activities
        .filter(a => a.type.toLowerCase().includes('run'))
        .map(a => a.distance),
      0
    );

    return {
      weeklyDistance,
      weeklyActivities,
      averagePace,
      favoriteActivities,
      totalDistance,
      longestRun,
      lastSyncDate: new Date(),
    };
  }

  getRecentActivities(activities: StravaActivity[], limit: number = 10): StravaActivity[] {
    return activities
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .slice(0, limit);
  }

  getRateLimitStatus() {
    return {
      shortTermUsage: 10,
      shortTermLimit: 600,
      dailyUsage: 100,
      dailyLimit: 30000,
    };
  }

  canMakeRequest(): boolean {
    return true;
  }
}

export const createStravaService = () => new StravaService();
export const stravaService = new StravaService();