import { Router } from 'express';
import { authService } from '../services/authService';
import { UserModel } from '../models/User';

const router = Router();

// Development-only route to login as any user
// WARNING: This should NEVER be enabled in production
if (process.env.NODE_ENV !== 'production') {
  router.post('/login-as/:userId', async (req, res): Promise<any> => {
    try {
      const { userId } = req.params;
      
      // Find the user
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User with specified ID not found',
        });
      }

      // Generate JWT tokens
      const accessToken = authService.generateAccessToken(user);
      const refreshToken = authService.generateRefreshToken(user);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            stravaId: user.stravaId,
            age: user.age,
            gender: user.gender,
            city: user.city,
            state: user.state,
            bio: user.bio,
            photos: user.photos,
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: process.env.JWT_EXPIRES_IN || '1h',
          },
        },
        message: `Logged in as ${user.firstName} ${user.lastName}`,
      });
    } catch (error) {
      console.error('Error in dev login:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed',
        message: error instanceof Error ? error.message : 'Failed to login',
      });
    }
  });

  // Get list of all users for testing
  router.get('/users', async (_req, res) => {
    try {
      const result = await UserModel.findMany({ page: 1, limit: 50 });
      
      res.json({
        success: true,
        data: result.data.map((user: any) => ({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          age: user.age,
          gender: user.gender,
          city: user.city,
          state: user.state,
          stravaId: user.stravaId,
        })),
        message: 'Users retrieved successfully',
      });
    } catch (error) {
      console.error('Error getting users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get users',
        message: error instanceof Error ? error.message : 'Failed to retrieve users',
      });
    }
  });
}

export default router;