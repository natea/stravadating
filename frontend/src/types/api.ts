export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message: string;
  code?: string;
  ui?: {
    showWarning?: boolean;
    showRedScreen?: boolean;
    displayMessage?: string;
    actionRequired?: string;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  stravaId?: number;
  stravaAthleteId?: number;
  age: number;
  gender?: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  photos: string[];
  bio: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface StravaAuthData {
  authUrl: string;
  state: string;
}

// Error codes that the frontend should handle specially
export enum ApiErrorCode {
  STRAVA_ACCESS_REVOKED = 'STRAVA_ACCESS_REVOKED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

// UI action types that the backend can request
export enum UIAction {
  RECONNECT_STRAVA = 'reconnect_strava',
  LOGIN_REQUIRED = 'login_required',
  REFRESH_TOKEN = 'refresh_token',
}

export interface FitnessStats {
  id: string;
  userId: string;
  weeklyDistance: number;
  weeklyActivities: number;
  averagePace: number | null;
  favoriteActivities: string[];
  totalDistance: number;
  lastUpdated: Date;
}

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

export interface MatchingPreferences {
  id: string;
  userId: string;
  minAge: number;
  maxAge: number;
  maxDistance: number;
  preferredActivities: string[];
  minCompatibilityScore: number;
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  recipientId: string;
  content: string;
  sentAt: Date;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  matchId: string;
  participants: {
    id: string;
    firstName: string;
    lastName: string;
    photos: string[];
  }[];
  otherUser?: {
    id: string;
    firstName: string;
    lastName: string;
    photos: string[];
  };
  lastMessage: Message | null;
  unreadCount: number;
  createdAt: Date;
}
