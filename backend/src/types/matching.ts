export interface Match {
  id: string;
  user1Id: string;
  user2Id: string;
  compatibilityScore: number;
  matchedAt: Date;
  status: 'active' | 'archived';
}

export interface CreateMatchInput {
  user1Id: string;
  user2Id: string;
  compatibilityScore: number;
}

export interface UpdateMatchInput {
  compatibilityScore?: number;
  status?: 'active' | 'archived';
}

export interface MatchingPreferences {
  id: string;
  userId: string;
  minAge: number;
  maxAge: number;
  maxDistance: number;
  preferredActivities: string[];
  minCompatibilityScore: number;
}

export interface CreateMatchingPreferencesInput {
  userId: string;
  minAge?: number;
  maxAge?: number;
  maxDistance?: number;
  preferredActivities?: string[];
  minCompatibilityScore?: number;
}

export interface UpdateMatchingPreferencesInput {
  minAge?: number;
  maxAge?: number;
  maxDistance?: number;
  preferredActivities?: string[];
  minCompatibilityScore?: number;
}

export interface CompatibilityScore {
  userId: string;
  score: number;
  factors: {
    activityOverlap: number;
    performanceSimilarity: number;
    locationProximity: number;
    ageCompatibility: number;
  };
}