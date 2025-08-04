import { Request, Response, NextFunction } from 'express';

// Mock authService
jest.mock('../../services/authService');

const mockedAuthService = {
  extractBearerToken: jest.fn(),
  verifyAccessToken: jest.fn(),
};

// Mock the authService import
jest.doMock('../../services/authService', () => ({
  authService: mockedAuthService,
}));

import { authenticateToken, optionalAuth, requireStravaAuth } from '../auth';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token successfully', () => {
      const mockPayload = {
        userId: 'user-123',
        stravaId: 12345,
        email: 'test@example.com',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      mockedAuthService.extractBearerToken.mockReturnValue('valid-token');
      mockedAuthService.verifyAccessToken.mockReturnValue(mockPayload);

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockedAuthService.extractBearerToken).toHaveBeenCalledWith('Bearer valid-token');
      expect(mockedAuthService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 when no authorization header', () => {
      mockRequest.headers = {};
      mockedAuthService.extractBearerToken.mockReturnValue(null);

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access token required',
        message: 'Please provide a valid access token in the Authorization header',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      mockedAuthService.extractBearerToken.mockReturnValue('invalid-token');
      mockedAuthService.verifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
        message: 'Invalid token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired', () => {
      mockRequest.headers = {
        authorization: 'Bearer expired-token',
      };

      mockedAuthService.extractBearerToken.mockReturnValue('expired-token');
      mockedAuthService.verifyAccessToken.mockImplementation(() => {
        throw new Error('Access token expired');
      });

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
        message: 'Access token expired',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      mockedAuthService.extractBearerToken.mockReturnValue('invalid-token');
      mockedAuthService.verifyAccessToken.mockImplementation(() => {
        throw 'String error';
      });

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
        message: 'Token verification failed',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should authenticate valid token when provided', () => {
      const mockPayload = {
        userId: 'user-123',
        stravaId: 12345,
        email: 'test@example.com',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      mockedAuthService.extractBearerToken.mockReturnValue('valid-token');
      mockedAuthService.verifyAccessToken.mockReturnValue(mockPayload);

      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should proceed without user when no token provided', () => {
      mockRequest.headers = {};
      mockedAuthService.extractBearerToken.mockReturnValue(null);

      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should proceed without user when token is invalid', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      mockedAuthService.extractBearerToken.mockReturnValue('invalid-token');
      mockedAuthService.verifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('requireStravaAuth', () => {
    it('should proceed when user has Strava ID', () => {
      mockRequest.user = {
        userId: 'user-123',
        stravaId: 12345,
        email: 'test@example.com',
      };

      requireStravaAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user has no Strava ID', () => {
      mockRequest.user = {
        userId: 'user-123',
        stravaId: 0, // No Strava ID
        email: 'test@example.com',
      };

      requireStravaAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Strava authentication required',
        message: 'This endpoint requires Strava account connection',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when no user is authenticated', () => {
      delete mockRequest.user;

      requireStravaAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Strava authentication required',
        message: 'This endpoint requires Strava account connection',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user object exists but stravaId is undefined', () => {
      mockRequest.user = {
        userId: 'user-123',
        stravaId: undefined as any,
        email: 'test@example.com',
      };

      requireStravaAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Strava authentication required',
        message: 'This endpoint requires Strava account connection',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // Note: ensureFreshStravaTokens middleware uses dynamic imports which are difficult to test
  // in the current Jest setup. The functionality is tested through integration tests
  // and the core logic is covered by the service layer tests.
});