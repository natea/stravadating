# Strava API Integration Services

This directory contains the Strava API integration services for the fitness dating app.

## Services

### StravaService

The core service that handles direct communication with the Strava API v3.

**Features:**
- Rate limiting and retry logic
- Token refresh mechanism
- Activity and athlete data fetching
- Data transformation from Strava API format to internal models
- Comprehensive error handling

**Usage:**
```typescript
import { createStravaService } from './stravaService';

const stravaService = createStravaService();

// Fetch athlete profile
const athlete = await stravaService.fetchAthleteProfile(accessToken);

// Fetch activities
const activities = await stravaService.fetchLast90DaysActivities(accessToken);

// Calculate fitness metrics
const metrics = stravaService.calculateFitnessMetrics(activities);
```

### StravaIntegrationService

A higher-level service that provides user-centric operations with automatic token management.

**Features:**
- Automatic token refresh on expiration
- User token storage and management
- Retry logic for 401 errors
- Comprehensive fitness data synchronization
- Connection validation

**Usage:**
```typescript
import { stravaIntegrationService } from './stravaIntegrationService';

// Set user tokens (typically after OAuth flow)
stravaIntegrationService.setUserTokens(userId, {
  accessToken: 'token',
  refreshToken: 'refresh',
  expiresAt: 1234567890
});

// Sync user's fitness data (handles token refresh automatically)
const syncResult = await stravaIntegrationService.syncUserFitnessData(userId);

// Validate connection
const isValid = await stravaIntegrationService.validateStravaConnection(userId);
```

## Error Handling

Both services implement comprehensive error handling:

- **Rate Limiting (429)**: Automatic exponential backoff with jitter
- **Token Expiration (401)**: Automatic token refresh and retry
- **Service Unavailable (503)**: User-friendly error messages with retry logic
- **Access Revoked**: Clear messaging when Strava access is revoked

## Testing

Comprehensive unit tests are provided with mocked Strava API responses:

```bash
npm test -- --testPathPattern=stravaService.test.ts
npm test -- --testPathPattern=stravaIntegrationService.test.ts
```

## Rate Limiting

The services respect Strava's API rate limits:
- Short-term: 600 requests per 15 minutes
- Daily: 30,000 requests per day

Rate limiting is handled automatically with intelligent queuing and backoff strategies.