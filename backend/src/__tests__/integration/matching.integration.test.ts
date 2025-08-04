import request from 'supertest';
import app from '../../index';
import { prisma } from '../../config/database';
import { authService } from '../../services/authService';

describe('Matching Integration Tests', () => {
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // Clean up database
    await prisma.match.deleteMany();
    await prisma.matchingPreferences.deleteMany();
    await prisma.fitnessStats.deleteMany();
    await prisma.stravaActivity.deleteMany();
    await prisma.user.deleteMany();

    // Create test users
    const user1 = await prisma.user.create({
      data: {
        email: 'user1@test.com',
        stravaId: 12345,
        firstName: 'John',
        lastName: 'Doe',
        age: 25,
        city: 'New York',
        state: 'NY',
        latitude: 40.7128,
        longitude: -74.0060,
        bio: 'Love running!',
        photos: ['photo1.jpg'],
      },
    });

    const user2 = await prisma.user.create({
      data: {
        email: 'user2@test.com',
        stravaId: 67890,
        firstName: 'Jane',
        lastName: 'Smith',
        age: 27,
        city: 'New York',
        state: 'NY',
        latitude: 40.7589,
        longitude: -73.9851,
        bio: 'Fitness enthusiast',
        photos: ['photo2.jpg'],
      },
    });

    user1Id = user1.id;
    user2Id = user2.id;

    // Create fitness stats for both users
    await prisma.fitnessStats.createMany({
      data: [
        {
          userId: user1Id,
          weeklyDistance: 50000,
          weeklyActivities: 5,
          averagePace: 300,
          favoriteActivities: ['Run', 'Bike'],
          totalDistance: 1000000,
          longestRun: 25000,
        },
        {
          userId: user2Id,
          weeklyDistance: 45000,
          weeklyActivities: 4,
          averagePace: 320,
          favoriteActivities: ['Run', 'Swim'],
          totalDistance: 800000,
          longestRun: 20000,
        },
      ],
    });

    // Create some Strava activities for compatibility calculation
    await prisma.stravaActivity.createMany({
      data: [
        {
          id: 1,
          userId: user1Id,
          name: 'Morning Run',
          type: 'Run',
          distance: 10000,
          movingTime: 3000,
          averageSpeed: 3.33,
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          elevationGain: 100,
        },
        {
          id: 2,
          userId: user1Id,
          name: 'Bike Ride',
          type: 'Ride',
          distance: 30000,
          movingTime: 3600,
          averageSpeed: 8.33,
          startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          elevationGain: 200,
        },
        {
          id: 3,
          userId: user2Id,
          name: 'Evening Run',
          type: 'Run',
          distance: 8000,
          movingTime: 2700,
          averageSpeed: 2.96,
          startDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
          elevationGain: 50,
        },
        {
          id: 4,
          userId: user2Id,
          name: 'Swimming',
          type: 'Swim',
          distance: 2000,
          movingTime: 1800,
          averageSpeed: 1.11,
          startDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
          elevationGain: 0,
        },
      ],
    });

    // Generate tokens for authentication
    user1Token = authService.generateAccessToken(user1Id);
    user2Token = authService.generateAccessToken(user2Id);
  });

  afterAll(async () => {
    // Clean up
    await prisma.match.deleteMany();
    await prisma.matchingPreferences.deleteMany();
    await prisma.fitnessStats.deleteMany();
    await prisma.stravaActivity.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe('GET /api/matching/potential', () => {
    it('should return potential matches for authenticated user', async () => {
      const response = await request(app)
        .get('/api/matching/potential')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('offset');
      expect(response.body.pagination).toHaveProperty('count');

      if (response.body.data.length > 0) {
        const match = response.body.data[0];
        expect(match).toHaveProperty('userId');
        expect(match).toHaveProperty('user');
        expect(match).toHaveProperty('compatibilityScore');
        expect(match).toHaveProperty('compatibilityFactors');
        expect(match).toHaveProperty('fitnessStats');
        expect(match.user).toHaveProperty('firstName');
        expect(match.user).toHaveProperty('lastName');
        expect(match.compatibilityFactors).toHaveProperty('activityOverlap');
        expect(match.compatibilityFactors).toHaveProperty('performanceSimilarity');
        expect(match.compatibilityFactors).toHaveProperty('locationProximity');
        expect(match.compatibilityFactors).toHaveProperty('ageCompatibility');
      }
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/matching/potential?limit=5&offset=0')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.pagination.offset).toBe(0);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/matching/potential')
        .expect(401);
    });

    it('should validate limit parameter', async () => {
      await request(app)
        .get('/api/matching/potential?limit=150')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(400);
    });
  });

  describe('POST /api/matching/match', () => {
    it('should create a match successfully', async () => {
      const response = await request(app)
        .post('/api/matching/match')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          targetUserId: user2Id,
          compatibilityScore: 85,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.user1Id).toBe(user1Id);
      expect(response.body.data.user2Id).toBe(user2Id);
      expect(response.body.data.compatibilityScore).toBe(85);
      expect(response.body.message).toBe('Match created successfully');
    });

    it('should prevent duplicate matches', async () => {
      await request(app)
        .post('/api/matching/match')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          targetUserId: user2Id,
          compatibilityScore: 85,
        })
        .expect(409);
    });

    it('should prevent self-matching', async () => {
      await request(app)
        .post('/api/matching/match')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          targetUserId: user1Id,
          compatibilityScore: 85,
        })
        .expect(400);
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/matching/match')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          compatibilityScore: 85,
        })
        .expect(400);
    });

    it('should validate compatibility score range', async () => {
      await request(app)
        .post('/api/matching/match')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          targetUserId: user2Id,
          compatibilityScore: 150,
        })
        .expect(400);
    });
  });

  describe('GET /api/matching/matches', () => {
    it('should return user matches', async () => {
      const response = await request(app)
        .get('/api/matching/matches')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('data');
      
      if (Array.isArray(response.body.data.data) && response.body.data.data.length > 0) {
        const match = response.body.data.data[0];
        expect(match).toHaveProperty('id');
        expect(match).toHaveProperty('compatibilityScore');
        expect(match).toHaveProperty('matchedAt');
        expect(match).toHaveProperty('status');
      }
    });

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/matching/matches?page=1&limit=10')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/matching/stats', () => {
    it('should return match statistics', async () => {
      const response = await request(app)
        .get('/api/matching/stats')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalMatches');
      expect(response.body.data).toHaveProperty('activeMatches');
      expect(response.body.data).toHaveProperty('archivedMatches');
      expect(response.body.data).toHaveProperty('averageCompatibilityScore');
      expect(typeof response.body.data.totalMatches).toBe('number');
      expect(typeof response.body.data.activeMatches).toBe('number');
      expect(typeof response.body.data.archivedMatches).toBe('number');
      expect(typeof response.body.data.averageCompatibilityScore).toBe('number');
    });
  });

  describe('Matching Preferences', () => {
    describe('GET /api/matching/preferences', () => {
      it('should return default preferences for new user', async () => {
        const response = await request(app)
          .get('/api/matching/preferences')
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('userId');
        expect(response.body.data).toHaveProperty('minAge');
        expect(response.body.data).toHaveProperty('maxAge');
        expect(response.body.data).toHaveProperty('maxDistance');
        expect(response.body.data).toHaveProperty('preferredActivities');
        expect(response.body.data).toHaveProperty('minCompatibilityScore');
      });
    });

    describe('PUT /api/matching/preferences', () => {
      it('should update matching preferences', async () => {
        const preferences = {
          minAge: 25,
          maxAge: 35,
          maxDistance: 30,
          preferredActivities: ['Run', 'Bike'],
          minCompatibilityScore: 70,
        };

        const response = await request(app)
          .put('/api/matching/preferences')
          .set('Authorization', `Bearer ${user1Token}`)
          .send(preferences)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.minAge).toBe(25);
        expect(response.body.data.maxAge).toBe(35);
        expect(response.body.data.maxDistance).toBe(30);
        expect(response.body.data.preferredActivities).toEqual(['Run', 'Bike']);
        expect(response.body.data.minCompatibilityScore).toBe(70);
        expect(response.body.message).toBe('Matching preferences updated successfully');
      });

      it('should validate age parameters', async () => {
        await request(app)
          .put('/api/matching/preferences')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ minAge: 15 })
          .expect(400);
      });

      it('should validate age range', async () => {
        await request(app)
          .put('/api/matching/preferences')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ minAge: 35, maxAge: 25 })
          .expect(400);
      });

      it('should validate distance parameter', async () => {
        await request(app)
          .put('/api/matching/preferences')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ maxDistance: 1500 })
          .expect(400);
      });

      it('should validate preferred activities type', async () => {
        await request(app)
          .put('/api/matching/preferences')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ preferredActivities: 'not an array' })
          .expect(400);
      });
    });
  });

  describe('Match Archiving', () => {
    let matchId: string;

    beforeAll(async () => {
      // Create a match to archive
      const match = await prisma.match.create({
        data: {
          user1Id,
          user2Id,
          compatibilityScore: 75,
        },
      });
      matchId = match.id;
    });

    it('should archive a match successfully', async () => {
      const response = await request(app)
        .put(`/api/matching/matches/${matchId}/archive`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('archived');
      expect(response.body.message).toBe('Match archived successfully');
    });

    it('should return 404 for non-existent match', async () => {
      await request(app)
        .put('/api/matching/matches/nonexistent/archive')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });
  });
});