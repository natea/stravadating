import { prisma } from '../config/database';
import { MatchingPreferences, CreateMatchingPreferencesInput, UpdateMatchingPreferencesInput } from '../types';

export class MatchingPreferencesModel {
  /**
   * Create matching preferences for a user
   */
  static async create(data: CreateMatchingPreferencesInput): Promise<MatchingPreferences> {
    return await prisma.matchingPreferences.create({
      data: {
        ...data,
        preferredActivities: data.preferredActivities || [],
      },
    });
  }

  /**
   * Find matching preferences by user ID
   */
  static async findByUserId(userId: string): Promise<MatchingPreferences | null> {
    return await prisma.matchingPreferences.findUnique({
      where: { userId },
    });
  }

  /**
   * Update matching preferences
   */
  static async update(userId: string, data: UpdateMatchingPreferencesInput): Promise<MatchingPreferences> {
    return await prisma.matchingPreferences.update({
      where: { userId },
      data,
    });
  }

  /**
   * Delete matching preferences
   */
  static async delete(userId: string): Promise<void> {
    await prisma.matchingPreferences.delete({
      where: { userId },
    });
  }

  /**
   * Upsert matching preferences (create or update)
   */
  static async upsert(userId: string, data: CreateMatchingPreferencesInput): Promise<MatchingPreferences> {
    return await prisma.matchingPreferences.upsert({
      where: { userId },
      update: data,
      create: {
        ...data,
        preferredActivities: data.preferredActivities || [],
      },
    });
  }

  /**
   * Get default preferences for a user
   */
  static getDefaultPreferences(userId: string): CreateMatchingPreferencesInput {
    return {
      userId,
      minAge: 18,
      maxAge: 65,
      maxDistance: 50, // 50km
      preferredActivities: [],
      minCompatibilityScore: 0,
    };
  }

  /**
   * Find users with compatible preferences
   */
  static async findCompatibleUsers(
    userId: string,
    userAge: number,
    userLatitude: number,
    userLongitude: number
  ): Promise<string[]> {
    // Get the user's preferences
    const userPreferences = await this.findByUserId(userId);
    if (!userPreferences) {
      return [];
    }

    // Find users whose preferences would include this user
    const compatibleUsers = await prisma.matchingPreferences.findMany({
      where: {
        userId: { not: userId },
        minAge: { lte: userAge },
        maxAge: { gte: userAge },
      },
      include: {
        user: {
          select: {
            id: true,
            age: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    // Filter by distance and age compatibility
    const filteredUsers = compatibleUsers.filter(pref => {
      const user = pref.user;
      
      // Check if the other user's age is within our preferences
      if (user.age < userPreferences.minAge || user.age > userPreferences.maxAge) {
        return false;
      }

      // Calculate distance using Haversine formula
      const distance = this.calculateDistance(
        userLatitude,
        userLongitude,
        user.latitude,
        user.longitude
      );

      // Check if within both users' distance preferences
      return distance <= userPreferences.maxDistance && distance <= pref.maxDistance;
    });

    return filteredUsers.map(pref => pref.userId);
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if two users have compatible activity preferences
   */
  static async checkActivityCompatibility(user1Id: string, user2Id: string): Promise<{
    compatible: boolean;
    commonActivities: string[];
    compatibilityScore: number;
  }> {
    const [user1Prefs, user2Prefs] = await Promise.all([
      this.findByUserId(user1Id),
      this.findByUserId(user2Id),
    ]);

    if (!user1Prefs || !user2Prefs) {
      return {
        compatible: false,
        commonActivities: [],
        compatibilityScore: 0,
      };
    }

    const user1Activities = user1Prefs.preferredActivities as string[];
    const user2Activities = user2Prefs.preferredActivities as string[];

    // If either user has no preferences, they're compatible with everyone
    if (user1Activities.length === 0 || user2Activities.length === 0) {
      return {
        compatible: true,
        commonActivities: [],
        compatibilityScore: 0.5,
      };
    }

    // Find common activities
    const commonActivities = user1Activities.filter(activity =>
      user2Activities.includes(activity)
    );

    const compatibilityScore = commonActivities.length > 0
      ? commonActivities.length / Math.max(user1Activities.length, user2Activities.length)
      : 0;

    return {
      compatible: commonActivities.length > 0,
      commonActivities,
      compatibilityScore,
    };
  }
}