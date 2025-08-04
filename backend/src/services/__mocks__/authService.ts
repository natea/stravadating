export const authService = {
  generateStravaAuthUrl: jest.fn(),
  exchangeCodeForTokens: jest.fn(),
  refreshStravaToken: jest.fn(),
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  verifyAccessToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
  extractBearerToken: jest.fn(),
};

export class AuthService {
  generateStravaAuthUrl = authService.generateStravaAuthUrl;
  exchangeCodeForTokens = authService.exchangeCodeForTokens;
  refreshStravaToken = authService.refreshStravaToken;
  generateAccessToken = authService.generateAccessToken;
  generateRefreshToken = authService.generateRefreshToken;
  verifyAccessToken = authService.verifyAccessToken;
  verifyRefreshToken = authService.verifyRefreshToken;
  extractBearerToken = authService.extractBearerToken;
}