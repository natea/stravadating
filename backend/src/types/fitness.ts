export interface FitnessStats {
  id: string;
  userId: string;
  weeklyDistance: number;
  weeklyActivities: number;
  averagePace?: number | null;
  favoriteActivities: string[];
  totalDistance: number;
  longestRun: number;
  lastSyncDate: Date;
}

export interface CreateFitnessStatsInput {
  userId: string;
  weeklyDistance: number;
  weeklyActivities: number;
  averagePace?: number | null;
  favoriteActivities: string[];
  totalDistance: number;
  longestRun: number;
}

export interface UpdateFitnessStatsInput {
  weeklyDistance?: number;
  weeklyActivities?: number;
  averagePace?: number | null;
  favoriteActivities?: string[];
  totalDistance?: number;
  longestRun?: number;
  lastSyncDate?: Date;
}

export interface FitnessThreshold {
  id: string;
  weeklyDistance: number;
  weeklyActivities: number;
  averagePace: number | null;
  allowedActivityTypes: string[];
  updatedAt: Date;
  updatedBy: string;
}

export interface CreateFitnessThresholdInput {
  weeklyDistance: number;
  weeklyActivities: number;
  averagePace?: number | null;
  allowedActivityTypes: string[];
  updatedBy: string;
}

export interface UpdateFitnessThresholdInput {
  weeklyDistance?: number;
  weeklyActivities?: number;
  averagePace?: number | null;
  allowedActivityTypes?: string[];
  updatedBy?: string;
}