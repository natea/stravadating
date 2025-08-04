import * as cron from 'node-cron';
import { schedulerService, SchedulerService } from '../schedulerService';
import { syncService } from '../syncService';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('node-cron');
jest.mock('../syncService');
jest.mock('../../utils/logger');

const mockCron = cron as jest.Mocked<typeof cron>;
const mockSyncService = syncService as jest.Mocked<typeof syncService>;

describe('SchedulerService', () => {
  let service: SchedulerService;
  let mockScheduledTask: jest.Mocked<cron.ScheduledTask>;

  beforeEach(() => {
    service = new SchedulerService();
    
    mockScheduledTask = {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
      running: false,
    } as any;

    mockCron.schedule.mockReturnValue(mockScheduledTask);
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize all scheduled jobs', () => {
      // Act
      service.init();

      // Assert
      expect(mockCron.schedule).toHaveBeenCalledTimes(2);
      
      // Check daily sync job
      expect(mockCron.schedule).toHaveBeenCalledWith(
        '0 2 * * *',
        expect.any(Function),
        {
          scheduled: false,
          timezone: 'UTC',
        }
      );

      // Check weekly cleanup job
      expect(mockCron.schedule).toHaveBeenCalledWith(
        '0 3 * * 0',
        expect.any(Function),
        {
          scheduled: false,
          timezone: 'UTC',
        }
      );
    });
  });

  describe('start', () => {
    it('should start all scheduled jobs', () => {
      // Arrange
      service.init();

      // Act
      service.start();

      // Assert
      expect(mockScheduledTask.start).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop', () => {
    it('should stop all scheduled jobs', () => {
      // Arrange
      service.init();

      // Act
      service.stop();

      // Assert
      expect(mockScheduledTask.stop).toHaveBeenCalledTimes(2);
    });
  });

  describe('startJob', () => {
    it('should start a specific job', () => {
      // Arrange
      service.init();

      // Act
      const result = service.startJob('dailySync');

      // Assert
      expect(result).toBe(true);
      expect(mockScheduledTask.start).toHaveBeenCalledTimes(1);
    });

    it('should return false for non-existent job', () => {
      // Arrange
      service.init();

      // Act
      const result = service.startJob('nonExistentJob');

      // Assert
      expect(result).toBe(false);
      expect(mockScheduledTask.start).not.toHaveBeenCalled();
    });
  });

  describe('stopJob', () => {
    it('should stop a specific job', () => {
      // Arrange
      service.init();

      // Act
      const result = service.stopJob('dailySync');

      // Assert
      expect(result).toBe(true);
      expect(mockScheduledTask.stop).toHaveBeenCalledTimes(1);
    });

    it('should return false for non-existent job', () => {
      // Arrange
      service.init();

      // Act
      const result = service.stopJob('nonExistentJob');

      // Assert
      expect(result).toBe(false);
      expect(mockScheduledTask.stop).not.toHaveBeenCalled();
    });
  });

  describe('getJobsStatus', () => {
    it('should return status of all jobs', () => {
      // Arrange
      service.init();
      mockScheduledTask.running = true;

      // Act
      const status = service.getJobsStatus();

      // Assert
      expect(status).toEqual({
        dailySync: true,
        weeklyCleanup: true,
      });
    });
  });

  describe('triggerDailySync', () => {
    it('should manually trigger daily sync', async () => {
      // Arrange
      const mockResult = {
        totalUsers: 10,
        successfulSyncs: 8,
        failedSyncs: 2,
        results: [],
      };
      mockSyncService.syncAllUsersActivities.mockResolvedValue(mockResult);

      // Act
      await service.triggerDailySync();

      // Assert
      expect(mockSyncService.syncAllUsersActivities).toHaveBeenCalledTimes(1);
    });

    it('should handle sync errors', async () => {
      // Arrange
      mockSyncService.syncAllUsersActivities.mockRejectedValue(new Error('Sync failed'));

      // Act & Assert
      await expect(service.triggerDailySync()).rejects.toThrow('Sync failed');
    });
  });

  describe('triggerWeeklyCleanup', () => {
    it('should manually trigger weekly cleanup', async () => {
      // Arrange
      const mockResult = {
        cleanedUsers: 2,
        errors: [],
      };
      mockSyncService.cleanupRevokedUsers.mockResolvedValue(mockResult);

      // Act
      await service.triggerWeeklyCleanup();

      // Assert
      expect(mockSyncService.cleanupRevokedUsers).toHaveBeenCalledTimes(1);
    });

    it('should handle cleanup errors', async () => {
      // Arrange
      mockSyncService.cleanupRevokedUsers.mockRejectedValue(new Error('Cleanup failed'));

      // Act & Assert
      await expect(service.triggerWeeklyCleanup()).rejects.toThrow('Cleanup failed');
    });
  });

  describe('addCustomJob', () => {
    it('should add a custom job successfully', () => {
      // Arrange
      service.init();
      const customTask = jest.fn().mockResolvedValue(undefined);

      // Act
      const result = service.addCustomJob('customJob', '0 0 * * *', customTask);

      // Assert
      expect(result).toBe(true);
      expect(mockCron.schedule).toHaveBeenCalledWith(
        '0 0 * * *',
        expect.any(Function),
        {
          scheduled: false,
          timezone: 'UTC',
        }
      );
    });

    it('should not add job if name already exists', () => {
      // Arrange
      service.init();
      const customTask = jest.fn().mockResolvedValue(undefined);

      // Act
      const result = service.addCustomJob('dailySync', '0 0 * * *', customTask);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle invalid cron expression', () => {
      // Arrange
      service.init();
      mockCron.schedule.mockImplementation(() => {
        throw new Error('Invalid cron expression');
      });
      const customTask = jest.fn().mockResolvedValue(undefined);

      // Act
      const result = service.addCustomJob('invalidJob', 'invalid-cron', customTask);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('removeCustomJob', () => {
    it('should remove a custom job successfully', () => {
      // Arrange
      service.init();
      const customTask = jest.fn().mockResolvedValue(undefined);
      service.addCustomJob('customJob', '0 0 * * *', customTask);

      // Act
      const result = service.removeCustomJob('customJob');

      // Assert
      expect(result).toBe(true);
      expect(mockScheduledTask.stop).toHaveBeenCalled();
      expect(mockScheduledTask.destroy).toHaveBeenCalled();
    });

    it('should return false for non-existent job', () => {
      // Arrange
      service.init();

      // Act
      const result = service.removeCustomJob('nonExistentJob');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should gracefully shutdown all jobs', () => {
      // Arrange
      service.init();

      // Act
      service.shutdown();

      // Assert
      expect(mockScheduledTask.stop).toHaveBeenCalledTimes(2);
      expect(mockScheduledTask.destroy).toHaveBeenCalledTimes(2);
    });
  });

  describe('scheduled job execution', () => {
    it('should execute daily sync job correctly', async () => {
      // Arrange
      const mockResult = {
        totalUsers: 5,
        successfulSyncs: 4,
        failedSyncs: 1,
        results: [
          { userId: 'user-1', activitiesSynced: 2, fitnessStatsUpdated: true },
          { userId: 'user-2', activitiesSynced: 0, fitnessStatsUpdated: false, error: 'Failed' },
        ],
      };
      mockSyncService.syncAllUsersActivities.mockResolvedValue(mockResult);

      service.init();

      // Get the scheduled function
      const scheduledFunction = mockCron.schedule.mock.calls[0][1];

      // Act
      await scheduledFunction();

      // Assert
      expect(mockSyncService.syncAllUsersActivities).toHaveBeenCalledTimes(1);
    });

    it('should execute weekly cleanup job correctly', async () => {
      // Arrange
      const mockResult = {
        cleanedUsers: 1,
        errors: [],
      };
      mockSyncService.cleanupRevokedUsers.mockResolvedValue(mockResult);

      service.init();

      // Get the scheduled function for weekly cleanup (second call)
      const scheduledFunction = mockCron.schedule.mock.calls[1][1];

      // Act
      await scheduledFunction();

      // Assert
      expect(mockSyncService.cleanupRevokedUsers).toHaveBeenCalledTimes(1);
    });

    it('should handle job execution errors gracefully', async () => {
      // Arrange
      mockSyncService.syncAllUsersActivities.mockRejectedValue(new Error('Job failed'));

      service.init();

      // Get the scheduled function
      const scheduledFunction = mockCron.schedule.mock.calls[0][1];

      // Act
      await scheduledFunction();

      // Assert
      expect(mockSyncService.syncAllUsersActivities).toHaveBeenCalledTimes(1);
      // Should not throw error, just log it
    });
  });
});