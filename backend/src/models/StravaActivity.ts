import { prisma } from '../config/database';
import { StravaActivity, CreateStravaActivityInput, PaginationOptions, PaginatedResponse } from '../types';

export class StravaActivityModel {
  /**
   * Create a new Strava activity
   */
  static async create(data: CreateStravaActivityInput): Promise<StravaActivity> {
    return await prisma.stravaActivity.create({
      data,
    });
  }

  /**
   * Create multiple activities (bulk insert)
   */
  static async createMany(activities: CreateStravaActivityInput[]): Promise<number> {
    const result = await prisma.stravaActivity.createMany({
      data: activities,
      skipDuplicates: true,
    });
    return result.count;
  }

  /**
   * Find activity by ID
   */
  static async findById(id: number): Promise<StravaActivity | null> {
    return await prisma.stravaActivity.findUnique({
      where: { id },
    });
  }

  /**
   * Find activities by user ID
   */
  static async findByUserId(
    userId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<StravaActivity> | StravaActivity[]> {
    if (options) {
      const { page, limit } = options;
      const skip = (page - 1) * limit;

      const [activities, total] = await Promise.all([
        prisma.stravaActivity.findMany({
          where: { userId },
          skip,
          take: limit,
          orderBy: { startDate: 'desc' },
        }),
        prisma.stravaActivity.count({
          where: { userId },
        }),
      ]);

      return {
        data: activities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    return await prisma.stravaActivity.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Find activities by user ID within date range
   */
  static async findByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<StravaActivity[]> {
    return await prisma.stravaActivity.findMany({
      where: {
        userId,
        startDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Find activities by type
   */
  static async findByType(
    userId: string,
    activityType: string,
    limit?: number
  ): Promise<StravaActivity[]> {
    const query: any = {
      where: {
        userId,
        type: activityType,
      },
      orderBy: { startDate: 'desc' },
    };

    if (limit !== undefined) {
      query.take = limit;
    }

    return await prisma.stravaActivity.findMany(query);
  }

  /**
   * Delete activities by user ID
   */
  static async deleteByUserId(userId: string): Promise<number> {
    const result = await prisma.stravaActivity.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  /**
   * Delete activities older than specified date
   */
  static async deleteOlderThan(userId: string, date: Date): Promise<number> {
    const result = await prisma.stravaActivity.deleteMany({
      where: {
        userId,
        startDate: {
          lt: date,
        },
      },
    });
    return result.count;
  }

  /**
   * Get activity statistics for user
   */
  static async getActivityStats(userId: string, days: number = 90): Promise<{
    totalActivities: number;
    totalDistance: number;
    averageDistance: number;
    activityTypes: { type: string; count: number }[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activities = await prisma.stravaActivity.findMany({
      where: {
        userId,
        startDate: {
          gte: startDate,
        },
      },
    });

    const totalActivities = activities.length;
    const totalDistance = activities.reduce((sum, activity) => sum + activity.distance, 0);
    const averageDistance = totalActivities > 0 ? totalDistance / totalActivities : 0;

    // Group by activity type
    const typeMap = new Map<string, number>();
    activities.forEach(activity => {
      const count = typeMap.get(activity.type) || 0;
      typeMap.set(activity.type, count + 1);
    });

    const activityTypes = Array.from(typeMap.entries()).map(([type, count]) => ({
      type,
      count,
    }));

    return {
      totalActivities,
      totalDistance,
      averageDistance,
      activityTypes,
    };
  }

  /**
   * Get latest activity for user
   */
  static async getLatestActivity(userId: string): Promise<StravaActivity | null> {
    return await prisma.stravaActivity.findFirst({
      where: { userId },
      orderBy: { startDate: 'desc' },
    });
  }
}