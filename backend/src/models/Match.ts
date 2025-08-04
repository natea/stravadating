import { prisma } from '../config/database';
import { Match, CreateMatchInput, UpdateMatchInput, PaginationOptions, PaginatedResponse } from '../types';

export class MatchModel {
  /**
   * Create a new match
   */
  static async create(data: CreateMatchInput): Promise<Match> {
    return await prisma.match.create({
      data,
    });
  }

  /**
   * Find match by ID
   */
  static async findById(id: string): Promise<Match | null> {
    return await prisma.match.findUnique({
      where: { id },
    });
  }

  /**
   * Find matches for a user
   */
  static async findByUserId(
    userId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<Match> | Match[]> {
    const whereClause = {
      OR: [
        { user1Id: userId },
        { user2Id: userId },
      ],
      status: 'active',
    };

    if (options) {
      const { page, limit } = options;
      const skip = (page - 1) * limit;

      const [matches, total] = await Promise.all([
        prisma.match.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { matchedAt: 'desc' },
          include: {
            user1: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                photos: true,
                city: true,
                state: true,
              },
            },
            user2: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                photos: true,
                city: true,
                state: true,
              },
            },
          },
        }),
        prisma.match.count({
          where: whereClause,
        }),
      ]);

      return {
        data: matches,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    return await prisma.match.findMany({
      where: whereClause,
      orderBy: { matchedAt: 'desc' },
      include: {
        user1: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photos: true,
            city: true,
            state: true,
          },
        },
        user2: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photos: true,
            city: true,
            state: true,
          },
        },
      },
    });
  }

  /**
   * Find match between two users
   */
  static async findByUserIds(user1Id: string, user2Id: string): Promise<Match | null> {
    return await prisma.match.findFirst({
      where: {
        OR: [
          { user1Id, user2Id },
          { user1Id: user2Id, user2Id: user1Id },
        ],
      },
    });
  }

  /**
   * Update match
   */
  static async update(id: string, data: UpdateMatchInput): Promise<Match> {
    return await prisma.match.update({
      where: { id },
      data,
    });
  }

  /**
   * Archive match
   */
  static async archive(id: string): Promise<Match> {
    return await prisma.match.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  /**
   * Delete match
   */
  static async delete(id: string): Promise<void> {
    await prisma.match.delete({
      where: { id },
    });
  }

  /**
   * Get match statistics for user
   */
  static async getMatchStats(userId: string): Promise<{
    totalMatches: number;
    activeMatches: number;
    archivedMatches: number;
    averageCompatibilityScore: number;
  }> {
    const whereClause = {
      OR: [
        { user1Id: userId },
        { user2Id: userId },
      ],
    };

    const [totalMatches, activeMatches, archivedMatches, allMatches] = await Promise.all([
      prisma.match.count({ where: whereClause }),
      prisma.match.count({ where: { ...whereClause, status: 'active' } }),
      prisma.match.count({ where: { ...whereClause, status: 'archived' } }),
      prisma.match.findMany({ where: whereClause, select: { compatibilityScore: true } }),
    ]);

    const averageCompatibilityScore = allMatches.length > 0
      ? allMatches.reduce((sum, match) => sum + match.compatibilityScore, 0) / allMatches.length
      : 0;

    return {
      totalMatches,
      activeMatches,
      archivedMatches,
      averageCompatibilityScore,
    };
  }

  /**
   * Check if users are matched
   */
  static async areUsersMatched(user1Id: string, user2Id: string): Promise<boolean> {
    const match = await this.findByUserIds(user1Id, user2Id);
    return match !== null && match.status === 'active';
  }

  /**
   * Get recent matches
   */
  static async getRecentMatches(userId: string, limit: number = 10): Promise<Match[]> {
    return await prisma.match.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
        status: 'active',
      },
      orderBy: { matchedAt: 'desc' },
      take: limit,
      include: {
        user1: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photos: true,
          },
        },
        user2: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photos: true,
          },
        },
      },
    });
  }
}