import { prisma } from '../config/database';
import { faker } from '@faker-js/faker';

// Boston area cities with coordinates
const bostonAreaCities = [
  { city: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589 },
  { city: 'Cambridge', state: 'MA', lat: 42.3736, lng: -71.1097 },
  { city: 'Somerville', state: 'MA', lat: 42.3876, lng: -71.0995 },
  { city: 'Newton', state: 'MA', lat: 42.3370, lng: -71.2092 },
  { city: 'Brookline', state: 'MA', lat: 42.3318, lng: -71.1212 },
  { city: 'Arlington', state: 'MA', lat: 42.4154, lng: -71.1565 },
  { city: 'Lexington', state: 'MA', lat: 42.4430, lng: -71.2290 },
  { city: 'Watertown', state: 'MA', lat: 42.3709, lng: -71.1828 },
  { city: 'Belmont', state: 'MA', lat: 42.3959, lng: -71.1787 },
  { city: 'Medford', state: 'MA', lat: 42.4184, lng: -71.1062 },
  { city: 'Malden', state: 'MA', lat: 42.4251, lng: -71.0662 },
  { city: 'Quincy', state: 'MA', lat: 42.2529, lng: -71.0023 },
  { city: 'Dedham', state: 'MA', lat: 42.2436, lng: -71.1662 },
  { city: 'Needham', state: 'MA', lat: 42.2817, lng: -71.2345 },
  { city: 'Wellesley', state: 'MA', lat: 42.2968, lng: -71.2924 },
];

// Activity types for variety
const activityTypes = ['Run', 'Ride', 'Swim', 'Hike', 'Walk', 'Yoga', 'Workout'];

// Fitness-related bios
const bioTemplates = [
  "Marathon runner and cycling enthusiast. Love exploring new trails on weekends!",
  "Triathlete in training. Early morning runs are my meditation.",
  "Trail runner who enjoys long hikes in nature. Always up for an adventure!",
  "Cyclist and yoga practitioner. Seeking balance in fitness and life.",
  "Running is my therapy. Training for my next half marathon!",
  "Outdoor fitness enthusiast. If it involves sweating and nature, I'm in!",
  "Former college athlete still chasing that runner's high. Love a good challenge!",
  "Fitness is my lifestyle. From HIIT to hiking, I do it all!",
  "Passionate about running and healthy living. Let's motivate each other!",
  "Adventure seeker and fitness lover. The mountains are calling!",
  "5am club member. Running, cycling, and strength training keep me sane.",
  "Endurance athlete with a love for long distance running and cycling.",
  "Fitness journey started 5 years ago and never looked back. Running changed my life!",
  "Trail runner by day, yoga enthusiast by night. Balance is key!",
  "Chasing PRs and mountain peaks. Always training for the next race!",
];

// Female first names
const femaleNames = [
  'Emma', 'Olivia', 'Sophia', 'Isabella', 'Mia', 'Charlotte', 'Amelia', 
  'Harper', 'Evelyn', 'Abigail', 'Emily', 'Elizabeth', 'Sofia', 'Avery',
  'Ella', 'Scarlett', 'Grace', 'Victoria', 'Riley', 'Aria', 'Lily',
  'Natalie', 'Camila', 'Hannah', 'Zoe', 'Penelope', 'Layla', 'Chloe',
  'Eleanor', 'Madison', 'Ellie', 'Nora', 'Lucy', 'Claire', 'Stella',
  'Aurora', 'Hazel', 'Savannah', 'Audrey', 'Brooklyn', 'Bella', 'Sarah',
  'Rachel', 'Jessica', 'Michelle', 'Jennifer', 'Amanda', 'Lauren', 'Megan'
];

// Last names
const lastNames = [
  'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson',
  'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee',
  'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker',
  'Hall', 'Allen', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker',
  'Adams', 'Nelson', 'Hill', 'Campbell', 'Mitchell', 'Roberts', 'Carter',
  'Phillips', 'Evans', 'Turner', 'Torres', 'Parker', 'Collins', 'Edwards'
];

// Profile photos (using placeholder images with different styles)
const profilePhotos = [
  'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=400&h=400&fit=crop', // Woman runner
  'https://images.unsplash.com/photo-1556746834-cbb4a38ee593?w=400&h=400&fit=crop', // Woman cyclist
  'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=400&fit=crop', // Woman fitness
  'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=400&h=400&fit=crop', // Woman running
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop', // Woman workout
  'https://images.unsplash.com/photo-1541694458248-5aa2101c77df?w=400&h=400&fit=crop', // Woman athlete
  'https://images.unsplash.com/photo-1579758629938-03607ccdbaba?w=400&h=400&fit=crop', // Woman sports
  'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=400&h=400&fit=crop', // Woman active
  'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&h=400&fit=crop', // Woman gym
  'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=400&h=400&fit=crop', // Woman hiker
];

async function seedAthletes() {
  console.log('🌱 Starting to seed female athletes...');

  try {
    // Create 20 fake female athletes
    for (let i = 0; i < 20; i++) {
      const location = bostonAreaCities[Math.floor(Math.random() * bostonAreaCities.length)];
      const firstName = femaleNames[Math.floor(Math.random() * femaleNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const age = Math.floor(Math.random() * (55 - 35 + 1)) + 35; // Age between 35-55
      const stravaId = 1000000 + i; // Fake Strava IDs (smaller to fit in INT4)
      
      // Create user
      const user = await prisma.user.create({
        data: {
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
          stravaId: stravaId,
          firstName: firstName,
          lastName: lastName,
          age: age,
          gender: 'female', // All seeded athletes are female
          city: location.city,
          state: location.state,
          latitude: location.lat + (Math.random() - 0.5) * 0.1, // Slight variation
          longitude: location.lng + (Math.random() - 0.5) * 0.1,
          bio: bioTemplates[Math.floor(Math.random() * bioTemplates.length)],
          photos: [
            profilePhotos[Math.floor(Math.random() * profilePhotos.length)],
            profilePhotos[Math.floor(Math.random() * profilePhotos.length)],
          ],
          createdAt: faker.date.recent({ days: 30 }),
          lastActive: faker.date.recent({ days: 7 }),
        },
      });

      console.log(`✅ Created athlete: ${firstName} ${lastName} (${age}, ${location.city})`);

      // Create fitness stats for the user
      const weeklyDistance = Math.floor(Math.random() * (80000 - 15000 + 1)) + 15000; // 15-80km
      const weeklyActivities = Math.floor(Math.random() * (8 - 3 + 1)) + 3; // 3-8 activities
      const averagePace = Math.floor(Math.random() * (420 - 300 + 1)) + 300; // 5:00-7:00 min/km
      
      await prisma.fitnessStats.create({
        data: {
          userId: user.id,
          weeklyDistance: weeklyDistance,
          weeklyActivities: weeklyActivities,
          averagePace: averagePace,
          favoriteActivities: faker.helpers.arrayElements(activityTypes, { min: 2, max: 4 }),
          totalDistance: weeklyDistance * 12, // Roughly 3 months
          lastSyncDate: new Date(),
        },
      });

      // Create some recent Strava activities for each user
      const numActivities = Math.floor(Math.random() * 10) + 5; // 5-15 activities
      
      for (let j = 0; j < numActivities; j++) {
        const activityType = activityTypes[Math.floor(Math.random() * activityTypes.length)];
        const distance = activityType === 'Run' 
          ? Math.floor(Math.random() * (15000 - 3000 + 1)) + 3000 // 3-15km for runs
          : activityType === 'Ride'
          ? Math.floor(Math.random() * (50000 - 10000 + 1)) + 10000 // 10-50km for rides
          : Math.floor(Math.random() * (10000 - 2000 + 1)) + 2000; // 2-10km for others
        
        const movingTime = Math.floor(distance / (Math.random() * 3 + 2)); // Random speed
        
        await prisma.stravaActivity.create({
          data: {
            id: stravaId * 1000 + j, // Smaller ID that fits in INT4
            userId: user.id,
            name: `${activityType} Activity`,
            type: activityType,
            distance: distance,
            movingTime: movingTime,
            averageSpeed: distance / movingTime,
            startDate: faker.date.recent({ days: 30 }),
            elevationGain: Math.floor(Math.random() * 500),
            syncedAt: new Date(),
          },
        });
      }

      console.log(`  📊 Added fitness stats and ${numActivities} activities`);
    }

    console.log('\n✨ Successfully seeded 20 female athletes aged 35-55!');
    console.log('🏃‍♀️ All athletes have realistic fitness stats and activities.');
    
    // Show summary
    const totalUsers = await prisma.user.count();
    const totalActivities = await prisma.stravaActivity.count();
    console.log(`\n📈 Database now contains:`);
    console.log(`   - ${totalUsers} total users`);
    console.log(`   - ${totalActivities} total activities`);

  } catch (error) {
    console.error('❌ Error seeding athletes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed script
seedAthletes()
  .then(() => {
    console.log('\n✅ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });