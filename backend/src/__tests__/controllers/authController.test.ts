import { Request, Response } from 'express';
import { authController } from '../../controllers/authController';
import { authService } from '../../services/authService';
import { tokenService } from '../../services/tokenService';
import { UserRegistrationService } from '../../services/userRegistrationService';
// PhotoUploadService is mocked but not used in these basic tests
import { UserModel } from '../../models/User';

// Mock all dependencies
jest.mock('../../services/authService');
jest.mock('../../services/tokenService');
jest.mock('../../services/userRegistrationService');
// jest.mock('../../services/photoUploadService'); // Not used in basic auth tests
jest.mock('../../models/User');

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockTokenService = tokenService as jest.Mocked<typeof tokenService>;
const mockUserRegistrationService = UserRegistrationService as jest.Mocked<typeof UserRegistrationService>;
// We'll mock PhotoUploadService methods as needed in specific tests
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;

// Mock Express Request and Response
const mockRequest = (overrides = {}) => {
  return {
    query: {},
    body: {},
    params: {},
    user: undefined,
    files: undefined,
    ...overrides,
  } as unknown as Request;
};

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  res.redirect = jest.fn().mockReturnThis();
  return res;
};

describe('AuthController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console methods to reduce test noise
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initiateStravaAuth', () => {
    it('should generate Strava auth URL successfully', async () => {
      const mockAuthUrl = 'https://strava.com/oauth/authorize?client_id=123';
      mockAuthService.generateStravaAuthUrl.mockReturnValue(mockAuthUrl);

      const req = mockRequest();
      const res = mockResponse();

      await authController.initiateStravaAuth(req, res);

      expect(mockAuthService.generateStravaAuthUrl).toHaveBeenCalledWith(expect.any(String));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          authUrl: mockAuthUrl,
          state: expect.any(String),
        },
        message: 'Strava authorization URL generated successfully',
      });
    });

    it('should handle errors gracefully', async () => {
      mockAuthService.generateStravaAuthUrl.mockImplementation(() => {
        throw new Error('Auth service error');
      });

      const req = mockRequest();
      const res = mockResponse();

      await authController.initiateStravaAuth(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'Failed to initiate Strava authentication',
      });
    });
  });

  describe('handleStravaCallback', () => {
    const frontendUrl = 'http://localhost:3000';

    beforeEach(() => {
      process.env.FRONTEND_URL = frontendUrl;
    });

    it('should redirect to frontend with code and state on success', async () => {
      const req = mockRequest({
        query: { code: 'auth_code_123', state: 'state_456' }
      });
      const res = mockResponse();

      await authController.handleStravaCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        `${frontendUrl}/auth/callback?code=auth_code_123&state=state_456`
      );
    });

    it('should redirect with error when OAuth error is present', async () => {
      const req = mockRequest({
        query: { error: 'access_denied', state: 'state_456' }
      });
      const res = mockResponse();

      await authController.handleStravaCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        `${frontendUrl}/auth/callback?error=access_denied&state=state_456`
      );
    });

    it('should redirect with missing_code error when code is not provided', async () => {
      const req = mockRequest({
        query: { state: 'state_456' }
      });
      const res = mockResponse();

      await authController.handleStravaCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        `${frontendUrl}/auth/callback?error=missing_code&state=state_456`
      );
    });

    it('should redirect with server_error on exception', async () => {
      const req = mockRequest({
        query: { code: 'auth_code_123' }
      });
      const res = mockResponse();

      // Mock redirect to throw an error
      res.redirect = jest.fn().mockImplementation(() => {
        throw new Error('Redirect error');
      });

      await authController.handleStravaCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        `${frontendUrl}/auth/callback?error=server_error`
      );
    });
  });

  describe('completeStravaAuth', () => {
    it('should complete authentication for existing user', async () => {
      const mockStravaResponse = {
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_123',
        athlete: {
          id: 12345,
          username: 'john_doe',
          firstname: 'John',
          lastname: 'Doe',
          city: 'San Francisco',
          state: 'CA',
          country: 'US',
          sex: 'M',
          profile: 'https://dgalywyr863hv.cloudfront.net/pictures/athletes/123/large.jpg',
          profile_medium: 'https://dgalywyr863hv.cloudfront.net/pictures/athletes/123/medium.jpg',
        }
      };

      const mockUser = {
        id: 'user_1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        stravaId: 12345,
        age: 30,
        gender: 'male',
        city: 'San Francisco',
        state: 'CA',
        latitude: 37.7749,
        longitude: -122.4194,
        bio: 'Love running',
        photos: ['photo1.jpg'],
        createdAt: new Date(),
        lastActive: new Date(),
      };

      const req = mockRequest({
        query: { code: 'auth_code_123' }
      });
      const res = mockResponse();

      mockAuthService.exchangeCodeForTokens.mockResolvedValue(mockStravaResponse);
      mockUserModel.findByStravaId.mockResolvedValue(mockUser);
      mockAuthService.generateAccessToken.mockReturnValue('jwt_access_token');
      mockAuthService.generateRefreshToken.mockReturnValue('jwt_refresh_token');

      await authController.completeStravaAuth(req, res);

      expect(mockAuthService.exchangeCodeForTokens).toHaveBeenCalledWith('auth_code_123');
      expect(mockUserModel.findByStravaId).toHaveBeenCalledWith(12345);
      expect(mockTokenService.storeStravaTokens).toHaveBeenCalled();
      expect(mockTokenService.storeUserSession).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: {
            id: mockUser.id,
            email: mockUser.email,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
            stravaId: mockUser.stravaId,
          },
          tokens: {
            accessToken: 'jwt_access_token',
            refreshToken: 'jwt_refresh_token',
            expiresIn: '1h',
          },
        },
        message: 'Login successful',
      });
    });

    it('should register new user when user does not exist', async () => {
      const mockStravaResponse = {
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_123',
        athlete: {
          id: 12345,
          username: 'john_doe',
          firstname: 'John',
          lastname: 'Doe',
          city: 'San Francisco',
          state: 'CA',
          country: 'US',
          sex: 'M',
          profile: 'https://dgalywyr863hv.cloudfront.net/pictures/athletes/123/large.jpg',
          profile_medium: 'https://dgalywyr863hv.cloudfront.net/pictures/athletes/123/medium.jpg',
        }
      };

      const mockNewUser = {
        id: 'user_1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        stravaId: 12345,
        age: 30,
        gender: 'male',
        city: 'San Francisco',
        state: 'CA',
        latitude: 37.7749,
        longitude: -122.4194,
        bio: 'Love running',
        photos: ['photo1.jpg'],
        createdAt: new Date(),
        lastActive: new Date(),
      };

      const mockRegistrationResult = {
        success: true,
        user: mockNewUser,
        message: 'Registration successful',
        fitnessEvaluation: { score: 85 }
      };

      const req = mockRequest({
        query: { code: 'auth_code_123' }
      });
      const res = mockResponse();

      mockAuthService.exchangeCodeForTokens.mockResolvedValue(mockStravaResponse);
      mockUserModel.findByStravaId.mockResolvedValue(null);
      mockUserRegistrationService.registerUser.mockResolvedValue(mockRegistrationResult);
      mockAuthService.generateAccessToken.mockReturnValue('jwt_access_token');
      mockAuthService.generateRefreshToken.mockReturnValue('jwt_refresh_token');

      await authController.completeStravaAuth(req, res);

      expect(mockUserRegistrationService.registerUser).toHaveBeenCalledWith({
        stravaAuthResponse: mockStravaResponse,
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: {
            id: mockNewUser.id,
            email: mockNewUser.email,
            firstName: mockNewUser.firstName,
            lastName: mockNewUser.lastName,
            stravaId: mockNewUser.stravaId,
          },
          tokens: {
            accessToken: 'jwt_access_token',
            refreshToken: 'jwt_refresh_token',
            expiresIn: '1h',
          },
          fitnessEvaluation: { score: 85 },
        },
        message: 'Registration successful',
      });
    });

    it('should return 400 when code is missing', async () => {
      const req = mockRequest({
        query: {}
      });
      const res = mockResponse();

      await authController.completeStravaAuth(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing authorization code',
        message: 'Authorization code is required',
      });
    });

    it('should handle code exchange failure with specific error for already used code', async () => {
      const req = mockRequest({
        query: { code: 'used_code_123' }
      });
      const res = mockResponse();

      const error = new Error('Bad Request - authorization code already used');
      mockAuthService.exchangeCodeForTokens.mockRejectedValue(error);

      await authController.completeStravaAuth(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'AUTH_CODE_ALREADY_USED',
        message: 'This authorization code has already been used. Please go back to the login page and try again.',
      });
    });

    it('should handle registration failure', async () => {
      const mockStravaResponse = {
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_123',
        athlete: {
          id: 12345,
          username: 'john_doe',
          firstname: 'John',
          lastname: 'Doe',
          city: 'San Francisco',
          state: 'CA',
          country: 'US',
          sex: 'M',
          profile: 'https://dgalywyr863hv.cloudfront.net/pictures/athletes/123/large.jpg',
          profile_medium: 'https://dgalywyr863hv.cloudfront.net/pictures/athletes/123/medium.jpg',
        }
      };

      const mockRegistrationResult = {
        success: false,
        error: 'REGISTRATION_FAILED',
        message: 'Registration failed',
        fitnessEvaluation: null
      };

      const req = mockRequest({
        query: { code: 'auth_code_123' }
      });
      const res = mockResponse();

      mockAuthService.exchangeCodeForTokens.mockResolvedValue(mockStravaResponse);
      mockUserModel.findByStravaId.mockResolvedValue(null);
      mockUserRegistrationService.registerUser.mockResolvedValue(mockRegistrationResult);

      await authController.completeStravaAuth(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'REGISTRATION_FAILED',
        message: 'Registration failed',
        data: {
          fitnessEvaluation: null,
        },
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockPayload = { userId: 'user_1' };
      const req = mockRequest({
        body: { refreshToken: 'refresh_token_123' }
      });
      const res = mockResponse();

      mockTokenService.isRefreshTokenBlacklisted.mockResolvedValue(false);
      mockAuthService.verifyRefreshToken.mockReturnValue(mockPayload);
      mockAuthService.generateAccessToken.mockReturnValue('new_access_token');
      mockAuthService.generateRefreshToken.mockReturnValue('new_refresh_token');

      await authController.refreshToken(req, res);

      expect(mockTokenService.isRefreshTokenBlacklisted).toHaveBeenCalledWith('refresh_token_123');
      expect(mockAuthService.verifyRefreshToken).toHaveBeenCalledWith('refresh_token_123');
      expect(mockTokenService.blacklistRefreshToken).toHaveBeenCalledWith('refresh_token_123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          accessToken: 'new_access_token',
          refreshToken: 'new_refresh_token',
          expiresIn: '1h',
        },
        message: 'Token refreshed successfully',
      });
    });

    it('should return 400 when refresh token is missing', async () => {
      const req = mockRequest({
        body: {}
      });
      const res = mockResponse();

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing refresh token',
        message: 'Refresh token is required',
      });
    });

    it('should return 401 when refresh token is blacklisted', async () => {
      const req = mockRequest({
        body: { refreshToken: 'blacklisted_token' }
      });
      const res = mockResponse();

      mockTokenService.isRefreshTokenBlacklisted.mockResolvedValue(true);

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid refresh token',
        message: 'Refresh token has been revoked',
      });
    });

    it('should handle token verification errors', async () => {
      const req = mockRequest({
        body: { refreshToken: 'invalid_token' }
      });
      const res = mockResponse();

      mockTokenService.isRefreshTokenBlacklisted.mockResolvedValue(false);
      mockAuthService.verifyRefreshToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token refresh failed',
        message: 'Invalid token',
      });
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const req = mockRequest({
        body: { refreshToken: 'refresh_token_123' },
        user: { userId: 'user_1' }
      });
      const res = mockResponse();

      await authController.logout(req, res);

      expect(mockTokenService.blacklistRefreshToken).toHaveBeenCalledWith('refresh_token_123');
      expect(mockTokenService.removeUserSession).toHaveBeenCalledWith('user_1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully',
      });
    });

    it('should logout without refresh token', async () => {
      const req = mockRequest({
        body: {},
        user: { userId: 'user_1' }
      });
      const res = mockResponse();

      await authController.logout(req, res);

      expect(mockTokenService.blacklistRefreshToken).not.toHaveBeenCalled();
      expect(mockTokenService.removeUserSession).toHaveBeenCalledWith('user_1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully',
      });
    });

    it('should handle logout errors', async () => {
      const req = mockRequest({
        body: { refreshToken: 'refresh_token_123' },
        user: { userId: 'user_1' }
      });
      const res = mockResponse();

      mockTokenService.blacklistRefreshToken.mockRejectedValue(new Error('Database error'));

      await authController.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Logout failed',
        message: 'Failed to logout user',
      });
    });
  });

  describe('getProfile', () => {
    it('should get user profile successfully', async () => {
      const mockUser = {
        id: 'user_1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        stravaId: 12345,
        age: 30,
        gender: 'male',
        city: 'San Francisco',
        state: 'CA',
        bio: 'Love running',
        photos: ['photo1.jpg'],
        lastActive: new Date(),
        createdAt: new Date(),
        latitude: 37.7749,
        longitude: -122.4194,
      };

      const mockSessionData = {
        lastLogin: new Date(),
        stravaConnected: true,
      };

      const req = mockRequest({
        user: { userId: 'user_1' }
      });
      const res = mockResponse();

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockTokenService.getUserSession.mockResolvedValue(mockSessionData);

      await authController.getProfile(req, res);

      expect(mockUserModel.findById).toHaveBeenCalledWith('user_1');
      expect(mockTokenService.getUserSession).toHaveBeenCalledWith('user_1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: mockUser,
          session: mockSessionData,
        },
        message: 'Profile retrieved successfully',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await authController.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    });

    it('should return 404 when user is not found', async () => {
      const req = mockRequest({
        user: { userId: 'user_1' }
      });
      const res = mockResponse();

      mockUserModel.findById.mockResolvedValue(null);

      await authController.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
        message: 'User profile not found',
      });
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const mockUpdatedUser = {
        id: 'user_1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        stravaId: 12345,
        age: 31,
        gender: 'male',
        city: 'Oakland',
        state: 'CA',
        latitude: 37.8044,
        longitude: -122.2712,
        bio: 'Updated bio',
        photos: ['photo1.jpg'],
        createdAt: new Date(),
        lastActive: new Date(),
      };

      const req = mockRequest({
        user: { userId: 'user_1' },
        body: {
          age: 31,
          bio: 'Updated bio',
          city: 'Oakland',
          state: 'CA',
          gender: 'male',
        }
      });
      const res = mockResponse();

      mockUserRegistrationService.updateUserProfile.mockResolvedValue(mockUpdatedUser);

      await authController.updateProfile(req, res);

      expect(mockUserRegistrationService.updateUserProfile).toHaveBeenCalledWith('user_1', {
        age: 31,
        bio: 'Updated bio',
        city: 'Oakland',
        state: 'CA',
        gender: 'male',
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: mockUpdatedUser,
        },
        message: 'Profile updated successfully',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      const req = mockRequest({
        body: { age: 31 }
      });
      const res = mockResponse();

      await authController.updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    });

    it('should handle update errors', async () => {
      const req = mockRequest({
        user: { userId: 'user_1' },
        body: { age: 31 }
      });
      const res = mockResponse();

      mockUserRegistrationService.updateUserProfile.mockRejectedValue(new Error('Update failed'));

      await authController.updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Profile update failed',
        message: 'Update failed',
      });
    });
  });

  describe('checkRegistrationStatus', () => {
    it('should return registration status successfully', async () => {
      const mockStatus = {
        exists: true,
        user: {
          id: 'user_1',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          stravaId: 12345,
          age: 30,
          gender: 'male',
          city: 'San Francisco',
          state: 'CA',
          latitude: 37.7749,
          longitude: -122.4194,
          bio: 'Love running',
          photos: ['photo1.jpg'],
          createdAt: new Date(),
          lastActive: new Date(),
        },
        canRegister: false,
        message: 'User already registered',
      };

      const req = mockRequest({
        params: { stravaId: '12345' }
      });
      const res = mockResponse();

      mockUserRegistrationService.getRegistrationStatus.mockResolvedValue(mockStatus);

      await authController.checkRegistrationStatus(req, res);

      expect(mockUserRegistrationService.getRegistrationStatus).toHaveBeenCalledWith(12345);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatus,
        message: 'Registration status retrieved successfully',
      });
    });

    it('should return 400 for invalid Strava ID', async () => {
      const req = mockRequest({
        params: { stravaId: 'invalid' }
      });
      const res = mockResponse();

      await authController.checkRegistrationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid Strava ID',
        message: 'Valid Strava ID is required',
      });
    });
  });

  describe('revokeStravaAccess', () => {
    it('should revoke Strava access successfully', async () => {
      const req = mockRequest({
        user: { userId: 'user_1' }
      });
      const res = mockResponse();

      await authController.revokeStravaAccess(req, res);

      expect(mockTokenService.removeStravaTokens).toHaveBeenCalledWith('user_1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Strava access revoked successfully',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await authController.revokeStravaAccess(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    });
  });

  describe('handleStravaAccessRevoked', () => {
    it('should handle Strava access revocation and return 403 with specific message', async () => {
      const req = mockRequest({
        user: { userId: 'user_1' }
      });
      const res = mockResponse();

      await authController.handleStravaAccessRevoked(req, res);

      expect(mockTokenService.removeStravaTokens).toHaveBeenCalledWith('user_1');
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Strava access revoked',
        message: 'Your Strava connection has been revoked, and we can no longer access your data. Please reconnect your Strava account to continue using the app.',
        code: 'STRAVA_ACCESS_REVOKED',
        ui: {
          showWarning: true,
          displayMessage: 'Your Strava connection has been revoked, and we can no longer access your data.',
          actionRequired: 'reconnect_strava',
        },
      });
    });
  });
});