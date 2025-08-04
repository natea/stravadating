import { Request, Response } from 'express';
import { webhookController, WebhookController } from '../webhookController';
import { syncService } from '../../services/syncService';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../../services/syncService');
jest.mock('../../config/database');
jest.mock('../../utils/logger');

const mockSyncService = syncService as jest.Mocked<typeof syncService>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('WebhookController', () => {
  let controller: WebhookController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new WebhookController();
    
    mockRequest = {
      query: {},
      body: {},
      params: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
    
    // Set up environment variable
    process.env.STRAVA_WEBHOOK_VERIFY_TOKEN = 'test-verify-token';
  });

  afterEach(() => {
    delete process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  });

  describe('verifyWebhook', () => {
    it('should verify webhook subscription successfully', async () => {
      // Arrange
      mockRequest.query = {
        'hub.mode': 'subscribe',
        'hub.challenge': 'test-challenge',
        'hub.verify_token': 'test-verify-token',
      };

      // Act
      await controller.verifyWebhook(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        'hub.challenge': 'test-challenge',
      });
    });

    it('should reject invalid verification token', async () => {
      // Arrange
      mockRequest.query = {
        'hub.mode': 'subscribe',
        'hub.challenge': 'test-challenge',
        'hub.verify_token': 'invalid-token',
      };

      // Act
      await controller.verifyWebhook(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid verification token',
      });
    });

    it('should reject invalid mode', async () => {
      // Arrange
      mockRequest.query = {
        'hub.mode': 'invalid-mode',
        'hub.challenge': 'test-challenge',
        'hub.verify_token': 'test-verify-token',
      };

      // Act
      await controller.verifyWebhook(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid mode',
      });
    });

    it('should handle missing verification token configuration', async () => {
      // Arrange
      delete process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
      mockRequest.query = {
        'hub.mode': 'subscribe',
        'hub.challenge': 'test-challenge',
        'hub.verify_token': 'test-verify-token',
      };

      // Act
      await controller.verifyWebhook(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Webhook verification token not configured',
      });
    });
  });

  describe('handleWebhookEvent', () => {
    const mockEvent = {
      object_type: 'activity',
      object_id: 12345,
      aspect_type: 'create',
      owner_id: 67890,
      subscription_id: 1,
      event_time: 1640995200,
    };

    it('should handle webhook event and acknowledge receipt', async () => {
      // Arrange
      mockRequest.body = mockEvent;

      // Act
      await controller.handleWebhookEvent(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'received',
      });
    });

    it('should handle malformed webhook event', async () => {
      // Arrange
      mockRequest.body = null;

      // Act
      await controller.handleWebhookEvent(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error',
      });
    });
  });

  describe('processWebhookEvent', () => {
    const mockUser = {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
    };

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
    });

    it('should ignore non-activity events', async () => {
      // Arrange
      const event = {
        object_type: 'athlete',
        object_id: 12345,
        aspect_type: 'update',
        owner_id: 67890,
        subscription_id: 1,
        event_time: 1640995200,
      };

      // Act
      await (controller as any).processWebhookEvent(event);

      // Assert
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should ignore events for unknown users', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const event = {
        object_type: 'activity',
        object_id: 12345,
        aspect_type: 'create',
        owner_id: 67890,
        subscription_id: 1,
        event_time: 1640995200,
      };

      // Act
      await (controller as any).processWebhookEvent(event);

      // Assert
      expect(mockSyncService.syncUserActivities).not.toHaveBeenCalled();
    });

    describe('activity create events', () => {
      it('should handle activity create event', async () => {
        // Arrange
        const event = {
          object_type: 'activity',
          object_id: 12345,
          aspect_type: 'create',
          owner_id: 67890,
          subscription_id: 1,
          event_time: 1640995200,
        };

        const syncResult = {
          userId: 'user-1',
          activitiesSynced: 1,
          fitnessStatsUpdated: true,
        };

        mockSyncService.syncUserActivities.mockResolvedValue(syncResult);

        // Act
        await (controller as any).processWebhookEvent(event);

        // Assert
        expect(mockSyncService.syncUserActivities).toHaveBeenCalledWith('user-1');
      });

      it('should handle sync errors for create events', async () => {
        // Arrange
        const event = {
          object_type: 'activity',
          object_id: 12345,
          aspect_type: 'create',
          owner_id: 67890,
          subscription_id: 1,
          event_time: 1640995200,
        };

        const syncResult = {
          userId: 'user-1',
          activitiesSynced: 0,
          fitnessStatsUpdated: false,
          error: 'Sync failed',
        };

        mockSyncService.syncUserActivities.mockResolvedValue(syncResult);

        // Act
        await (controller as any).processWebhookEvent(event);

        // Assert
        expect(mockSyncService.syncUserActivities).toHaveBeenCalledWith('user-1');
      });
    });

    describe('activity update events', () => {
      it('should handle activity becoming private', async () => {
        // Arrange
        const event = {
          object_type: 'activity',
          object_id: 12345,
          aspect_type: 'update',
          owner_id: 67890,
          subscription_id: 1,
          event_time: 1640995200,
          updates: {
            private: true,
          },
        };

        mockPrisma.stravaActivity.deleteMany.mockResolvedValue({ count: 1 });
        mockSyncService.updateUserFitnessStats.mockResolvedValue();

        // Act
        await (controller as any).processWebhookEvent(event);

        // Assert
        expect(mockPrisma.stravaActivity.deleteMany).toHaveBeenCalledWith({
          where: {
            id: 12345,
            userId: 'user-1',
          },
        });
        expect(mockSyncService.updateUserFitnessStats).toHaveBeenCalledWith('user-1');
      });

      it('should handle other activity updates', async () => {
        // Arrange
        const event = {
          object_type: 'activity',
          object_id: 12345,
          aspect_type: 'update',
          owner_id: 67890,
          subscription_id: 1,
          event_time: 1640995200,
          updates: {
            title: 'Updated Activity Name',
          },
        };

        const syncResult = {
          userId: 'user-1',
          activitiesSynced: 1,
          fitnessStatsUpdated: true,
        };

        mockSyncService.syncUserActivities.mockResolvedValue(syncResult);

        // Act
        await (controller as any).processWebhookEvent(event);

        // Assert
        expect(mockSyncService.syncUserActivities).toHaveBeenCalledWith('user-1');
      });
    });

    describe('activity delete events', () => {
      it('should handle activity deletion', async () => {
        // Arrange
        const event = {
          object_type: 'activity',
          object_id: 12345,
          aspect_type: 'delete',
          owner_id: 67890,
          subscription_id: 1,
          event_time: 1640995200,
        };

        mockPrisma.stravaActivity.deleteMany.mockResolvedValue({ count: 1 });
        mockSyncService.updateUserFitnessStats.mockResolvedValue();

        // Act
        await (controller as any).processWebhookEvent(event);

        // Assert
        expect(mockPrisma.stravaActivity.deleteMany).toHaveBeenCalledWith({
          where: {
            id: 12345,
            userId: 'user-1',
          },
        });
        expect(mockSyncService.updateUserFitnessStats).toHaveBeenCalledWith('user-1');
      });

      it('should handle deletion of non-existent activity', async () => {
        // Arrange
        const event = {
          object_type: 'activity',
          object_id: 12345,
          aspect_type: 'delete',
          owner_id: 67890,
          subscription_id: 1,
          event_time: 1640995200,
        };

        mockPrisma.stravaActivity.deleteMany.mockResolvedValue({ count: 0 });

        // Act
        await (controller as any).processWebhookEvent(event);

        // Assert
        expect(mockPrisma.stravaActivity.deleteMany).toHaveBeenCalledWith({
          where: {
            id: 12345,
            userId: 'user-1',
          },
        });
        expect(mockSyncService.updateUserFitnessStats).not.toHaveBeenCalled();
      });
    });
  });

  describe('getWebhookStatus', () => {
    it('should return webhook status', async () => {
      // Arrange
      process.env.BASE_URL = 'https://api.example.com';

      // Act
      await controller.getWebhookStatus(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        configured: true,
        endpoint: 'https://api.example.com/api/webhooks/strava',
        verifyToken: true,
      });
    });

    it('should handle missing configuration', async () => {
      // Arrange
      delete process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
      delete process.env.BASE_URL;

      // Act
      await controller.getWebhookStatus(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        configured: false,
        endpoint: 'http://localhost:3000/api/webhooks/strava',
        verifyToken: false,
      });
    });
  });

  describe('triggerUserSync', () => {
    it('should trigger user sync successfully', async () => {
      // Arrange
      mockRequest.params = { userId: 'user-1' };
      mockRequest.query = {};

      const syncResult = {
        userId: 'user-1',
        activitiesSynced: 5,
        fitnessStatsUpdated: true,
      };

      mockSyncService.syncUserActivities.mockResolvedValue(syncResult);

      // Act
      await controller.triggerUserSync(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSyncService.syncUserActivities).toHaveBeenCalledWith('user-1');
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Sync completed successfully',
        result: syncResult,
      });
    });

    it('should trigger full resync when requested', async () => {
      // Arrange
      mockRequest.params = { userId: 'user-1' };
      mockRequest.query = { fullResync: 'true' };

      const syncResult = {
        userId: 'user-1',
        activitiesSynced: 10,
        fitnessStatsUpdated: true,
      };

      mockSyncService.forceFullResync.mockResolvedValue(syncResult);

      // Act
      await controller.triggerUserSync(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSyncService.forceFullResync).toHaveBeenCalledWith('user-1');
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Sync completed successfully',
        result: syncResult,
      });
    });

    it('should handle missing user ID', async () => {
      // Arrange
      mockRequest.params = {};

      // Act
      await controller.triggerUserSync(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'User ID is required',
      });
    });

    it('should handle sync errors', async () => {
      // Arrange
      mockRequest.params = { userId: 'user-1' };
      mockRequest.query = {};

      const syncResult = {
        userId: 'user-1',
        activitiesSynced: 0,
        fitnessStatsUpdated: false,
        error: 'Sync failed',
      };

      mockSyncService.syncUserActivities.mockResolvedValue(syncResult);

      // Act
      await controller.triggerUserSync(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Sync failed',
        details: 'Sync failed',
      });
    });
  });
});