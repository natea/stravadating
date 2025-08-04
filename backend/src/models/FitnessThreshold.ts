import { prisma } from '../config/database';
import { FitnessThreshold, CreateFitnessThresholdInput, UpdateFitnessThresholdInput } from '../types';
import { FitnessThreshold as PrismaFitnessThreshold } from '../generated/prisma';

// Helper function to convert Prisma model to our type
const convertPrismaToFitnessThreshold = (prismaThreshold: PrismaFitnessThreshold): FitnessThreshold => ({
  ...prismaThreshold,
  allowedActivityTypes: Array.isArray(prismaThreshold.allowedActivityTypes) 
    ? prismaThreshold.allowedActivityTypes as string[]
    : [],
});

export class FitnessThresholdModel {
  /**
   * Create a new fitness threshold
   */
  static async create(data: CreateFitnessThresholdInput): Promise<FitnessThreshold> {
    const result = await prisma.fitnessThreshold.create({
      data: {
        ...data,
        allowedActivityTypes: data.allowedActivityTypes || [],
      },
    });
    return convertPrismaToFitnessThreshold(result);
  }

  /**
   * Get the current active fitness threshold
   */
  static async getCurrent(): Promise<FitnessThreshold | null> {
    const result = await prisma.fitnessThreshold.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    return result ? convertPrismaToFitnessThreshold(result) : null;
  }

  /**
   * Update fitness threshold (creates a new record for audit trail)
   */
  static async update(data: UpdateFitnessThresholdInput): Promise<FitnessThreshold> {
    const current = await this.getCurrent();
    
    const result = await prisma.fitnessThreshold.create({
      data: {
        weeklyDistance: data.weeklyDistance ?? current?.weeklyDistance ?? 0,
        weeklyActivities: data.weeklyActivities ?? current?.weeklyActivities ?? 0,
        averagePace: data.averagePace ?? current?.averagePace ?? null,
        allowedActivityTypes: data.allowedActivityTypes ?? current?.allowedActivityTypes ?? [],
        updatedBy: data.updatedBy ?? 'system',
      },
    });
    return convertPrismaToFitnessThreshold(result);
  }

  /**
   * Get all fitness thresholds (for audit trail)
   */
  static async getAll(): Promise<FitnessThreshold[]> {
    const results = await prisma.fitnessThreshold.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return results.map(convertPrismaToFitnessThreshold);
  }

  /**
   * Get fitness threshold by ID
   */
  static async findById(id: string): Promise<FitnessThreshold | null> {
    const result = await prisma.fitnessThreshold.findUnique({
      where: { id },
    });
    return result ? convertPrismaToFitnessThreshold(result) : null;
  }

  /**
   * Check if user meets current fitness threshold
   */
  static async checkUserMeetsThreshold(
    weeklyDistance: number,
    weeklyActivities: number,
    averagePace?: number,
    activityTypes: string[] = []
  ): Promise<{
    meets: boolean;
    threshold: FitnessThreshold | null;
    reasons: string[];
  }> {
    const threshold = await this.getCurrent();
    
    if (!threshold) {
      return {
        meets: true,
        threshold: null,
        reasons: ['No fitness threshold configured'],
      };
    }

    const reasons: string[] = [];
    let meets = true;

    // Check weekly distance
    if (weeklyDistance < threshold.weeklyDistance) {
      meets = false;
      reasons.push(`Weekly distance ${weeklyDistance}m is below required ${threshold.weeklyDistance}m`);
    }

    // Check weekly activities
    if (weeklyActivities < threshold.weeklyActivities) {
      meets = false;
      reasons.push(`Weekly activities ${weeklyActivities} is below required ${threshold.weeklyActivities}`);
    }

    // Check average pace if specified
    if (threshold.averagePace && averagePace && averagePace > threshold.averagePace) {
      meets = false;
      reasons.push(`Average pace ${averagePace}s/km is slower than required ${threshold.averagePace}s/km`);
    }

    // Check activity types if specified
    const allowedTypes = threshold.allowedActivityTypes as string[];
    if (allowedTypes.length > 0) {
      const hasAllowedActivity = activityTypes.some(type => allowedTypes.includes(type));
      if (!hasAllowedActivity) {
        meets = false;
        reasons.push(`No activities match allowed types: ${allowedTypes.join(', ')}`);
      }
    }

    if (meets) {
      reasons.push('All fitness requirements met');
    }

    return {
      meets,
      threshold,
      reasons,
    };
  }

  /**
   * Get default fitness threshold values
   */
  static getDefaultThreshold(): CreateFitnessThresholdInput {
    return {
      weeklyDistance: 10000, // 10km per week
      weeklyActivities: 3, // 3 activities per week
      averagePace: 360, // 6 minutes per km (360 seconds)
      allowedActivityTypes: ['Run', 'Ride', 'Swim', 'Hike', 'Walk'],
      updatedBy: 'system',
    };
  }

  /**
   * Initialize default threshold if none exists
   */
  static async initializeDefault(): Promise<FitnessThreshold> {
    const existing = await this.getCurrent();
    if (existing) {
      return existing;
    }

    return await this.create(this.getDefaultThreshold());
  }

  /**
   * Get threshold history for a specific time period
   */
  static async getHistory(days: number = 30): Promise<FitnessThreshold[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await prisma.fitnessThreshold.findMany({
      where: {
        updatedAt: {
          gte: startDate,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return results.map(convertPrismaToFitnessThreshold);
  }

  /**
   * Delete old threshold records (keep last N records)
   */
  static async cleanupOldRecords(keepCount: number = 10): Promise<number> {
    const thresholds = await prisma.fitnessThreshold.findMany({
      orderBy: { updatedAt: 'desc' },
      skip: keepCount,
      select: { id: true },
    });

    if (thresholds.length === 0) {
      return 0;
    }

    const idsToDelete = thresholds.map(t => t.id);
    const result = await prisma.fitnessThreshold.deleteMany({
      where: {
        id: {
          in: idsToDelete,
        },
      },
    });

    return result.count;
  }
}