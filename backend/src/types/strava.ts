export interface StravaActivity {
  id: number;
  userId: string;
  name: string;
  type: string;
  distance: number;
  movingTime: number;
  averageSpeed: number;
  startDate: Date;
  elevationGain: number;
  syncedAt: Date;
}

export interface CreateStravaActivityInput {
  id: number;
  userId: string;
  name: string;
  type: string;
  distance: number;
  movingTime: number;
  averageSpeed: number;
  startDate: Date;
  elevationGain: number;
}

export interface StravaAuthResponse {
  access_token: string;
  refresh_token: string;
  athlete: StravaAthlete;
}

export interface StravaAthlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  city: string;
  state: string;
  country: string;
  sex: string;
  profile: string;
  profile_medium: string;
}

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}