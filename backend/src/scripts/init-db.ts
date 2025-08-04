#!/usr/bin/env ts-node

import { initializeDatabase, closeDatabaseConnection } from '../config/database';
import { FitnessThresholdModel } from '../models/FitnessThreshold';

async function initializeDb() {
  try {
    console.log('Initializing database...');
    
    // Initialize database connection
    await initializeDatabase();
    
    // Initialize default fitness threshold if none exists
    const threshold = await FitnessThresholdModel.initializeDefault();
    console.log('Default fitness threshold initialized:', {
      weeklyDistance: threshold.weeklyDistance,
      weeklyActivities: threshold.weeklyActivities,
      averagePace: threshold.averagePace,
    });
    
    console.log('Database initialization completed successfully!');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  } finally {
    await closeDatabaseConnection();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDb();
}

export { initializeDb };