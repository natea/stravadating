import { UserModel } from '../models/User';
import { FitnessStatsModel } from '../models/FitnessStats';
import { MatchingPreferencesModel } from '../models/MatchingPreferences';
import { MatchModel } from '../models/Match';
import { StravaActivity } from '../types';
import { prisma } from '../config/database';

export interface PotentialMatch {
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    age: number;
    city: string;
    state: string;
    photos: string[];
    bio: string | null;
  };
  compatibilityScore: number;
  compatibilityFactors: {
    activityOverlap: number;
    performanceSimilarity: number;
    locationProximity: number;
    ageCompatibility: number;
  };
  fitnessStats: {
    weeklyDistance: number;
    weeklyActivities: number;
    averagePace: number | null;
    favoriteActivities: string[];
    totalDistance: number;
  };
}

export interface MatchingFilters {
  minAge?: number;
  maxAge?: number;
  maxDistance?: number;
  preferredActivities?: string[];
  minCompatibilityScore?: number;
}

export class MatchingService {
  /**
   * Find potential matches for a user
   */
  static async findPotentialMatches(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<PotentialMatch[]> {
    // Get user's basic info and preferences
    const [user, userPreferences, userFitnessStats] = await Promise.all([
      UserModel.findById(userId),
      MatchingPreferencesModel.findByUserId(userId),
      FitnessStatsModel.findByUserId(userId),
    ]);

    if (!user || !userFitnessStats) {
      throw new Error('User or fitness stats not found');
    }

    // Use default preferences if none exist
    const preferences = userPreferences || MatchingPreferencesModel.getDefaultPreferences(userId);

    // Get users within distance and age range, excluding already matched users
    const potentialUsers = await this.getFilteredUsers(userId, user, preferences);

    // Calculate compatibility scores for each potential match
    const scoredMatches = await Promise.all(
      potentialUsers.map(async (potentialUser) => {
        const compatibilityScore = await this.calculateCompatibilityScore(
          user,
          userFitnessStats,
          potentialUser,
          potentialUser.fitnessStats
        );

        return {
          userId: potentialUser.id,
          user: {
            id: potentialUser.id,
            firstName: potentialUser.firstName,
            lastName: potentialUser.lastName,
            age: potentialUser.age,
            city: potentialUser.city,
            state: potentialUser.state,
            photos: potentialUser.photos,
            bio: potentialUser.bio,
          },
          compatibilityScore: compatibilityScore.score,
          compatibilityFactors: compatibilityScore.factors,
          fitnessStats: {
            weeklyDistance: potentialUser.fitnessStats.weeklyDistance,
            weeklyActivities: potentialUser.fitnessStats.weeklyActivities,
            averagePace: potentialUser.fitnessStats.averagePace,
            favoriteActivities: potentialUser.fitnessStats.favoriteActivities,
            totalDistance: potentialUser.fitnessStats.totalDistance,
          },
        };
      })
    );

    // Filter by minimum compatibility score and sort by score
    const filteredMatches = scoredMatches
      .filter(match => match.compatibilityScore >= preferences.minCompatibilityScore)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    // Apply pagination
    return filteredMatches.slice(offset, offset + limit);
  }

  /**
   * Get filtered users based on preferences and exclusions
   */
  private static async getFilteredUsers(
    userId: string,
    user: any,
    preferences: any
  ): Promise<any[]> {
    // Get users already matched or interacted with
    const existingMatches = await MatchModel.findByUserId(userId);
    const matchedUserIds = Array.isArray(existingMatches) 
      ? existingMatches.map(match => 
          match.user1Id === userId ? match.user2Id : match.user1Id
        )
      : [];

    // Build the query to find potential matches
    const potentialUsers = await prisma.user.findMany({
      where: {
        id: {
          not: userId,
          notIn: matchedUserIds,
        },
        age: {
          gte: preferences.minAge,
          lte: preferences.maxAge,
        },
      },
      include: {
        fitnessStats: true,
      },
    });

    // Filter by distance using Haversine formula
    const usersWithinDistance = potentialUsers.filter(potentialUser => {
      if (!potentialUser.fitnessStats) return false;

      const distance = this.calculateDistance(
        user.latitude,
        user.longitude,
        potentialUser.latitude,
        potentialUser.longitude
      );

      return distance <= preferences.maxDistance;
    });

    return usersWithinDistance.map(user => ({
      ...user,
      photos: Array.isArray(user.photos) ? user.photos as string[] : [],
      fitnessStats: {
        ...user.fitnessStats,
        favoriteActivities: Array.isArray(user.fitnessStats?.favoriteActivities) 
          ? user.fitnessStats.favoriteActivities as string[] 
          : [],
      },
    }));
  }

  /**
   * Calculate compatibility score between two users
   */
  static async calculateCompatibilityScore(
    user1: any,
    user1FitnessStats: any,
    user2: any,
    user2FitnessStats: any
  ): Promise<{
    score: number;
    factors: {
      activityOverlap: number;
      performanceSimilarity: number;
      locationProximity: number;
      ageCompatibility: number;
    };
  }> {
    // Calculate individual compatibility factors
    const activityOverlap = await this.calculateActivityOverlap(user1.id, user2.id);
    const performanceSimilarity = this.calculatePerformanceSimilarity(
      user1FitnessStats,
      user2FitnessStats
    );
    const locationProximity = this.calculateLocationProximity(
      user1.latitude,
      user1.longitude,
      user2.latitude,
      user2.longitude
    );
    const ageCompatibility = this.calculateAgeCompatibility(user1.age, user2.age);

    // Weight the factors (can be adjusted based on requirements)
    const weights = {
      activityOverlap: 0.4,
      performanceSimilarity: 0.3,
      locationProximity: 0.2,
      ageCompatibility: 0.1,
    };

    // Calculate weighted score
    const score = Math.round(
      (activityOverlap * weights.activityOverlap +
        performanceSimilarity * weights.performanceSimilarity +
        locationProximity * weights.locationProximity +
        ageCompatibility * weights.ageCompatibility) * 100
    );

    return {
      score,
      factors: {
        activityOverlap: Math.round(activityOverlap * 100),
        performanceSimilarity: Math.round(performanceSimilarity * 100),
        locationProximity: Math.round(locationProximity * 100),
        ageCompatibility: Math.round(ageCompatibility * 100),
      },
    };
  }

  /**
   * Calculate activity overlap between two users
   */
  private static async calculateActivityOverlap(user1Id: string, user2Id: string): Promise<number> {
    // Get recent activities for both users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [user1Activities, user2Activities] = await Promise.all([
      prisma.stravaActivity.findMany({
        where: {
          userId: user1Id,
          startDate: { gte: thirtyDaysAgo },
        },
        select: { type: true },
      }),
      prisma.stravaActivity.findMany({
        where: {
          userId: user2Id,
          startDate: { gte: thirtyDaysAgo },
        },
        select: { type: true },
      }),
    ]);

    if (user1Activities.length === 0 || user2Activities.length === 0) {
      return 0;
    }

    // Get unique activity types for each user
    const user1Types = new Set(user1Activities.map(a => a.type));
    const user2Types = new Set(user2Activities.map(a => a.type));

    // Calculate Jaccard similarity (intersection / union)
    const intersection = new Set([...user1Types].filter(type => user2Types.has(type)));
    const union = new Set([...user1Types, ...user2Types]);

    return intersection.size / union.size;
  }

  /**
   * Calculate performance similarity between two users
   */
  private static calculatePerformanceSimilarity(
    user1Stats: any,
    user2Stats: any
  ): number {
    // Normalize metrics to 0-1 scale for comparison
    const maxWeeklyDistance = Math.max(user1Stats.weeklyDistance, user2Stats.weeklyDistance);
    const maxWeeklyActivities = Math.max(user1Stats.weeklyActivities, user2Stats.weeklyActivities);

    if (maxWeeklyDistance === 0 && maxWeeklyActivities === 0) {
      return 1; // Both users have no activity, perfect match
    }

    // Calculate similarity for distance and activities
    const distanceSimilarity = maxWeeklyDistance > 0 
      ? 1 - Math.abs(user1Stats.weeklyDistance - user2Stats.weeklyDistance) / maxWeeklyDistance
      : 1;

    const activitySimilarity = maxWeeklyActivities > 0
      ? 1 - Math.abs(user1Stats.weeklyActivities - user2Stats.weeklyActivities) / maxWeeklyActivities
      : 1;

    // Average pace similarity (if both users have pace data)
    let paceSimilarity = 1;
    if (user1Stats.averagePace && user2Stats.averagePace) {
      const maxPace = Math.max(user1Stats.averagePace, user2Stats.averagePace);
      paceSimilarity = 1 - Math.abs(user1Stats.averagePace - user2Stats.averagePace) / maxPace;
    }

    // Weight the similarities
    return (distanceSimilarity * 0.4 + activitySimilarity * 0.4 + paceSimilarity * 0.2);
  }

  /**
   * Calculate location proximity score
   */
  private static calculateLocationProximity(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const distance = this.calculateDistance(lat1, lon1, lat2, lon2);
    
    // Convert distance to proximity score (closer = higher score)
    // Max score at 0km, decreasing to 0 at 100km
    const maxDistance = 100; // km
    return Math.max(0, 1 - distance / maxDistance);
  }

  /**
   * Calculate age compatibility score
   */
  private static calculateAgeCompatibility(age1: number, age2: number): number {
    const ageDifference = Math.abs(age1 - age2);
    
    // Perfect score for same age, decreasing as difference increases
    // Score becomes 0 at 20 years difference
    const maxAgeDifference = 20;
    return Math.max(0, 1 - ageDifference / maxAgeDifference);
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
   * Create a match between two users
   */
  static async createMatch(
    user1Id: string,
    user2Id: string,
    compatibilityScore: number
  ): Promise<any> {
    // Check if match already exists
    const existingMatch = await MatchModel.findByUserIds(user1Id, user2Id);
    if (existingMatch) {
      throw new Error('Match already exists between these users');
    }

    return await MatchModel.create({
      user1Id,
      user2Id,
      compatibilityScore,
    });
  }

  /**
   * Update user matching preferences
   */
  static async updateMatchingPreferences(
    userId: string,
    preferences: MatchingFilters
  ): Promise<any> {
    return await MatchingPreferencesModel.upsert(userId, {
      userId,
      ...preferences,
    });
  }

  /**
   * Get user's matching preferences
   */
  static async getMatchingPreferences(userId: string): Promise<any> {
    const preferences = await MatchingPreferencesModel.findByUserId(userId);
    return preferences || MatchingPreferencesModel.getDefaultPreferences(userId);
  }
}