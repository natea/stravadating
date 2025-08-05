# Deploying to Railway

This guide will help you deploy the Stravadating app to Railway.

## Prerequisites

1. A [Railway account](https://railway.app)
2. Railway CLI installed (optional): `npm install -g @railway/cli`
3. A Strava API application ([create one here](https://www.strava.com/settings/api))

## Deployment Steps

### 1. Create a New Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Choose "Deploy from GitHub repo" and connect your repository

### 2. Set Up Database Services

#### PostgreSQL Database
1. In your Railway project, click "New Service"
2. Choose "Database" → "Add PostgreSQL"
3. Railway will automatically set the `DATABASE_URL` environment variable

#### Redis Cache (Optional but Recommended)
1. Click "New Service" 
2. Choose "Database" → "Add Redis"
3. Railway will automatically set the `REDIS_URL` environment variable

### 3. Configure Environment Variables

In your Railway project settings, add the following environment variables:

#### Backend Service Variables
```bash
# Server
NODE_ENV=production
PORT=3000

# JWT Secrets (generate secure values)
JWT_SECRET=<generate-with: openssl rand -hex 64>
JWT_REFRESH_SECRET=<generate-with: openssl rand -hex 64>

# Strava API
STRAVA_CLIENT_ID=<your-strava-client-id>
STRAVA_CLIENT_SECRET=<your-strava-client-secret>
STRAVA_REDIRECT_URI=https://<your-backend-domain>.up.railway.app/api/auth/strava/callback

# Encryption Keys
ENCRYPTION_KEY=<generate-with: openssl rand -hex 32>
MESSAGE_ENCRYPTION_KEY=<generate-with: openssl rand -hex 32>

# Frontend URL (update after deploying frontend)
FRONTEND_URL=https://<your-frontend-domain>.up.railway.app
```

#### Frontend Service Variables
```bash
REACT_APP_API_URL=https://<your-backend-domain>.up.railway.app/api
REACT_APP_SOCKET_URL=https://<your-backend-domain>.up.railway.app
```

### 4. Deploy the Application

#### Option A: Using Railway Dashboard (Recommended)

1. Railway will automatically detect the configuration files
2. It will build and deploy both backend and frontend services
3. Monitor the deployment logs in the Railway dashboard

#### Option B: Using Railway CLI

```bash
# Login to Railway
railway login

# Link to your project
railway link

# Deploy
railway up
```

### 5. Set Up Custom Domains (Optional)

1. Go to your service settings in Railway
2. Click on "Settings" → "Domains"
3. Add your custom domain
4. Update DNS records as instructed

### 6. Database Migrations

The backend is configured to automatically run Prisma migrations on startup. If you need to run them manually:

```bash
railway run cd backend && npx prisma migrate deploy
```

### 7. Verify Deployment

1. Check the health endpoint: `https://<your-backend-domain>.up.railway.app/health`
2. Visit the frontend: `https://<your-frontend-domain>.up.railway.app`
3. Test Strava OAuth flow

## Monitoring & Logs

- View logs in Railway dashboard under each service
- Set up alerts for service health
- Monitor resource usage in the metrics tab

## Troubleshooting

### Database Connection Issues
- Ensure `DATABASE_URL` is properly set
- Check if migrations have run successfully
- Verify PostgreSQL service is running

### Strava OAuth Issues
- Verify `STRAVA_REDIRECT_URI` matches your Railway domain
- Update the callback URL in your Strava app settings
- Check that all Strava environment variables are set

### Build Failures
- Check Node.js version compatibility (requires 18+)
- Verify all dependencies are installed
- Review build logs for specific errors

### WebSocket Connection Issues
- Ensure `REACT_APP_SOCKET_URL` uses `wss://` for production
- Check CORS settings in backend
- Verify frontend URL is in allowed origins

## Scaling

Railway allows easy scaling:
1. Go to service settings
2. Adjust replica count
3. Configure autoscaling rules

## Costs

- PostgreSQL: ~$5-20/month depending on usage
- Redis: ~$5-10/month
- Application hosting: Based on usage (RAM/CPU)
- Check [Railway pricing](https://railway.app/pricing) for details

## Security Checklist

- [ ] Generate strong, unique secrets for JWT tokens
- [ ] Use different encryption keys for production
- [ ] Enable HTTPS (automatic on Railway)
- [ ] Set up rate limiting
- [ ] Configure CORS properly
- [ ] Enable security headers (helmet.js)
- [ ] Regular dependency updates
- [ ] Monitor for security alerts

## Support

- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- Application issues: Check the repository issues