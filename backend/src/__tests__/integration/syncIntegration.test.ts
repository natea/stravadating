import request from 'supertest';
import app from '../../index';
import { prisma } from '../../config/database';
import { syncService } from '../../services/syncService';
import { schedulerService } from '../../services/schedulerService';

// Mock external dependencies
jest.mock('../../services/stravaService');
jest.mock('../../utils/logger');

describe('Sync Integration Tests', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        stravaId: 12345,
        firstName: 'Test',
        lastName: 'User',
        age: 30,
        city: 'Test City',
        state: 'Test State',
        latitude: 40.7128,
        longitude: -74.0060,
        bio: 'Test bio',
      },
    });

    // Mock auth token (you'll need to implement this based on your auth system)
    authToken = 'mock-auth-token';
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.stravaActivity.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.fitnessStats.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.user.delete({
      where: { id: testUser.id },
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Webhook Endpoints', () => {
    describe('GET /api/webhooks/strava', () => {
      it('should verify webhook subscription', async () => {
        // Arrange
        process.env.STRAVA_WEBHOOK_VERIFY_TOKEN = 'test-token';

        // Act
        const response = await request(app)
          .get('/api/webhooks/strava')
          .query({
            'hub.mode': 'subscribe',
            'hub.challenge': 'test-challenge',
            'hub.verify_token': 'test-token',
          });

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          'hub.challenge': 'test-challenge',
        });

        delete process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
      });

      it('should reject invalid verification token', async () => {
        // Arrange
        process.env.STRAVA_WEBHOOK_VERIFY_TOKEN = 'test-token';

        // Act
        const response = await request(app)
          .get('/api/webhooks/strava')
          .query({
            'hub.mode': 'subscribe',
            'hub.challenge': 'test-challenge',
            'hub.verify_token': 'invalid-token',
          });

        // Assert
        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          error: 'Invalid verification token',
        });

        delete process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
      });
    });

    describe('POST /api/webhooks/strava', () => {
      it('should handle webhook event', async () => {
        // Arrange
        const webhookEvent = {
          object_type: 'activity',
          object_id: 12345,
          aspect_type: 'create',
          owner_id: testUser.stravaId,
          subscription_id: 1,
          event_time: Math.floor(Date.now() / 1000),
        };

        // Act
        const response = await request(app)
          .post('/api/webhooks/strava')
          .send(webhookEvent);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          status: 'received',
        });
      });

      it('should handle malformed webhook event', async () => {
        // Act
        const response = await request(app)
          .post('/api/webhooks/strava')
          .send(null);

        // Assert
        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          error: 'Internal server error',
        });
      });
    });

    describe('GET /api/webhooks/status', () => {
      it('should return webhook status', async () => {
        // Arrange
        process.env.STRAVA_WEBHOOK_VERIFY_TOKEN = 'test-token';

        // Act
        const response = await request(app)
          .get('/api/webhooks/status')
          .set('Authorization', `Bearer ${authToken}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('configured');
        expect(response.body).toHaveProperty('endpoint');
        expect(response.body).toHaveProperty('verifyToken');

        delete process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
      });
    });

    describe('POST /api/webhooks/sync/:userId', () => {
      it('should trigger user sync', async () => {
        // Arrange
        jest.spyOn(syncService, 'syncUserActivities').mockResolvedValue({
          userId: testUser.id,
          activitiesSynced: 5,
          fitnessStatsUpdated: true,
        });

        // Act
        const response = await request(app)
          .post(`/api/webhooks/sync/${testUser.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          message: 'Sync completed successfully',
          result: {
            userId: testUser.id,
            activitiesSynced: 5,
            fitnessStatsUpdated: true,
          },
        });
      });

      it('should trigger full resync when requested', async () => {
        // Arrange
        jest.spyOn(syncService, 'forceFullResync').mockResolvedValue({
          userId: testUser.id,
          activitiesSynced: 10,
          fitnessStatsUpdated: true,
        });

        // Act
        const response = await request(app)
          .post(`/api/webhooks/sync/${testUser.id}`)
          .query({ fullResync: 'true' })
          .set('Authorization', `Bearer ${authToken}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          message: 'Sync completed successfully',
          result: {
            userId: testUser.id,
            activitiesSynced: 10,
            fitnessStatsUpdated: true,
          },
        });
      });
    });
  });

  describe('Sync Management Endpoints', () => {
    describe('GET /api/sync/status', () => {
      it('should return sync status', async () => {
        // Act
        const response = await request(app)
          .get('/api/sync/status')
          .set('Authorization', `Bearer ${authToken}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('scheduledJobs');
      });
    });

    describe('POST /api/sync/daily', () => {
      it('should trigger daily sync', async () => {
        // Arrange
        jest.spyOn(schedulerService, 'triggerDailySync').mockResolvedValue();

        // Act
        const response = await request(app)
          .post('/api/sync/daily')
          .set('Authorization', `Bearer ${authToken}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          message: 'Daily sync triggered successfully',
          status: 'running',
        });
      });
    });

    describe('POST /api/sync/cleanup', () => {
      it('should trigger weekly cleanup', async () => {
        // Arrange
        jest.spyOn(schedulerService, 'triggerWeeklyCleanup').mockResolvedValue();

        // Act
        const response = await request(app)
          .post('/api/sync/cleanup')
          .set('Authorization', `Bearer ${authToken}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          message: 'Weekly cleanup triggered successfully',
          status: 'running',
        });
      });
    });

    describe('POST /api/sync/user/:userId', () => {
      it('should sync specific user', async () => {
        // Arrange
        jest.spyOn(syncService, 'syncUserActivities').mockResolvedValue({
          userId: testUser.id,
          activitiesSynced: 3,
          fitnessStatsUpdated: true,
        });

        // Act
        const response = await request(app)
          .post(`/api/sync/user/${testUser.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          message: 'User sync completed successfully',
          result: {
            userId: testUser.id,
            activitiesSynced: 3,
            fitnessStatsUpdated: true,
          },
        });
      });

      it('should handle sync errors', async () => {
        // Arrange
        jest.spyOn(syncService, 'syncUserActivities').mockResolvedValue({
          userId: testUser.id,
          activitiesSynced: 0,
          fitnessStatsUpdated: false,
          error: 'Sync failed',
        });

        // Act
        const response = await request(app)
          .post(`/api/sync/user/${testUser.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        // Assert
        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          error: 'Sync failed',
          details: 'Sync failed',
        });
      });
    });

    describe('POST /api/sync/user/:userId/fitness-stats', () => {
      it('should update user fitness stats', async () => {
        // Arrange
        jest.spyOn(syncService, 'updateUserFitnessStats').mockResolvedValue();

        // Act
        const response = await request(app)
          .post(`/api/sync/user/${testUser.id}/fitness-stats`)
          .set('Authorization', `Bearer ${authToken}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          message: 'Fitness stats updated successfully',
          userId: testUser.id,
        });
      });
    });

    describe('POST /api/sync/cleanup/revoked', () => {
      it('should cleanup revoked users', async () => {
        // Arrange
        jest.spyOn(syncService, 'cleanupRevokedUsers').mockResolvedValue({
          cleanedUsers: 2,
          errors: [],
        });

        // Act
        const response = await request(app)
          .post('/api/sync/cleanup/revoked')
          .set('Authorization', `Bearer ${authToken}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          message: 'Cleanup completed',
          result: {
            cleanedUsers: 2,
            errors: [],
          },
        });
      });
    });

    describe('DELETE /api/sync/user/:userId/cleanup', () => {
      it('should cleanup specific user data', async () => {
        // Arrange
        jest.spyOn(syncService, 'cleanupUserStravaData').mockResolvedValue();

        // Act
        const response = await request(app)
          .delete(`/api/sync/user/${testUser.id}/cleanup`)
          .set('Authorization', `Bearer ${authToken}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          message: 'User data cleaned up successfully',
          userId: testUser.id,
        });
      });
    });

    describe('Scheduled Jobs Management', () => {
      describe('POST /api/sync/jobs/start', () => {
        it('should start all scheduled jobs', async () => {
          // Arrange
          jest.spyOn(schedulerService, 'start').mockImplementation();
          jest.spyOn(schedulerService, 'getJobsStatus').mockReturnValue({
            dailySync: true,
            weeklyCleanup: true,
          });

          // Act
          const response = await request(app)
            .post('/api/sync/jobs/start')
            .set('Authorization', `Bearer ${authToken}`);

          // Assert
          expect(response.status).toBe(200);
          expect(response.body).toEqual({
            message: 'Scheduled jobs started successfully',
            status: {
              dailySync: true,
              weeklyCleanup: true,
            },
          });
        });
      });

      describe('POST /api/sync/jobs/stop', () => {
        it('should stop all scheduled jobs', async () => {
          // Arrange
          jest.spyOn(schedulerService, 'stop').mockImplementation();
          jest.spyOn(schedulerService, 'getJobsStatus').mockReturnValue({
            dailySync: false,
            weeklyCleanup: false,
          });

          // Act
          const response = await request(app)
            .post('/api/sync/jobs/stop')
            .set('Authorization', `Bearer ${authToken}`);

          // Assert
          expect(response.status).toBe(200);
          expect(response.body).toEqual({
            message: 'Scheduled jobs stopped successfully',
            status: {
              dailySync: false,
              weeklyCleanup: false,
            },
          });
        });
      });

      describe('POST /api/sync/jobs/:jobName/start', () => {
        it('should start specific job', async () => {
          // Arrange
          jest.spyOn(schedulerService, 'startJob').mockReturnValue(true);
          jest.spyOn(schedulerService, 'getJobsStatus').mockReturnValue({
            dailySync: true,
            weeklyCleanup: false,
          });

          // Act
          const response = await request(app)
            .post('/api/sync/jobs/dailySync/start')
            .set('Authorization', `Bearer ${authToken}`);

          // Assert
          expect(response.status).toBe(200);
          expect(response.body).toEqual({
            message: 'Job dailySync started successfully',
            status: {
              dailySync: true,
              weeklyCleanup: false,
            },
          });
        });

        it('should handle non-existent job', async () => {
          // Arrange
          jest.spyOn(schedulerService, 'startJob').mockReturnValue(false);

          // Act
          const response = await request(app)
            .post('/api/sync/jobs/nonExistentJob/start')
            .set('Authorization', `Bearer ${authToken}`);

          // Assert
          expect(response.status).toBe(404);
          expect(response.body).toEqual({
            error: 'Job nonExistentJob not found',
          });
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      // Act
      const response = await request(app)
        .get('/api/sync/status');

      // Assert
      expect(response.status).toBe(401);
    });

    it('should handle internal server errors', async () => {
      // Arrange
      jest.spyOn(syncService, 'syncUserActivities').mockRejectedValue(new Error('Internal error'));

      // Act
      const response = await request(app)
        .post(`/api/sync/user/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Internal server error',
      });
    });
  });
});