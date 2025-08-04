// Mock environment variables first
const mockEnv = {
  STRAVA_CLIENT_ID: 'test-client-id',
  STRAVA_CLIENT_SECRET: 'test-client-secret',
  STRAVA_REDIRECT_URI: 'http://localhost:3001/auth/strava/callback',
  JWT_SECRET: 'test-jwt-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_EXPIRES_IN: '1h',
  JWT_REFRESH_EXPIRES_IN: '7d',
};

// Set environment variables before importing
Object.assign(process.env, mockEnv);

import axios from 'axios';
import jwt from 'jsonwebtoken';
import { User } from '../../types/user';
import { AuthService } from '../authService';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthService', () => {
  let authService: AuthService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = process.env;
    Object.assign(process.env, mockEnv);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with environment variables', () => {
      expect(() => new AuthService()).not.toThrow();
    });

    it('should throw error if Strava config is missing', () => {
      const originalClientId = process.env.STRAVA_CLIENT_ID;
      delete process.env.STRAVA_CLIENT_ID;
      
      expect(() => new AuthService()).toThrow('Missing required Strava OAuth configuration');
      
      process.env.STRAVA_CLIENT_ID = originalClientId;
    });

    it('should throw error if JWT config is missing', () => {
      const originalJwtSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      
      expect(() => new AuthService()).toThrow('Missing required JWT configuration');
      
      process.env.JWT_SECRET = originalJwtSecret;
    });
  });

  describe('generateStravaAuthUrl', () => {
    it('should generate correct authorization URL without state', () => {
      const url = authService.generateStravaAuthUrl();
      
      expect(url).toContain('https://www.strava.com/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fauth%2Fstrava%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=read%2Cactivity%3Aread_all');
      expect(url).toContain('approval_prompt=force');
    });

    it('should generate correct authorization URL with state', () => {
      const state = 'test-state-123';
      const url = authService.generateStravaAuthUrl(state);
      
      expect(url).toContain(`state=${state}`);
    });
  });

  describe('exchangeCodeForTokens', () => {
    const mockStravaResponse = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      athlete: {
        id: 12345,
        username: 'testuser',
        firstname: 'Test',
        lastname: 'User',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        sex: 'M',
        profile: 'https://example.com/profile.jpg',
        profile_medium: 'https://example.com/profile_medium.jpg',
      },
    };

    it('should successfully exchange code for tokens', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockStravaResponse });

      const result = await authService.exchangeCodeForTokens('test-code');

      expect(mockedAxios.post).toHaveBeenCalledWith('https://www.strava.com/oauth/token', {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        code: 'test-code',
        grant_type: 'authorization_code',
      });
      expect(result).toEqual(mockStravaResponse);
    });

    it('should handle Strava API errors', async () => {
      const errorResponse = {
        response: {
          data: {
            message: 'Invalid authorization code',
          },
        },
      };
      mockedAxios.post.mockRejectedValueOnce(errorResponse);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(authService.exchangeCodeForTokens('invalid-code'))
        .rejects.toThrow('Strava OAuth error: Invalid authorization code');
    });

    it('should handle network errors', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));
      mockedAxios.isAxiosError.mockReturnValueOnce(false);

      await expect(authService.exchangeCodeForTokens('test-code'))
        .rejects.toThrow('Failed to exchange authorization code for tokens');
    });
  });

  describe('refreshStravaToken', () => {
    const mockRefreshResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_at: 1234567890,
    };

    it('should successfully refresh token', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockRefreshResponse });

      const result = await authService.refreshStravaToken('old-refresh-token');

      expect(mockedAxios.post).toHaveBeenCalledWith('https://www.strava.com/oauth/token', {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        refresh_token: 'old-refresh-token',
        grant_type: 'refresh_token',
      });
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: 1234567890,
      });
    });

    it('should handle refresh token errors', async () => {
      const errorResponse = {
        response: {
          data: {
            message: 'Invalid refresh token',
          },
        },
      };
      mockedAxios.post.mockRejectedValueOnce(errorResponse);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(authService.refreshStravaToken('invalid-token'))
        .rejects.toThrow('Strava token refresh error: Invalid refresh token');
    });
  });

  describe('JWT token operations', () => {
    const mockUser: User = {
      id: 'user-123',
      email: 'test@example.com',
      stravaId: 12345,
      firstName: 'Test',
      lastName: 'User',
      age: 25,
      city: 'San Francisco',
      state: 'CA',
      latitude: 37.7749,
      longitude: -122.4194,
      bio: 'Test bio',
      photos: [],
      createdAt: new Date(),
      lastActive: new Date(),
    };

    describe('generateAccessToken', () => {
      it('should generate valid access token', () => {
        const token = authService.generateAccessToken(mockUser);
        
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
        
        // Verify token payload
        const payload = jwt.verify(token, mockEnv.JWT_SECRET) as any;
        expect(payload.userId).toBe(mockUser.id);
        expect(payload.stravaId).toBe(mockUser.stravaId);
        expect(payload.email).toBe(mockUser.email);
        expect(payload.iss).toBe('fitness-dating-app');
        expect(payload.aud).toBe('fitness-dating-users');
      });
    });

    describe('generateRefreshToken', () => {
      it('should generate valid refresh token', () => {
        const token = authService.generateRefreshToken(mockUser);
        
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3);
        
        // Verify token payload
        const payload = jwt.verify(token, mockEnv.JWT_REFRESH_SECRET) as any;
        expect(payload.userId).toBe(mockUser.id);
        expect(payload.type).toBe('refresh');
        expect(payload.iss).toBe('fitness-dating-app');
        expect(payload.aud).toBe('fitness-dating-users');
      });
    });

    describe('verifyAccessToken', () => {
      it('should verify valid access token', () => {
        const token = authService.generateAccessToken(mockUser);
        const payload = authService.verifyAccessToken(token);
        
        expect(payload.userId).toBe(mockUser.id);
        expect(payload.stravaId).toBe(mockUser.stravaId);
        expect(payload.email).toBe(mockUser.email);
      });

      it('should throw error for invalid token', () => {
        expect(() => authService.verifyAccessToken('invalid-token'))
          .toThrow('Invalid access token');
      });

      it('should throw error for expired token', () => {
        const expiredToken = jwt.sign(
          { userId: mockUser.id },
          mockEnv.JWT_SECRET,
          { expiresIn: '-1h' }
        );
        
        expect(() => authService.verifyAccessToken(expiredToken))
          .toThrow('Access token expired');
      });
    });

    describe('verifyRefreshToken', () => {
      it('should verify valid refresh token', () => {
        const token = authService.generateRefreshToken(mockUser);
        const payload = authService.verifyRefreshToken(token);
        
        expect(payload.userId).toBe(mockUser.id);
        expect(payload.type).toBe('refresh');
      });

      it('should throw error for access token used as refresh token', () => {
        const accessToken = authService.generateAccessToken(mockUser);
        
        expect(() => authService.verifyRefreshToken(accessToken))
          .toThrow('Invalid refresh token');
      });

      it('should throw error for invalid refresh token', () => {
        expect(() => authService.verifyRefreshToken('invalid-token'))
          .toThrow('Invalid refresh token');
      });
    });
  });

  describe('extractBearerToken', () => {
    it('should extract token from valid Bearer header', () => {
      const token = authService.extractBearerToken('Bearer test-token-123');
      expect(token).toBe('test-token-123');
    });

    it('should return null for missing header', () => {
      const token = authService.extractBearerToken(undefined);
      expect(token).toBeNull();
    });

    it('should return null for invalid header format', () => {
      const token = authService.extractBearerToken('Invalid test-token-123');
      expect(token).toBeNull();
    });

    it('should return null for empty Bearer header', () => {
      const token = authService.extractBearerToken('Bearer ');
      expect(token).toBe('');
    });
  });
});