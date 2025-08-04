import { prisma } from '../config/database';
import { FitnessStats, CreateFitnessStatsInput, UpdateFitnessStatsInput } from '../types';

export class FitnessStatsModel {
  /**
   * Create fitness stats for a user
   */
  static async create(data: CreateFitnessStatsInput): Promise<FitnessStats> {
    const stats = await prisma.fitnessStats.create({
      data: {
        ...data,
        favoriteActivities: data.favoriteActivities || [],
      },
    });
    
    return {
      ...stats,
      favoriteActivities: Array.isArray(stats.favoriteActivities) ? stats.favoriteActivities as string[] : [],
    };
  }

  /**
   * Find fitness stats by user ID
   */
  static async findByUserId(userId: string): Promise<FitnessStats | null> {
    const stats = await prisma.fitnessStats.findUnique({
      where: { userId },
    });
    
    if (!stats) return null;
    
    return {
      ...stats,
      favoriteActivities: Array.isArray(stats.favoriteActivities) ? stats.favoriteActivities as string[] : [],
    };
  }

  /**
   * Update fitness stats
   */
  static async update(userId: string, data: UpdateFitnessStatsInput): Promise<FitnessStats> {
    const stats = await prisma.fitnessStats.update({
      where: { userId },
      data: {
        ...data,
        lastSyncDate: data.lastSyncDate || new Date(),
      },
    });
    
    return {
      ...stats,
      favoriteActivities: Array.isArray(stats.favoriteActivities) ? stats.favoriteActivities as string[] : [],
    };
  }

  /**
   * Delete fitness stats
   */
  static async delete(userId: string): Promise<void> {
    await prisma.fitnessStats.delete({
      where: { userId },
    });
  }

  /**
   * Upsert fitness stats (create or update)
   */
  static async upsert(userId: string, data: CreateFitnessStatsInput): Promise<FitnessStats> {
    const stats = await prisma.fitnessStats.upsert({
      where: { userId },
      update: {
        ...data,
        lastSyncDate: new Date(),
      },
      create: {
        ...data,
        favoriteActivities: data.favoriteActivities || [],
      },
    });
    
    return {
      ...stats,
      favoriteActivities: Array.isArray(stats.favoriteActivities) ? stats.favoriteActivities as string[] : [],
    };
  }

  /**
   * Get users with fitness stats above threshold
   */
  static async findUsersAboveThreshold(
    minWeeklyDistance: number,
    minWeeklyActivities: number
  ): Promise<FitnessStats[]> {
    return await prisma.fitnessStats.findMany({
      where: {
        AND: [
          { weeklyDistance: { gte: minWeeklyDistance } },
          { weeklyActivities: { gte: minWeeklyActivities } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
            state: true,
          },
        },
      },
    });
  }

  /**
   * Get fitness stats with user info
   */
  static async findByUserIdWithUser(userId: string): Promise<(FitnessStats & { user: any }) | null> {
    return await prisma.fitnessStats.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
            state: true,
            photos: true,
          },
        },
      },
    });
  }
}