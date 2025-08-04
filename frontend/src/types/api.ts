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
  stravaId: number;
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