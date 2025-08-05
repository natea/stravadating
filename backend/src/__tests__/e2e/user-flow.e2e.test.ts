import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../config/database';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

describe('User Flow E2E Tests', () => {
  let authToken: string;
  let userId: string;
  let server: any;

  beforeAll(async () => {
    // Start server
    server = app.listen(0);
    
    // Clean database
    await prisma.message.deleteMany();
    await prisma.match.deleteMany();
    await prisma.stravaActivity.deleteMany();
    await prisma.fitnessStats.deleteMany();
    await prisma.matchingPreferences.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
  });

  describe('Registration and Authentication Flow', () => {
    it('should complete full registration flow', async () => {
      // Step 1: Initiate Strava OAuth
      const authResponse = await request(app)
        .get('/api/auth/strava')
        .expect(302);

      expect(authResponse.headers.location).toContain('strava.com/oauth/authorize');

      // Step 2: Simulate OAuth callback (mock Strava response)
      const mockStravaData = {
        athlete: {
          id: 12345,
          firstname: 'John',
          lastname: 'Doe',
          city: 'New York',
          state: 'NY',
          profile: 'https://example.com/profile.jpg',
        },
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_at: Date.now() + 3600000,
      };

      // Create user directly for testing
      const user = await prisma.user.create({
        data: {
          email: 'john.doe@example.com',
          stravaId: 12345,
          firstName: 'John',
          lastName: 'Doe',
          age: 30,
          city: 'New York',
          state: 'NY',
          latitude: 40.7128,
          longitude: -74.0060,
          photos: ['https://example.com/profile.jpg'],
        },
      });

      userId = user.id;

      // Generate auth token
      authToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'test-secret'
      );

      // Step 3: Complete profile
      const profileResponse = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bio: 'Fitness enthusiast and marathon runner',
          age: 30,
          photos: ['photo1.jpg', 'photo2.jpg'],
        })
        .expect(200);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.bio).toBe('Fitness enthusiast and marathon runner');
    });

    it('should evaluate fitness thresholds', async () => {
      // Create fitness stats
      await prisma.fitnessStats.create({
        data: {
          userId,
          weeklyDistance: 50000,
          weeklyActivities: 5,
          averagePace: 5.5,
          favoriteActivities: ['Run', 'Ride'],
          totalDistance: 500000,
          lastUpdated: new Date(),
        },
      });

      // Create threshold
      await prisma.fitnessThreshold.create({
        data: {
          name: 'Minimum Weekly Distance',
          metricType: 'distance',
          threshold: 30000,
          comparisonOperator: 'gte',
          timeWindowDays: 7,
          isActive: true,
          priority: 1,
        },
      });

      const response = await request(app)
        .get('/api/fitness/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.passed).toBe(true);
    });
  });

  describe('Matching Flow', () => {
    let otherUserId: string;

    beforeEach(async () => {
      // Create another user for matching
      const otherUser = await prisma.user.create({
        data: {
          email: 'jane.smith@example.com',
          stravaId: 67890,
          firstName: 'Jane',
          lastName: 'Smith',
          age: 28,
          city: 'New York',
          state: 'NY',
          latitude: 40.7580,
          longitude: -73.9855,
          photos: ['https://example.com/jane.jpg'],
        },
      });

      otherUserId = otherUser.id;

      // Create fitness stats for other user
      await prisma.fitnessStats.create({
        data: {
          userId: otherUserId,
          weeklyDistance: 45000,
          weeklyActivities: 4,
          averagePace: 5.8,
          favoriteActivities: ['Run', 'Swim'],
          totalDistance: 450000,
        },
      });
    });

    it('should get potential matches', async () => {
      const response = await request(app)
        .get('/api/matching/potential')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('compatibilityScore');
      expect(response.body.data[0]).toHaveProperty('compatibilityFactors');
    });

    it('should update matching preferences', async () => {
      const preferences = {
        minAge: 25,
        maxAge: 35,
        maxDistance: 50,
        preferredActivities: ['Run', 'Ride'],
        minCompatibilityScore: 70,
      };

      const response = await request(app)
        .put('/api/matching/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(preferences)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.minAge).toBe(25);
      expect(response.body.data.maxAge).toBe(35);
    });

    it('should create a match', async () => {
      const response = await request(app)
        .post('/api/matching/match')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: otherUserId,
          compatibilityScore: 85,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.user2Id).toBe(otherUserId);
    });
  });

  describe('Messaging Flow', () => {
    let matchId: string;
    let recipientId: string;
    let otherUserId: string;

    beforeEach(async () => {
      // Create another user for messaging
      const otherUser = await prisma.user.create({
        data: {
          email: 'messaging.user@example.com',
          stravaId: 99999,
          firstName: 'Message',
          lastName: 'User',
          age: 26,
          city: 'Boston',
          state: 'MA',
          latitude: 42.3601,
          longitude: -71.0589,
          photos: ['https://example.com/message-user.jpg'],
        },
      });
      otherUserId = otherUser.id;

      // Create a match first
      const match = await prisma.match.create({
        data: {
          user1Id: userId,
          user2Id: otherUserId,
          compatibilityScore: 85,
          status: 'active',
        },
      });
      matchId = match.id;
      recipientId = otherUserId;
    });

    it('should send a message', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientId,
          matchId,
          content: 'Hello! Nice to match with you!',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.content).toBe('Hello! Nice to match with you!');
    });

    it('should get messages for a match', async () => {
      // Send a few messages first
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientId,
          matchId,
          content: 'Message 1',
        });

      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientId,
          matchId,
          content: 'Message 2',
        });

      const response = await request(app)
        .get(`/api/messages/${matchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should get conversation list', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data[0]).toHaveProperty('matchId');
      expect(response.body.data[0]).toHaveProperty('otherUser');
      expect(response.body.data[0]).toHaveProperty('unreadCount');
    });
  });

  describe('Fitness Data Sync', () => {
    it('should sync Strava activities', async () => {
      // Mock Strava activities
      const mockActivities = [
        {
          id: 1,
          name: 'Morning Run',
          type: 'Run',
          start_date: new Date().toISOString(),
          distance: 10000,
          moving_time: 3000,
          average_speed: 3.33,
        },
        {
          id: 2,
          name: 'Evening Ride',
          type: 'Ride',
          start_date: new Date().toISOString(),
          distance: 30000,
          moving_time: 5400,
          average_speed: 5.56,
        },
      ];

      // Create activities in database
      for (const activity of mockActivities) {
        await prisma.stravaActivity.create({
          data: {
            id: activity.id,
            userId,
            name: activity.name,
            type: activity.type,
            startDate: new Date(activity.start_date),
            distance: activity.distance,
            movingTime: activity.moving_time,
            averageSpeed: activity.average_speed,
          },
        });
      }

      const response = await request(app)
        .post('/api/sync/activities')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('syncedCount');
    });

    it('should get fitness statistics', async () => {
      const response = await request(app)
        .get('/api/fitness/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('weeklyDistance');
      expect(response.body.data).toHaveProperty('weeklyActivities');
      expect(response.body.data).toHaveProperty('favoriteActivities');
    });
  });

  describe('Security and Privacy', () => {
    it('should handle rate limiting', async () => {
      const requests = [];
      
      // Make 10 rapid requests
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/api/matching/potential')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);
      
      // Should hit rate limit at some point
      expect(rateLimited).toBe(true);
    });

    it('should export user data for GDPR compliance', async () => {
      const response = await request(app)
        .get('/api/users/export-data')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('fitnessStats');
      expect(response.body.data).toHaveProperty('matches');
      // Should not include sensitive tokens
      expect(response.body.data.user.stravaAccessToken).toBeUndefined();
    });

    it('should delete user account and anonymize data', async () => {
      const response = await request(app)
        .delete('/api/users/account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ confirmDelete: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify user is anonymized
      const deletedUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      expect(deletedUser?.email).toContain('deleted_');
      expect(deletedUser?.firstName).toBe('Deleted User');
    });
  });
});