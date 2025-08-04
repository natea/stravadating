# Database Setup Documentation

## Overview

This document describes the database schema and models implemented for the fitness dating app.

## Database Schema

The application uses PostgreSQL with Prisma ORM. The schema includes the following tables:

### Core Tables

1. **users** - User profiles and basic information
2. **fitness_stats** - User fitness statistics from Strava
3. **strava_activities** - Individual Strava activities
4. **matches** - User matches and compatibility scores
5. **matching_preferences** - User preferences for matching
6. **messages** - Chat messages between matched users
7. **fitness_thresholds** - Admin-configurable fitness requirements

## Models Implemented

### UserModel
- `create()` - Create new user
- `findById()` - Find user by ID
- `findByEmail()` - Find user by email
- `findByStravaId()` - Find user by Strava ID
- `update()` - Update user information
- `delete()` - Delete user
- `findMany()` - Get paginated users
- `findUsersWithinDistance()` - Find users within geographic radius
- `updateLastActive()` - Update last active timestamp

### FitnessStatsModel
- `create()` - Create fitness stats
- `findByUserId()` - Get user's fitness stats
- `update()` - Update fitness stats
- `upsert()` - Create or update fitness stats
- `findUsersAboveThreshold()` - Find users meeting fitness requirements

### StravaActivityModel
- `create()` - Create single activity
- `createMany()` - Bulk insert activities
- `findByUserId()` - Get user's activities
- `findByUserIdAndDateRange()` - Get activities in date range
- `getActivityStats()` - Calculate activity statistics
- `deleteOlderThan()` - Clean up old activities

### MatchModel
- `create()` - Create new match
- `findByUserId()` - Get user's matches
- `findByUserIds()` - Find match between two users
- `update()` - Update match
- `archive()` - Archive match
- `getMatchStats()` - Get match statistics
- `areUsersMatched()` - Check if users are matched

### MatchingPreferencesModel
- `create()` - Create preferences
- `findByUserId()` - Get user preferences
- `update()` - Update preferences
- `upsert()` - Create or update preferences
- `findCompatibleUsers()` - Find compatible users
- `checkActivityCompatibility()` - Check activity compatibility

### MessageModel
- `create()` - Create message
- `findByMatchId()` - Get match messages
- `markAsRead()` - Mark message as read
- `markAllAsReadForMatch()` - Mark all messages as read
- `getUnreadCount()` - Get unread message count
- `searchInMatch()` - Search messages

### FitnessThresholdModel
- `create()` - Create threshold
- `getCurrent()` - Get current threshold
- `update()` - Update threshold (creates audit record)
- `checkUserMeetsThreshold()` - Validate user against threshold
- `initializeDefault()` - Set up default threshold
- `getHistory()` - Get threshold history

## Database Configuration

### Connection Setup
- Uses Prisma Client with connection pooling
- Configurable connection limits and timeouts
- Health check functionality
- Graceful shutdown handling

### Environment Variables
```
DATABASE_URL=postgresql://user:password@host:port/database
DB_MAX_CONNECTIONS=10
DB_CONNECTION_TIMEOUT=10000
DB_QUERY_TIMEOUT=30000
```

## Migration Commands

```bash
# Generate Prisma client
npm run db:generate

# Create and run migration
npm run db:migrate

# Deploy migrations to production
npm run db:migrate:prod

# Open Prisma Studio
npm run db:studio

# Initialize database with default data
npm run db:seed

# Reset database (development only)
npm run db:reset
```

## Type Safety

All models include comprehensive TypeScript interfaces:
- Input types for create/update operations
- Response types matching database schema
- Pagination and filtering types
- Error handling types

## Testing

Basic model structure tests are included to verify:
- Model exports and method availability
- Default configuration values
- Type structure validation

## Database Setup Instructions

### Prerequisites
- PostgreSQL installed locally
- Node.js and npm installed
- Backend dependencies installed (`npm install` in the backend directory)

### Step 0: Start PostgreSQL on macOS

First, make sure PostgreSQL is running. Here are the common ways to start it on macOS:

**If installed via Homebrew:**
```bash
# Start PostgreSQL service
brew services start postgresql

# Check if it's running
brew services list | grep postgresql

# Stop PostgreSQL (when needed)
brew services stop postgresql
```

**If installed via Postgres.app:**
- Open the Postgres.app from Applications
- Click "Start" to start the server
- The elephant icon in your menu bar should turn blue when running

**If installed manually or via other methods:**
```bash
# Start PostgreSQL manually (replace with your actual data directory)
pg_ctl -D /usr/local/var/postgres start

# Or if using a different data directory
pg_ctl -D /opt/homebrew/var/postgres start
```

**Check if PostgreSQL is running:**
```bash
# Try to connect - if this works, PostgreSQL is running
psql -U postgres

# Or check the process
ps aux | grep postgres
```

**Common PostgreSQL locations on macOS:**
- Homebrew (Intel): `/usr/local/var/postgres`
- Homebrew (Apple Silicon): `/opt/homebrew/var/postgres`
- Postgres.app: Usually handles this automatically

### Step 1: Create the Database

Connect to PostgreSQL and create the databases:

```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Create development database
CREATE DATABASE fitness_dating_dev;

# Create test database (optional, for running tests)
CREATE DATABASE fitness_dating_test;

# Create a dedicated user (optional but recommended)
CREATE USER fitness_app WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE fitness_dating_dev TO fitness_app;
GRANT ALL PRIVILEGES ON DATABASE fitness_dating_test TO fitness_app;

# Exit psql
\q
```

### Step 2: Configure Environment Variables

Update your `.env` file in the backend directory:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and update the database connection:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/fitness_dating_dev

# Or if you created a dedicated user:
# DATABASE_URL=postgresql://fitness_app:your_secure_password@localhost:5432/fitness_dating_dev

# Database Connection Pool Settings
DB_MAX_CONNECTIONS=10
DB_CONNECTION_TIMEOUT=10000
DB_QUERY_TIMEOUT=30000
```

### Step 3: Generate Prisma Client

```bash
cd backend
npm run db:generate
```

### Step 4: Run Database Migrations

```bash
# Create and apply the initial migration
npm run db:migrate

# This will:
# 1. Create a migration file in prisma/migrations/
# 2. Apply the migration to create all tables
# 3. Update the Prisma client
```

### Step 5: Initialize Default Data

```bash
# Seed the database with default fitness thresholds
npm run db:seed
```

### Step 6: Verify Setup

You can verify the setup by:

1. **Using Prisma Studio** (visual database browser):
   ```bash
   npm run db:studio
   ```
   This opens a web interface at http://localhost:5555

2. **Connecting directly to PostgreSQL**:
   ```bash
   psql -U postgres -d fitness_dating_dev
   
   # List all tables
   \dt
   
   # Check a specific table
   \d users
   
   # Exit
   \q
   ```

3. **Running the tests**:
   ```bash
   npm test -- --testPathPattern=database-schema
   ```

### Troubleshooting

**PostgreSQL Not Starting on macOS:**
```bash
# If Homebrew installation has issues
brew services restart postgresql

# Check Homebrew PostgreSQL logs
brew services list
tail -f /opt/homebrew/var/log/postgres.log  # Apple Silicon
# or
tail -f /usr/local/var/log/postgres.log     # Intel Mac

# If you get permission errors, try:
sudo chown -R $(whoami) /opt/homebrew/var/postgres  # Apple Silicon
# or
sudo chown -R $(whoami) /usr/local/var/postgres     # Intel Mac
```

**Connection Issues:**
- Ensure PostgreSQL is running: `brew services start postgresql`
- Check if the port is correct (default is 5432): `lsof -i :5432`
- Verify username and password in DATABASE_URL
- Try connecting directly: `psql -U postgres -h localhost`

**If PostgreSQL isn't installed:**
```bash
# Install via Homebrew (recommended)
brew install postgresql
brew services start postgresql

# Or download Postgres.app from https://postgresapp.com/
```

**Permission Issues:**
```sql
-- If you get permission errors, grant additional privileges:
GRANT ALL ON SCHEMA public TO fitness_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fitness_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fitness_app;
```

**Migration Issues:**
```bash
# If migrations fail, you can reset and try again:
npm run db:reset

# This will drop the database, recreate it, and run all migrations
```

### Development Workflow

For ongoing development:

```bash
# After schema changes, create a new migration
npm run db:migrate

# Reset database during development (careful - deletes all data!)
npm run db:reset

# Generate client after manual schema changes
npm run db:generate
```

### Quick Setup Script

Here's a complete setup script you can run:

```bash
#!/bin/bash
# Save this as setup-db.sh and run with: chmod +x setup-db.sh && ./setup-db.sh

echo "Setting up fitness dating app database..."

# Create databases
psql -U postgres -c "CREATE DATABASE fitness_dating_dev;"
psql -U postgres -c "CREATE DATABASE fitness_dating_test;"

echo "Databases created successfully!"

# Navigate to backend directory
cd backend

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Please update the DATABASE_URL in .env file with your PostgreSQL credentials"
    echo "Then run: npm run db:migrate && npm run db:seed"
else
    # Generate Prisma client
    npm run db:generate
    
    # Run migrations
    npm run db:migrate
    
    # Seed database
    npm run db:seed
    
    echo "Database setup complete!"
    echo "You can now start the development server or open Prisma Studio with: npm run db:studio"
fi
```

### Expected Database Structure

After successful setup, you should see these tables:

- `users` - User profiles and authentication data
- `fitness_stats` - Aggregated fitness statistics per user  
- `strava_activities` - Individual Strava activity records
- `matches` - User matches with compatibility scores
- `matching_preferences` - User preferences for matching algorithm
- `messages` - Chat messages between matched users
- `fitness_thresholds` - Admin-configurable fitness requirements
- `_prisma_migrations` - Prisma migration tracking table

Each table will have appropriate indexes, foreign key constraints, and default values as defined in the schema.

## Security Features

- Input validation and sanitization
- SQL injection prevention via Prisma
- Proper error handling for database constraints
- Secure connection configuration options