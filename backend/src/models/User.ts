import { prisma } from '../config/database';
import { User, CreateUserInput, UpdateUserInput, PaginationOptions, PaginatedResponse } from '../types';
import { Prisma } from '../generated/prisma';

export class UserModel {
  /**
   * Create a new user
   */
  static async create(data: CreateUserInput): Promise<User> {
    try {
      const user = await prisma.user.create({
        data: {
          ...data,
          photos: data.photos || [],
        },
      });
      return {
        ...user,
        photos: Array.isArray(user.photos) ? user.photos as string[] : [],
        bio: user.bio,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('User with this email or Strava ID already exists');
        }
      }
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    
    if (!user) return null;
    
    return {
      ...user,
      photos: Array.isArray(user.photos) ? user.photos as string[] : [],
      bio: user.bio,
    };
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) return null;
    
    return {
      ...user,
      photos: Array.isArray(user.photos) ? user.photos as string[] : [],
      bio: user.bio,
    };
  }

  /**
   * Find user by Strava ID
   */
  static async findByStravaId(stravaId: number): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { stravaId },
    });
    
    if (!user) return null;
    
    return {
      ...user,
      photos: Array.isArray(user.photos) ? user.photos as string[] : [],
      bio: user.bio,
    };
  }

  /**
   * Update user
   */
  static async update(id: string, data: UpdateUserInput): Promise<User> {
    const user = await prisma.user.update({
      where: { id },
      data,
    });
    
    return {
      ...user,
      photos: Array.isArray(user.photos) ? user.photos as string[] : [],
      bio: user.bio,
    };
  }

  /**
   * Delete user
   */
  static async delete(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Get users with pagination
   */
  static async findMany(options: PaginationOptions): Promise<PaginatedResponse<User>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [rawUsers, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);

    const users = rawUsers.map(user => ({
      ...user,
      photos: Array.isArray(user.photos) ? user.photos as string[] : [],
      bio: user.bio,
    }));

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find users within distance
   */
  static async findUsersWithinDistance(
    latitude: number,
    longitude: number,
    maxDistanceKm: number,
    excludeUserId?: string
  ): Promise<User[]> {
    // Using Haversine formula for distance calculation
    const query = `
      SELECT *, (
        6371 * acos(
          cos(radians($1)) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians($2)) + 
          sin(radians($1)) * sin(radians(latitude))
        )
      ) AS distance
      FROM users
      WHERE (
        6371 * acos(
          cos(radians($1)) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians($2)) + 
          sin(radians($1)) * sin(radians(latitude))
        )
      ) <= $3
      ${excludeUserId ? 'AND id != $4' : ''}
      ORDER BY distance;
    `;

    const params = excludeUserId 
      ? [latitude, longitude, maxDistanceKm, excludeUserId]
      : [latitude, longitude, maxDistanceKm];

    const users = await prisma.$queryRawUnsafe(query, ...params) as User[];
    return users;
  }

  /**
   * Update last active timestamp
   */
  static async updateLastActive(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastActive: new Date() },
    });
  }
}