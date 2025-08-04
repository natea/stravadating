// Mock Redis client
const mockRedisClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  hSet: jest.fn(),
  hGetAll: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
  setEx: jest.fn(),
  get: jest.fn(),
  on: jest.fn(),
};

// Mock createClient
jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

import { TokenService } from '../tokenService';
import { StravaTokens } from '../../types/strava';

describe('TokenService', () => {
  let tokenService: TokenService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      REDIS_PASSWORD: '',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.connect.mockResolvedValue(undefined);
    
    // Simulate successful connection
    tokenService = new TokenService();
    // Manually set connection status for testing
    (tokenService as any).isConnected = true;
  });

  describe('storeStravaTokens', () => {
    it('should store Strava tokens successfully', async () => {
      const userId = 'user-123';
      const tokens: StravaTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: 1234567890,
      };

      mockRedisClient.hSet.mockResolvedValueOnce(4);
      mockRedisClient.expire.mockResolvedValueOnce(1);

      await tokenService.storeStravaTokens(userId, tokens);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith(
        'strava_tokens:user-123',
        {
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-123',
          expiresAt: '1234567890',
          updatedAt: expect.any(String),
        }
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith('strava_tokens:user-123', 7 * 24 * 60 * 60);
    });

    it('should throw error when Redis is not connected', async () => {
      (tokenService as any).isConnected = false;
      
      const tokens: StravaTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: 1234567890,
      };

      await expect(tokenService.storeStravaTokens('user-123', tokens))
        .rejects.toThrow('Redis connection not available');
    });

    it('should handle Redis errors', async () => {
      mockRedisClient.hSet.mockRejectedValueOnce(new Error('Redis error'));

      const tokens: StravaTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: 1234567890,
      };

      await expect(tokenService.storeStravaTokens('user-123', tokens))
        .rejects.toThrow('Failed to store authentication tokens');
    });
  });

  describe('getStravaTokens', () => {
    it('should retrieve Strava tokens successfully', async () => {
      const mockTokenData = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: '1234567890',
        updatedAt: '1234567800',
      };

      mockRedisClient.hGetAll.mockResolvedValueOnce(mockTokenData);

      const result = await tokenService.getStravaTokens('user-123');

      expect(mockRedisClient.hGetAll).toHaveBeenCalledWith('strava_tokens:user-123');
      expect(result).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: 1234567890,
      });
    });

    it('should return null when no tokens found', async () => {
      mockRedisClient.hGetAll.mockResolvedValueOnce({});

      const result = await tokenService.getStravaTokens('user-123');

      expect(result).toBeNull();
    });

    it('should return null when Redis is not connected', async () => {
      (tokenService as any).isConnected = false;

      await expect(tokenService.getStravaTokens('user-123'))
        .rejects.toThrow('Redis connection not available');
    });

    it('should return null on Redis errors', async () => {
      mockRedisClient.hGetAll.mockRejectedValueOnce(new Error('Redis error'));

      const result = await tokenService.getStravaTokens('user-123');

      expect(result).toBeNull();
    });
  });

  describe('shouldRefreshToken', () => {
    it('should return true when token expires within 5 minutes', async () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 200; // Expires in 200 seconds (< 300)

      const mockTokenData = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: expiresAt.toString(),
      };

      mockRedisClient.hGetAll.mockResolvedValueOnce(mockTokenData);

      const result = await tokenService.shouldRefreshToken('user-123');

      expect(result).toBe(true);
    });

    it('should return false when token expires after 5 minutes', async () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 400; // Expires in 400 seconds (> 300)

      const mockTokenData = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: expiresAt.toString(),
      };

      mockRedisClient.hGetAll.mockResolvedValueOnce(mockTokenData);

      const result = await tokenService.shouldRefreshToken('user-123');

      expect(result).toBe(false);
    });

    it('should return false when no tokens found', async () => {
      mockRedisClient.hGetAll.mockResolvedValueOnce({});

      const result = await tokenService.shouldRefreshToken('user-123');

      expect(result).toBe(false);
    });
  });

  describe('removeStravaTokens', () => {
    it('should remove Strava tokens successfully', async () => {
      mockRedisClient.del.mockResolvedValueOnce(1);

      await tokenService.removeStravaTokens('user-123');

      expect(mockRedisClient.del).toHaveBeenCalledWith('strava_tokens:user-123');
    });

    it('should not throw when Redis is not connected', async () => {
      (tokenService as any).isConnected = false;

      await expect(tokenService.removeStravaTokens('user-123')).resolves.not.toThrow();
    });
  });

  describe('blacklistRefreshToken', () => {
    it('should blacklist refresh token successfully', async () => {
      mockRedisClient.setEx.mockResolvedValueOnce('OK');

      await tokenService.blacklistRefreshToken('refresh-token-123');

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'blacklisted_token:refresh-token-123',
        7 * 24 * 60 * 60,
        'blacklisted'
      );
    });

    it('should not throw when Redis is not connected', async () => {
      (tokenService as any).isConnected = false;

      await expect(tokenService.blacklistRefreshToken('token')).resolves.not.toThrow();
    });
  });

  describe('isRefreshTokenBlacklisted', () => {
    it('should return true for blacklisted token', async () => {
      mockRedisClient.get.mockResolvedValueOnce('blacklisted');

      const result = await tokenService.isRefreshTokenBlacklisted('refresh-token-123');

      expect(result).toBe(true);
      expect(mockRedisClient.get).toHaveBeenCalledWith('blacklisted_token:refresh-token-123');
    });

    it('should return false for non-blacklisted token', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await tokenService.isRefreshTokenBlacklisted('refresh-token-123');

      expect(result).toBe(false);
    });

    it('should return false when Redis is not connected', async () => {
      (tokenService as any).isConnected = false;

      const result = await tokenService.isRefreshTokenBlacklisted('token');

      expect(result).toBe(false);
    });

    it('should return false on Redis errors', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('Redis error'));

      const result = await tokenService.isRefreshTokenBlacklisted('token');

      expect(result).toBe(false);
    });
  });

  describe('user session management', () => {
    const sessionData = {
      lastLogin: '2025-08-04T00:02:28.498Z',
      stravaConnected: true,
    };

    describe('storeUserSession', () => {
      it('should store user session successfully', async () => {
        mockRedisClient.setEx.mockResolvedValueOnce('OK');

        await tokenService.storeUserSession('user-123', sessionData);

        expect(mockRedisClient.setEx).toHaveBeenCalledWith(
          'user_session:user-123',
          24 * 60 * 60,
          JSON.stringify(sessionData)
        );
      });

      it('should not throw when Redis is not connected', async () => {
        (tokenService as any).isConnected = false;

        await expect(tokenService.storeUserSession('user-123', sessionData))
          .resolves.not.toThrow();
      });
    });

    describe('getUserSession', () => {
      it('should retrieve user session successfully', async () => {
        mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(sessionData));

        const result = await tokenService.getUserSession('user-123');

        expect(mockRedisClient.get).toHaveBeenCalledWith('user_session:user-123');
        expect(result).toEqual(sessionData);
      });

      it('should return null when no session found', async () => {
        mockRedisClient.get.mockResolvedValueOnce(null);

        const result = await tokenService.getUserSession('user-123');

        expect(result).toBeNull();
      });

      it('should return null when Redis is not connected', async () => {
        (tokenService as any).isConnected = false;

        const result = await tokenService.getUserSession('user-123');

        expect(result).toBeNull();
      });
    });

    describe('removeUserSession', () => {
      it('should remove user session successfully', async () => {
        mockRedisClient.del.mockResolvedValueOnce(1);

        await tokenService.removeUserSession('user-123');

        expect(mockRedisClient.del).toHaveBeenCalledWith('user_session:user-123');
      });

      it('should not throw when Redis is not connected', async () => {
        (tokenService as any).isConnected = false;

        await expect(tokenService.removeUserSession('user-123')).resolves.not.toThrow();
      });
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis successfully', async () => {
      mockRedisClient.disconnect.mockResolvedValueOnce(undefined);

      await tokenService.disconnect();

      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should not throw when already disconnected', async () => {
      (tokenService as any).isConnected = false;

      await expect(tokenService.disconnect()).resolves.not.toThrow();
    });
  });
});