import { User, CreateUserInput } from '../types/user';
import { StravaAuthResponse } from '../types/strava';
import { UserModel } from '../models/User';
import { FitnessStatsModel } from '../models/FitnessStats';
import { StravaActivityModel } from '../models/StravaActivity';
import { stravaIntegrationService } from './stravaIntegrationService';
import { FitnessEvaluationService } from './fitnessEvaluationService';
import { tokenService } from './tokenService';
import { logger } from '../utils/logger';

export interface RegistrationData {
  stravaAuthResponse: StravaAuthResponse;
  additionalInfo?: {
    age?: number;
    bio?: string;
  };
}

export interface RegistrationResult {
  success: boolean;
  user?: User;
  fitnessEvaluation?: any;
  error?: string;
  message: string;
}

export interface ProfileValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData: CreateUserInput | undefined;
}

export class UserRegistrationService {
  /**
   * Complete user registration workflow
   */
  static async registerUser(data: RegistrationData): Promise<RegistrationResult> {
    try {
      const { stravaAuthResponse, additionalInfo } = data;
      const { athlete } = stravaAuthResponse;

      logger.info(`Starting registration for Strava user ${athlete.id}`);

      // Check if user already exists
      const existingUser = await UserModel.findByStravaId(athlete.id);
      if (existingUser) {
        return {
          success: false,
          error: 'USER_ALREADY_EXISTS',
          message: 'An account with this Strava profile already exists.',
        };
      }

      // Store Strava tokens temporarily for fitness evaluation
      const tempUserId = `temp_${athlete.id}`;
      stravaIntegrationService.setUserTokens(tempUserId, {
        accessToken: stravaAuthResponse.access_token,
        refreshToken: stravaAuthResponse.refresh_token,
        expiresAt: Math.floor(Date.now() / 1000) + 21600, // 6 hours
      });

      // Sync Strava data and evaluate fitness
      const { activities, fitnessMetrics } = await stravaIntegrationService.syncUserFitnessData(tempUserId);

      // Check if user is an admin (bypass fitness check based on Strava ID)
      // For now, we'll use environment variable to list admin Strava IDs
      const adminStravaIds = process.env.ADMIN_STRAVA_IDS?.split(',').map(id => parseInt(id)) || [];
      const isAdmin = adminStravaIds.includes(athlete.id);

      // Evaluate fitness threshold
      const fitnessEvaluation = await this.evaluateFitnessForRegistration(activities);

      // Skip fitness check for admin users or if threshold check passes
      if (!isAdmin && !fitnessEvaluation.meets) {
        // Clean up temporary tokens
        stravaIntegrationService.removeUserTokens(tempUserId);
        
        return {
          success: false,
          error: 'FITNESS_THRESHOLD_NOT_MET',
          message: fitnessEvaluation.message,
          fitnessEvaluation,
        };
      }

      // If admin, override fitness evaluation
      if (isAdmin) {
        logger.info(`Admin user (Strava ID: ${athlete.id}) bypassing fitness threshold check`);
        fitnessEvaluation.meets = true;
        fitnessEvaluation.message = 'Admin user - fitness threshold bypassed';
      }

      // Create user profile data
      const userProfileData = await this.createUserProfileData(athlete, additionalInfo);

      // Validate and sanitize profile data
      const validation = this.validateProfileData(userProfileData);
      if (!validation.isValid) {
        stravaIntegrationService.removeUserTokens(tempUserId);
        return {
          success: false,
          error: 'INVALID_PROFILE_DATA',
          message: `Profile validation failed: ${validation.errors.join(', ')}`,
        };
      }

      // Create user account
      const user = await UserModel.create(validation.sanitizedData!);
      logger.info(`Created user account ${user.id} for Strava user ${athlete.id}`);

      // Store Strava tokens for the real user
      stravaIntegrationService.removeUserTokens(tempUserId);
      stravaIntegrationService.setUserTokens(user.id, {
        accessToken: stravaAuthResponse.access_token,
        refreshToken: stravaAuthResponse.refresh_token,
        expiresAt: Math.floor(Date.now() / 1000) + 21600,
      });

      // Store Strava tokens in persistent storage
      await tokenService.storeStravaTokens(user.id, {
        accessToken: stravaAuthResponse.access_token,
        refreshToken: stravaAuthResponse.refresh_token,
        expiresAt: Math.floor(Date.now() / 1000) + 21600,
      });

      // Create fitness stats record
      await FitnessStatsModel.create({
        userId: user.id,
        ...fitnessMetrics,
      });

      // Store Strava activities
      if (activities.length > 0) {
        const activitiesWithUserId = activities.map(activity => ({
          ...activity,
          userId: user.id,
        }));
        await StravaActivityModel.createMany(activitiesWithUserId);
      }

      logger.info(`Successfully registered user ${user.id} with ${activities.length} activities`);

      return {
        success: true,
        user,
        fitnessEvaluation,
        message: 'Registration successful! Welcome to the fitness dating community.',
      };
    } catch (error) {
      logger.error('Registration failed:', error);
      return {
        success: false,
        error: 'REGISTRATION_FAILED',
        message: error instanceof Error ? error.message : 'Registration failed due to an unexpected error.',
      };
    }
  }

  /**
   * Evaluate fitness for registration using activities
   */
  private static async evaluateFitnessForRegistration(activities: any[]): Promise<{
    meets: boolean;
    message: string;
    score: number;
    reasons: string[];
  }> {
    try {
      // Calculate fitness metrics from activities
      const metrics = FitnessEvaluationService.calculateFitnessMetrics(activities);
      
      // Get current threshold
      const threshold = await import('../models/FitnessThreshold').then(m => m.FitnessThresholdModel.getCurrent());
      
      if (!threshold) {
        return {
          meets: true,
          message: 'No fitness threshold configured - registration approved.',
          score: 100,
          reasons: ['No fitness threshold configured'],
        };
      }

      // Evaluate metrics against threshold
      const requiredChecks = [
        metrics.weeklyDistance >= threshold.weeklyDistance,
        metrics.weeklyActivities >= threshold.weeklyActivities,
      ];

      // Add optional checks
      if (threshold.averagePace && metrics.averagePace) {
        requiredChecks.push(metrics.averagePace <= threshold.averagePace);
      }

      const allowedTypes = threshold.allowedActivityTypes as string[];
      if (allowedTypes.length > 0) {
        requiredChecks.push(metrics.activityTypes.some(type => allowedTypes.includes(type)));
      }

      const meets = requiredChecks.every(check => check);
      
      const reasons: string[] = [];
      
      // Generate detailed reasons
      if (metrics.weeklyDistance >= threshold.weeklyDistance) {
        reasons.push(`✓ Weekly distance: ${Math.round(metrics.weeklyDistance)}m meets requirement (${threshold.weeklyDistance}m)`);
      } else {
        reasons.push(`✗ Weekly distance: ${Math.round(metrics.weeklyDistance)}m below requirement (${threshold.weeklyDistance}m)`);
      }

      if (metrics.weeklyActivities >= threshold.weeklyActivities) {
        reasons.push(`✓ Weekly activities: ${Math.round(metrics.weeklyActivities)} meets requirement (${threshold.weeklyActivities})`);
      } else {
        reasons.push(`✗ Weekly activities: ${Math.round(metrics.weeklyActivities)} below requirement (${threshold.weeklyActivities})`);
      }

      // Calculate score
      let score = 0;
      let maxScore = 50; // Base score for distance and activities

      if (metrics.weeklyDistance >= threshold.weeklyDistance) score += 25;
      if (metrics.weeklyActivities >= threshold.weeklyActivities) score += 25;

      if (threshold.averagePace && metrics.averagePace) {
        maxScore += 25;
        if (metrics.averagePace <= threshold.averagePace) {
          score += 25;
          const userPaceMin = Math.floor(metrics.averagePace / 60);
          const userPaceSec = Math.round(metrics.averagePace % 60);
          reasons.push(`✓ Average pace: ${userPaceMin}:${userPaceSec.toString().padStart(2, '0')}/km meets requirement`);
        } else {
          const userPaceMin = Math.floor(metrics.averagePace / 60);
          const userPaceSec = Math.round(metrics.averagePace % 60);
          reasons.push(`✗ Average pace: ${userPaceMin}:${userPaceSec.toString().padStart(2, '0')}/km too slow`);
        }
      }

      if (allowedTypes.length > 0) {
        maxScore += 25;
        const hasAllowedActivity = metrics.activityTypes.some(type => allowedTypes.includes(type));
        if (hasAllowedActivity) {
          score += 25;
          const matchingTypes = metrics.activityTypes.filter(type => allowedTypes.includes(type));
          reasons.push(`✓ Activity types: ${matchingTypes.join(', ')} match allowed types`);
        } else {
          reasons.push(`✗ No activities match allowed types: ${allowedTypes.join(', ')}`);
        }
      }

      const finalScore = Math.round((score / maxScore) * 100);

      let message: string;
      if (meets) {
        message = `Congratulations! Your fitness level meets our community standards. Score: ${finalScore}/100`;
      } else {
        message = `Your current fitness level doesn't meet our minimum requirements. Please continue training and try again in a few weeks. Score: ${finalScore}/100`;
      }

      return {
        meets,
        message,
        score: finalScore,
        reasons,
      };
    } catch (error) {
      logger.error('Error evaluating fitness for registration:', error);
      throw new Error('Failed to evaluate fitness requirements');
    }
  }

  /**
   * Create user profile data from Strava athlete info
   */
  private static async createUserProfileData(
    athlete: any,
    additionalInfo?: { age?: number; bio?: string }
  ): Promise<CreateUserInput> {
    // Generate email if not provided by Strava
    const email = athlete.email || `${athlete.username || athlete.id}@strava.local`;

    // Use Strava's location data or provide defaults
    const city = athlete.city || 'San Francisco';
    const state = athlete.state || 'CA';

    // Geocode city/state to coordinates (simplified - in production use a geocoding service)
    const { latitude, longitude } = await this.geocodeLocation(city, state);

    return {
      email,
      stravaId: athlete.id,
      firstName: athlete.firstname || 'Unknown',
      lastName: athlete.lastname || 'User',
      age: additionalInfo?.age || 25, // Default age if not provided
      city,
      state,
      latitude,
      longitude,
      bio: additionalInfo?.bio || `Fitness enthusiast from ${city}, ${state}`,
      photos: athlete.profile_medium ? [athlete.profile_medium] : [],
    };
  }

  /**
   * Simple geocoding (in production, use a proper geocoding service)
   */
  private static async geocodeLocation(city?: string, state?: string): Promise<{ latitude: number; longitude: number }> {
    // Default to San Francisco coordinates if no location provided
    if (!city || !state) {
      return { latitude: 37.7749, longitude: -122.4194 };
    }

    // In production, integrate with Google Maps Geocoding API or similar
    // For now, return some default coordinates based on common cities
    const locationMap: Record<string, { latitude: number; longitude: number }> = {
      'san francisco,ca': { latitude: 37.7749, longitude: -122.4194 },
      'new york,ny': { latitude: 40.7128, longitude: -74.0060 },
      'los angeles,ca': { latitude: 34.0522, longitude: -118.2437 },
      'chicago,il': { latitude: 41.8781, longitude: -87.6298 },
      'austin,tx': { latitude: 30.2672, longitude: -97.7431 },
    };

    const key = `${city.toLowerCase()},${state.toLowerCase()}`;
    return locationMap[key] || { latitude: 37.7749, longitude: -122.4194 };
  }

  /**
   * Validate and sanitize profile data
   */
  static validateProfileData(data: CreateUserInput): ProfileValidationResult {
    const errors: string[] = [];
    const sanitizedData: Partial<CreateUserInput> = { ...data };

    // Email validation
    if (!data.email || !this.isValidEmail(data.email)) {
      errors.push('Valid email address is required');
    }

    // Name validation
    if (!data.firstName || data.firstName.trim().length < 1) {
      errors.push('First name is required');
    } else {
      sanitizedData.firstName = this.sanitizeString(data.firstName, 50);
    }

    if (!data.lastName || data.lastName.trim().length < 1) {
      errors.push('Last name is required');
    } else {
      sanitizedData.lastName = this.sanitizeString(data.lastName, 50);
    }

    // Age validation
    if (!data.age || data.age < 18 || data.age > 100) {
      errors.push('Age must be between 18 and 100');
    }

    // Location validation
    if (!data.city || data.city.trim().length < 1) {
      errors.push('City is required');
    } else {
      sanitizedData.city = this.sanitizeString(data.city, 100);
    }

    if (!data.state || data.state.trim().length < 1) {
      errors.push('State is required');
    } else {
      sanitizedData.state = this.sanitizeString(data.state, 50);
    }

    // Coordinates validation
    if (typeof data.latitude !== 'number' || data.latitude < -90 || data.latitude > 90) {
      errors.push('Valid latitude is required');
    }

    if (typeof data.longitude !== 'number' || data.longitude < -180 || data.longitude > 180) {
      errors.push('Valid longitude is required');
    }

    // Bio validation (optional)
    if (data.bio) {
      if (data.bio.length > 500) {
        errors.push('Bio must be 500 characters or less');
      } else {
        sanitizedData.bio = this.sanitizeString(data.bio, 500);
      }
    }

    // Photos validation
    if (data.photos && Array.isArray(data.photos)) {
      const validPhotos = data.photos.filter(photo => 
        typeof photo === 'string' && this.isValidUrl(photo)
      );
      if (validPhotos.length !== data.photos.length) {
        errors.push('All photo URLs must be valid');
      }
      sanitizedData.photos = validPhotos.slice(0, 10); // Limit to 10 photos
    }

    // Strava ID validation
    if (!data.stravaId || typeof data.stravaId !== 'number') {
      errors.push('Valid Strava ID is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData as CreateUserInput : undefined,
    };
  }

  /**
   * Update user profile with additional information
   */
  static async updateUserProfile(
    userId: string,
    updates: {
      age?: number;
      bio?: string;
      city?: string;
      state?: string;
      gender?: string;
      photos?: string[];
    }
  ): Promise<User> {
    // Validate updates
    const errors: string[] = [];

    if (updates.age !== undefined && (updates.age < 18 || updates.age > 100)) {
      errors.push('Age must be between 18 and 100');
    }

    if (updates.gender !== undefined && !['male', 'female', 'other'].includes(updates.gender)) {
      errors.push('Gender must be male, female, or other');
    }

    if (updates.bio !== undefined && updates.bio.length > 500) {
      errors.push('Bio must be 500 characters or less');
    }

    if (updates.city !== undefined && updates.city.trim().length < 1) {
      errors.push('City cannot be empty');
    }

    if (updates.state !== undefined && updates.state.trim().length < 1) {
      errors.push('State cannot be empty');
    }

    if (updates.photos !== undefined) {
      const validPhotos = updates.photos.filter(photo => this.isValidUrl(photo));
      if (validPhotos.length !== updates.photos.length) {
        errors.push('All photo URLs must be valid');
      }
      updates.photos = validPhotos.slice(0, 10);
    }

    if (errors.length > 0) {
      throw new Error(`Profile validation failed: ${errors.join(', ')}`);
    }

    // Sanitize string fields
    const sanitizedUpdates: any = {};
    if (updates.bio !== undefined) {
      sanitizedUpdates.bio = this.sanitizeString(updates.bio, 500);
    }
    if (updates.city !== undefined) {
      sanitizedUpdates.city = this.sanitizeString(updates.city, 100);
    }
    if (updates.state !== undefined) {
      sanitizedUpdates.state = this.sanitizeString(updates.state, 50);
    }
    if (updates.age !== undefined) {
      sanitizedUpdates.age = updates.age;
    }
    if (updates.gender !== undefined) {
      sanitizedUpdates.gender = updates.gender;
    }
    if (updates.photos !== undefined) {
      sanitizedUpdates.photos = updates.photos;
    }

    // Update coordinates if location changed
    if (updates.city || updates.state) {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const city = updates.city || user.city;
      const state = updates.state || user.state;
      const { latitude, longitude } = await this.geocodeLocation(city, state);
      sanitizedUpdates.latitude = latitude;
      sanitizedUpdates.longitude = longitude;
    }

    return await UserModel.update(userId, sanitizedUpdates);
  }

  /**
   * Check if user exists by Strava ID
   */
  static async checkUserExists(stravaId: number): Promise<User | null> {
    return await UserModel.findByStravaId(stravaId);
  }

  /**
   * Get user registration status
   */
  static async getRegistrationStatus(stravaId: number): Promise<{
    exists: boolean;
    user?: User;
    canRegister: boolean;
    message: string;
  }> {
    const existingUser = await UserModel.findByStravaId(stravaId);
    
    if (existingUser) {
      return {
        exists: true,
        user: existingUser,
        canRegister: false,
        message: 'User already registered',
      };
    }

    return {
      exists: false,
      canRegister: true,
      message: 'User can proceed with registration',
    };
  }

  // Helper methods
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private static sanitizeString(input: string, maxLength: number): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, maxLength);
  }
}