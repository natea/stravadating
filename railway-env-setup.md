# Railway Environment Variables Setup

## Backend Service Variables

Add these environment variables to your backend service in Railway:

### Database Connection
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### Required Environment Variables
```
NODE_ENV=production
PORT=3000

# JWT Configuration
JWT_SECRET=your-secure-jwt-secret-here-change-this
JWT_REFRESH_SECRET=your-secure-refresh-secret-here-change-this

# Strava API Configuration
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
STRAVA_REDIRECT_URI=https://${{RAILWAY_PUBLIC_DOMAIN}}/auth/strava/callback

# Security & Encryption
ENCRYPTION_KEY=generate-64-char-hex-string-here
SALT_ROUNDS=10

# Redis (Optional - comment out if not using)
# REDIS_URL=${{Redis.REDIS_URL}}

# Sentry (Optional)
# SENTRY_DSN=your-sentry-dsn-here

# Email Service (Optional)
# EMAIL_FROM=noreply@stravadating.com
# SENDGRID_API_KEY=your-sendgrid-api-key

# Frontend URL (for CORS)
FRONTEND_URL=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
```

## Frontend Service Variables

Add these to your frontend service:

```
REACT_APP_API_BASE_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}/api
REACT_APP_WEBSOCKET_URL=wss://${{backend.RAILWAY_PUBLIC_DOMAIN}}
REACT_APP_STRAVA_CLIENT_ID=your-strava-client-id
REACT_APP_STRAVA_REDIRECT_URI=https://${{RAILWAY_PUBLIC_DOMAIN}}/auth/strava/callback
REACT_APP_ENVIRONMENT=production
```

## How to Set These in Railway

1. Go to your Railway project dashboard
2. Click on the backend service
3. Go to the "Variables" tab
4. Click "RAW Editor" 
5. Paste the backend variables (replace placeholder values)
6. Save

7. Click on the frontend service
8. Go to the "Variables" tab
9. Click "RAW Editor"
10. Paste the frontend variables (replace placeholder values)
11. Save

## Generating Secure Secrets

### Generate JWT_SECRET and JWT_REFRESH_SECRET:
```bash
openssl rand -base64 32
```

### Generate ENCRYPTION_KEY (64 character hex):
```bash
openssl rand -hex 32
```

## Notes

- The `${{Postgres.DATABASE_URL}}` syntax will automatically reference your Postgres database
- The `${{RAILWAY_PUBLIC_DOMAIN}}` will use each service's public domain
- The `${{backend.RAILWAY_PUBLIC_DOMAIN}}` references the backend service's domain from frontend
- Make sure to replace all placeholder values with actual values
- The services will automatically redeploy when you save the variables