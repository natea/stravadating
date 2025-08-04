import { StravaActivity } from '../types/strava';
import { FitnessThreshold } from '../types/fitness';
import { FitnessThresholdModel } from '../models/FitnessThreshold';
import { StravaActivityModel } from '../models/StravaActivity';
import { logger } from '../utils/logger';

export interface FitnessMetrics {
  weeklyDistance: number;
  weeklyActivities: number;
  averagePace: number | undefined;
  activityTypes: string[];
  totalDistance: number;
  longestActivity: number;
  consistencyScore: number;
}

export interface ThresholdEvaluationResult {
  meets: boolean;
  metrics: FitnessMetrics;
  threshold: FitnessThreshold | null;
  reasons: string[];
  score: number;
}

export interface AdminThresholdUpdate {
  weeklyDistance?: number;
  weeklyActivities?: number;
  averagePace?: number | undefined;
  allowedActivityTypes?: string[];
  updatedBy: string;
}

export class FitnessEvaluationService {
  /**
   * Calculate fitness metrics from 90 days of Strava activity data
   */
  static calculateFitnessMetrics(activities: StravaActivity[]): FitnessMetrics {
    if (activities.length === 0) {
      return {
        weeklyDistance: 0,
        weeklyActivities: 0,
        averagePace: undefined,
        activityTypes: [],
        totalDistance: 0,
        longestActivity: 0,
        consistencyScore: 0,
      };
    }

    // Sort activities by date (newest first)
    const sortedActivities = activities.sort((a, b) => 
      b.startDate.getTime() - a.startDate.getTime()
    );

    // Calculate total metrics
    const totalDistance = sortedActivities.reduce((sum, activity) => sum + activity.distance, 0);
    const totalActivities = sortedActivities.length;

    // Calculate weekly averages (90 days = ~13 weeks)
    const weeksInPeriod = 90 / 7;
    const weeklyDistance = totalDistance / weeksInPeriod;
    const weeklyActivities = totalActivities / weeksInPeriod;

    // Calculate average pace for running/walking activities
    const paceActivities = sortedActivities.filter(activity => 
      ['Run', 'Walk', 'Hike'].includes(activity.type) && 
      activity.averageSpeed > 0 &&
      activity.distance > 500 // Only activities longer than 500m
    );

    let averagePace: number | undefined;
    if (paceActivities.length > 0) {
      const totalPace = paceActivities.reduce((sum, activity) => {
        // Convert speed (m/s) to pace (seconds per km)
        const paceInSecondsPerKm = 1000 / activity.averageSpeed;
        return sum + paceInSecondsPerKm;
      }, 0);
      averagePace = totalPace / paceActivities.length;
    }

    // Get unique activity types
    const activityTypes = [...new Set(sortedActivities.map(activity => activity.type))];

    // Find longest activity
    const longestActivity = Math.max(...sortedActivities.map(activity => activity.distance));

    // Calculate consistency score (0-100)
    const consistencyScore = this.calculateConsistencyScore(sortedActivities);

    return {
      weeklyDistance,
      weeklyActivities,
      averagePace,
      activityTypes,
      totalDistance,
      longestActivity,
      consistencyScore,
    };
  }

  /**
   * Calculate consistency score based on activity distribution over time
   */
  private static calculateConsistencyScore(activities: StravaActivity[]): number {
    if (activities.length === 0) return 0;

    // Group activities by week
    const weeklyActivities = new Map<string, number>();

    activities.forEach(activity => {
      const weekStart = new Date(activity.startDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week
      const weekKey = weekStart.toISOString().split('T')[0];
      
      weeklyActivities.set(weekKey, (weeklyActivities.get(weekKey) || 0) + 1);
    });

    // Calculate weeks with activities vs total weeks
    const totalWeeks = 13; // 90 days / 7
    const activeWeeks = weeklyActivities.size;
    const weeklyConsistency = (activeWeeks / totalWeeks) * 100;

    // Calculate activity distribution consistency
    const activityCounts = Array.from(weeklyActivities.values());
    const avgActivitiesPerWeek = activityCounts.reduce((sum, count) => sum + count, 0) / activityCounts.length;
    
    // Calculate standard deviation
    const variance = activityCounts.reduce((sum, count) => 
      sum + Math.pow(count - avgActivitiesPerWeek, 2), 0
    ) / activityCounts.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = higher consistency
    const distributionConsistency = Math.max(0, 100 - (stdDev * 20));

    // Combine both metrics (weighted average)
    return Math.round((weeklyConsistency * 0.6) + (distributionConsistency * 0.4));
  }

  /**
   * Evaluate user fitness against current threshold
   */
  static async evaluateUserFitness(userId: string): Promise<ThresholdEvaluationResult> {
    try {
      // Get current fitness threshold
      const threshold = await FitnessThresholdModel.getCurrent();
      
      // Get user's activities from last 90 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      
      const activities = await StravaActivityModel.findByUserIdAndDateRange(
        userId,
        startDate,
        endDate
      );

      // Calculate fitness metrics
      const metrics = this.calculateFitnessMetrics(activities);

      // Evaluate against threshold
      const evaluation = await this.evaluateMetricsAgainstThreshold(metrics, threshold);

      return {
        meets: evaluation.meets,
        metrics,
        threshold,
        reasons: evaluation.reasons,
        score: evaluation.score,
      };
    } catch (error) {
      logger.error('Failed to evaluate user fitness:', error);
      throw new Error('Failed to evaluate user fitness');
    }
  }

  /**
   * Evaluate fitness metrics against threshold
   */
  private static async evaluateMetricsAgainstThreshold(
    metrics: FitnessMetrics,
    threshold: FitnessThreshold | null
  ): Promise<{ meets: boolean; reasons: string[]; score: number }> {
    if (!threshold) {
      return {
        meets: true,
        reasons: ['No fitness threshold configured'],
        score: 100,
      };
    }

    const reasons: string[] = [];
    let score = 0;
    let totalChecks = 0;

    // Check weekly distance
    totalChecks++;
    if (metrics.weeklyDistance >= threshold.weeklyDistance) {
      score += 25;
      reasons.push(`✓ Weekly distance: ${Math.round(metrics.weeklyDistance)}m meets requirement (${threshold.weeklyDistance}m)`);
    } else {
      reasons.push(`✗ Weekly distance: ${Math.round(metrics.weeklyDistance)}m below requirement (${threshold.weeklyDistance}m)`);
    }

    // Check weekly activities
    totalChecks++;
    if (metrics.weeklyActivities >= threshold.weeklyActivities) {
      score += 25;
      reasons.push(`✓ Weekly activities: ${Math.round(metrics.weeklyActivities)} meets requirement (${threshold.weeklyActivities})`);
    } else {
      reasons.push(`✗ Weekly activities: ${Math.round(metrics.weeklyActivities)} below requirement (${threshold.weeklyActivities})`);
    }

    // Check average pace if specified and user has pace data
    if (threshold.averagePace && metrics.averagePace) {
      totalChecks++;
      if (metrics.averagePace <= threshold.averagePace) {
        score += 25;
        const userPaceMin = Math.floor(metrics.averagePace / 60);
        const userPaceSec = Math.round(metrics.averagePace % 60);
        const reqPaceMin = Math.floor(threshold.averagePace / 60);
        const reqPaceSec = Math.round(threshold.averagePace % 60);
        reasons.push(`✓ Average pace: ${userPaceMin}:${userPaceSec.toString().padStart(2, '0')}/km meets requirement (${reqPaceMin}:${reqPaceSec.toString().padStart(2, '0')}/km)`);
      } else {
        const userPaceMin = Math.floor(metrics.averagePace / 60);
        const userPaceSec = Math.round(metrics.averagePace % 60);
        const reqPaceMin = Math.floor(threshold.averagePace / 60);
        const reqPaceSec = Math.round(threshold.averagePace % 60);
        reasons.push(`✗ Average pace: ${userPaceMin}:${userPaceSec.toString().padStart(2, '0')}/km slower than requirement (${reqPaceMin}:${reqPaceSec.toString().padStart(2, '0')}/km)`);
      }
    }

    // Check activity types if specified
    const allowedTypes = threshold.allowedActivityTypes as string[];
    if (allowedTypes.length > 0) {
      totalChecks++;
      const hasAllowedActivity = metrics.activityTypes.some(type => allowedTypes.includes(type));
      if (hasAllowedActivity) {
        score += 25;
        const matchingTypes = metrics.activityTypes.filter(type => allowedTypes.includes(type));
        reasons.push(`✓ Activity types: ${matchingTypes.join(', ')} match allowed types`);
      } else {
        reasons.push(`✗ No activities match allowed types: ${allowedTypes.join(', ')}`);
      }
    }

    // Add consistency bonus (up to 10 points)
    const consistencyBonus = Math.round(metrics.consistencyScore * 0.1);
    score += consistencyBonus;
    reasons.push(`Consistency score: ${metrics.consistencyScore}/100 (+${consistencyBonus} bonus points)`);

    // Calculate final score as percentage
    const maxScore = (totalChecks * 25) + 10; // Base points + consistency bonus
    const finalScore = Math.round((score / maxScore) * 100);

    // User meets threshold if they pass all required checks
    const requiredChecks = [
      metrics.weeklyDistance >= threshold.weeklyDistance,
      metrics.weeklyActivities >= threshold.weeklyActivities,
    ];

    // Add optional checks
    if (threshold.averagePace && metrics.averagePace) {
      requiredChecks.push(metrics.averagePace <= threshold.averagePace);
    }

    if (allowedTypes.length > 0) {
      requiredChecks.push(metrics.activityTypes.some(type => allowedTypes.includes(type)));
    }

    const meets = requiredChecks.every(check => check);

    return {
      meets,
      reasons,
      score: finalScore,
    };
  }

  /**
   * Batch evaluate multiple users (for admin analytics)
   */
  static async batchEvaluateUsers(userIds: string[]): Promise<Map<string, ThresholdEvaluationResult>> {
    const results = new Map<string, ThresholdEvaluationResult>();

    for (const userId of userIds) {
      try {
        const result = await this.evaluateUserFitness(userId);
        results.set(userId, result);
      } catch (error) {
        logger.error(`Failed to evaluate user ${userId}:`, error);
        // Continue with other users
      }
    }

    return results;
  }

  /**
   * Get fitness threshold statistics
   */
  static async getThresholdStatistics(): Promise<{
    currentThreshold: FitnessThreshold | null;
    totalEvaluations: number;
    passRate: number;
    averageScore: number;
    commonFailureReasons: { reason: string; count: number }[];
  }> {
    const threshold = await FitnessThresholdModel.getCurrent();
    
    // This would typically be stored in a separate evaluations table
    // For now, return basic statistics
    return {
      currentThreshold: threshold,
      totalEvaluations: 0,
      passRate: 0,
      averageScore: 0,
      commonFailureReasons: [],
    };
  }

  /**
   * Admin: Update fitness threshold
   */
  static async updateThreshold(update: AdminThresholdUpdate): Promise<FitnessThreshold> {
    try {
      // Validate threshold values
      this.validateThresholdValues(update);

      // Convert AdminThresholdUpdate to UpdateFitnessThresholdInput
      const updateInput = {
        ...update,
        averagePace: update.averagePace === undefined ? null : update.averagePace,
      };

      const updatedThreshold = await FitnessThresholdModel.update(updateInput);
      
      logger.info(`Fitness threshold updated by ${update.updatedBy}`, {
        thresholdId: updatedThreshold.id,
        changes: update,
      });

      return updatedThreshold;
    } catch (error) {
      logger.error('Failed to update fitness threshold:', error);
      throw error;
    }
  }

  /**
   * Validate threshold values
   */
  private static validateThresholdValues(update: AdminThresholdUpdate): void {
    if (update.weeklyDistance !== undefined) {
      if (update.weeklyDistance < 0 || update.weeklyDistance > 100000) {
        throw new Error('Weekly distance must be between 0 and 100,000 meters');
      }
    }

    if (update.weeklyActivities !== undefined) {
      if (update.weeklyActivities < 0 || update.weeklyActivities > 50) {
        throw new Error('Weekly activities must be between 0 and 50');
      }
    }

    if (update.averagePace !== undefined && update.averagePace !== null) {
      if (update.averagePace < 180 || update.averagePace > 1200) {
        throw new Error('Average pace must be between 3:00 and 20:00 per km (180-1200 seconds)');
      }
    }

    if (update.allowedActivityTypes !== undefined) {
      const validTypes = ['Run', 'Ride', 'Swim', 'Walk', 'Hike', 'WeightTraining', 'Yoga', 'Crossfit'];
      const invalidTypes = update.allowedActivityTypes.filter(type => !validTypes.includes(type));
      if (invalidTypes.length > 0) {
        throw new Error(`Invalid activity types: ${invalidTypes.join(', ')}`);
      }
    }
  }

  /**
   * Admin: Get threshold history
   */
  static async getThresholdHistory(days: number = 30): Promise<FitnessThreshold[]> {
    return await FitnessThresholdModel.getHistory(days);
  }

  /**
   * Admin: Initialize default threshold if none exists
   */
  static async initializeDefaultThreshold(): Promise<FitnessThreshold> {
    return await FitnessThresholdModel.initializeDefault();
  }

  /**
   * Get user admission decision
   */
  static async getUserAdmissionDecision(userId: string): Promise<{
    admitted: boolean;
    evaluation: ThresholdEvaluationResult;
    message: string;
  }> {
    const evaluation = await this.evaluateUserFitness(userId);
    
    let message: string;
    if (evaluation.meets) {
      message = `Congratulations! Your fitness level meets our community standards. Score: ${evaluation.score}/100`;
    } else {
      message = `Your current fitness level doesn't meet our minimum requirements. Please continue training and try again in a few weeks.`;
    }

    return {
      admitted: evaluation.meets,
      evaluation,
      message,
    };
  }
}