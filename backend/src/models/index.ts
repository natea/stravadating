// Export all models
export { UserModel } from './User';
export { FitnessStatsModel } from './FitnessStats';
export { StravaActivityModel } from './StravaActivity';
export { MatchModel } from './Match';
export { MatchingPreferencesModel } from './MatchingPreferences';
export { MessageModel } from './Message';
export { FitnessThresholdModel } from './FitnessThreshold';

// Re-export Prisma client for direct access when needed
export { prisma } from '../config/database';