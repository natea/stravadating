import request from 'supertest';
import { Express } from 'express';
import { prisma } from '../../config/database';
import { authService } from '../../services/authService';
import { UserRegistrationService } from '../../services/userRegistrationService';
import { PhotoUploadService } from '../../services/photoUploadService';
import path from 'path';
import fs from 'fs';

// Mock external services
jest.mock('../../services/stravaIntegrationService');

describe('User Registration Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize test app (this would be your actual Express app)
    // For this example, we'll mock the app setup
    
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test',
        },
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await prisma.user.delete({
        where: { id: testUserId },
      }).catch(() => {});
    }
    
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/strava/callback - Registration Flow', () => {
    const mockStravaResponse = {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      athlete: {
        id: 999999,
        firstname: 'Test',
        lastname: 'User',
        email: 'test.user@example.com',
        city: 'San Francisco',
        state: 'CA',
        profile_medium: 'https://example.com/photo.jpg',
      },
    };

    const mockActivities = [
      {
        id: 1,
        name: 'Morning Run',
        type: 'Run',
        distance: 5000,
        movingTime: 1800,
        averageSpeed: 2.78,
        startDate: new Date('2024-01-01'),
        elevationGain: 100,
      },
      {
        id: 2,
        name: 'Evening Run',
        type: 'Run',
        distance: 8000,
        movingTime: 2400,
        averageSpeed: 3.33,
        startDate: new Date('2024-01-03'),
        elevationGain: 150,
      },
    ];

    beforeEach(() => {
      // Mock Strava integration service
      const mockStravaIntegrationService = require('../../services/stravaIntegrationService').stravaIntegrationService;
      mockStravaIntegrationService.syncUserFitnessData.mockResolvedValue({
        activities: mockActivities,
        fitnessMetrics: {
          weeklyDistance: 15000,
          weeklyActivities: 4,
          averagePace: 300,
          favoriteActivities: ['Run'],
          totalDistance: 13000,
          longestRun: 8000,
        },
        profile: mockStravaResponse.athlete,
      });
      mockStravaIntegrationService.setUserTokens.mockImplementation(() => {});
      mockStravaIntegrationService.removeUserTokens.mockImplementation(() => {});
    });

    it('should successfully register a new user with valid fitness data', async () => {
      // Mock authService.exchangeCodeForTokens
      jest.spyOn(authService, 'exchangeCodeForTokens').mockResolvedValue(mockStravaResponse as any);

      // Initialize fitness threshold
      await prisma.fitnessThreshold.create({
        data: {
          weeklyDistance: 10000,
          weeklyActivities: 3,
          averagePace: 360,
          allowedActivityTypes: ['Run', 'Ride'],
          updatedBy: 'test',
        },
      });

      const response = await request(app)
        .get('/auth/strava/callback')
        .query({ code: 'mock_auth_code' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.message).toContain('Registration successful');

      // Verify user was created in database
      const createdUser = await prisma.user.findUnique({
        where: { stravaId: 999999 },
      });
      expect(createdUser).toBeDefined();
      expect(createdUser?.firstName).toBe('Test');
      expect(createdUser?.lastName).toBe('User');

      testUserId = createdUser!.id;

      // Verify fitness stats were created
      const fitnessStats = await prisma.fitnessStats.findUnique({
        where: { userId: createdUser!.id },
      });
      expect(fitnessStats).toBeDefined();
      expect(fitnessStats?.weeklyDistance).toBe(15000);

      // Verify activities were stored
      const activities = await prisma.stravaActivity.findMany({
        where: { userId: createdUser!.id },
      });
      expect(activities).toHaveLength(2);
    });

    it('should reject registration for user who does not meet fitness threshold', async () => {
      // Mock low activity user
      const lowActivityUser = [
        {
          id: 1,
          name: 'Short Walk',
          type: 'Walk',
          distance: 1000,
          movingTime: 600,
          averageSpeed: 1.67,
          startDate: new Date('2024-01-01'),
          elevationGain: 0,
        },
      ];

      const mockStravaIntegrationService = require('../../services/stravaIntegrationService').stravaIntegrationService;
      mockStravaIntegrationService.syncUserFitnessData.mockResolvedValue({
        activities: lowActivityUser,
        fitnessMetrics: {
          weeklyDistance: 1000,
          weeklyActivities: 1,
          averagePace: 600,
          favoriteActivities: ['Walk'],
          totalDistance: 1000,
          longestRun: 1000,
        },
        profile: { ...mockStravaResponse.athlete, id: 999998 },
      });

      jest.spyOn(authService, 'exchangeCodeForTokens').mockResolvedValue({
        ...mockStravaResponse,
        athlete: { ...mockStravaResponse.athlete, id: 999998 },
      } as any);

      const response = await request(app)
        .get('/auth/strava/callback')
        .query({ code: 'mock_auth_code_low_activity' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('FITNESS_THRESHOLD_NOT_MET');
      expect(response.body.message).toContain("doesn't meet our minimum requirements");

      // Verify user was not created
      const user = await prisma.user.findUnique({
        where: { stravaId: 999998 },
      });
      expect(user).toBeNull();
    });

    it('should login existing user instead of registering', async () => {
      // Create existing user
      const existingUser = await prisma.user.create({
        data: {
          email: 'existing@example.com',
          stravaId: 999997,
          firstName: 'Existing',
          lastName: 'User',
          age: 30,
          city: 'San Francisco',
          state: 'CA',
          latitude: 37.7749,
          longitude: -122.4194,
        },
      });

      jest.spyOn(authService, 'exchangeCodeForTokens').mockResolvedValue({
        ...mockStravaResponse,
        athlete: { ...mockStravaResponse.athlete, id: 999997 },
      } as any);

      const response = await request(app)
        .get('/auth/strava/callback')
        .query({ code: 'mock_auth_code_existing' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(existingUser.id);
      expect(response.body.message).toBe('Login successful');

      // Clean up
      await prisma.user.delete({ where: { id: existingUser.id } });
    });
  });

  describe('Profile Management Endpoints', () => {
    beforeAll(async () => {
      // Create test user and get auth token
      const testUser = await prisma.user.create({
        data: {
          email: 'profile.test@example.com',
          stravaId: 888888,
          firstName: 'Profile',
          lastName: 'Test',
          age: 28,
          city: 'Los Angeles',
          state: 'CA',
          latitude: 34.0522,
          longitude: -118.2437,
          bio: 'Test bio',
        },
      });

      testUserId = testUser.id;
      authToken = authService.generateAccessToken(testUser);
    });

    describe('GET /auth/profile', () => {
      it('should return user profile', async () => {
        const response = await request(app)
          .get('/auth/profile')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toBeDefined();
        expect(response.body.data.user.firstName).toBe('Profile');
        expect(response.body.data.user.lastName).toBe('Test');
      });

      it('should reject request without auth token', async () => {
        const response = await request(app)
          .get('/auth/profile');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /auth/profile', () => {
      it('should update user profile', async () => {
        const updateData = {
          age: 30,
          bio: 'Updated bio',
          city: 'San Diego',
          state: 'CA',
        };

        const response = await request(app)
          .put('/auth/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.age).toBe(30);
        expect(response.body.data.user.bio).toBe('Updated bio');
        expect(response.body.data.user.city).toBe('San Diego');

        // Verify in database
        const updatedUser = await prisma.user.findUnique({
          where: { id: testUserId },
        });
        expect(updatedUser?.age).toBe(30);
        expect(updatedUser?.bio).toBe('Updated bio');
        expect(updatedUser?.city).toBe('San Diego');
      });

      it('should reject invalid profile updates', async () => {
        const invalidData = {
          age: 15, // Too young
        };

        const response = await request(app)
          .put('/auth/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Age must be between 18 and 100');
      });
    });

    describe('POST /auth/photos', () => {
      it('should upload profile photos', async () => {
        // Create a test image file
        const testImagePath = path.join(__dirname, 'test-image.jpg');
        const testImageBuffer = Buffer.from('fake image data');
        
        // Mock PhotoUploadService
        jest.spyOn(PhotoUploadService, 'validatePhotoFile').mockReturnValue({
          isValid: true,
        });
        
        jest.spyOn(PhotoUploadService, 'processMultiplePhotos').mockResolvedValue([
          {
            success: true,
            photoUrl: 'http://localhost:3001/uploads/photos/test_photo.jpg',
            thumbnailUrl: 'http://localhost:3001/uploads/photos/test_photo_thumb.jpg',
          },
        ]);

        const response = await request(app)
          .post('/auth/photos')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('photos', testImageBuffer, 'test.jpg');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.uploadedPhotos).toHaveLength(1);
        expect(response.body.data.uploadedPhotos[0].success).toBe(true);
      });

      it('should reject invalid photo files', async () => {
        jest.spyOn(PhotoUploadService, 'validatePhotoFile').mockReturnValue({
          isValid: false,
          error: 'Invalid file type',
        });

        const response = await request(app)
          .post('/auth/photos')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('photos', Buffer.from('not an image'), 'test.txt');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Invalid file type');
      });
    });

    describe('DELETE /auth/photos', () => {
      it('should delete user photo', async () => {
        // First add a photo to the user
        await prisma.user.update({
          where: { id: testUserId },
          data: {
            photos: ['http://localhost:3001/uploads/photos/test_photo.jpg'],
          },
        });

        jest.spyOn(PhotoUploadService, 'deletePhoto').mockResolvedValue(true);

        const response = await request(app)
          .delete('/auth/photos')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            photoUrl: 'http://localhost:3001/uploads/photos/test_photo.jpg',
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Photo deleted successfully');

        // Verify photo was removed from user profile
        const updatedUser = await prisma.user.findUnique({
          where: { id: testUserId },
        });
        expect(updatedUser?.photos).toEqual([]);
      });

      it('should reject deletion of photo not belonging to user', async () => {
        const response = await request(app)
          .delete('/auth/photos')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            photoUrl: 'http://localhost:3001/uploads/photos/other_user_photo.jpg',
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Photo does not belong to user');
      });
    });
  });

  describe('GET /auth/registration-status/:stravaId', () => {
    it('should return registration status for existing user', async () => {
      const existingUser = await prisma.user.create({
        data: {
          email: 'status.test@example.com',
          stravaId: 777777,
          firstName: 'Status',
          lastName: 'Test',
          age: 25,
          city: 'Portland',
          state: 'OR',
          latitude: 45.5152,
          longitude: -122.6784,
        },
      });

      const response = await request(app)
        .get('/auth/registration-status/777777');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exists).toBe(true);
      expect(response.body.data.canRegister).toBe(false);
      expect(response.body.data.user.id).toBe(existingUser.id);

      // Clean up
      await prisma.user.delete({ where: { id: existingUser.id } });
    });

    it('should return can register status for new user', async () => {
      const response = await request(app)
        .get('/auth/registration-status/666666');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exists).toBe(false);
      expect(response.body.data.canRegister).toBe(true);
      expect(response.body.data.message).toBe('User can proceed with registration');
    });

    it('should reject invalid Strava ID', async () => {
      const response = await request(app)
        .get('/auth/registration-status/invalid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid Strava ID');
    });
  });
});