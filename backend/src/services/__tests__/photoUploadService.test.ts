import fs from 'fs/promises';
import sharp from 'sharp';
import { PhotoUploadService } from '../photoUploadService';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('sharp');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockSharp = sharp as jest.MockedFunction<typeof sharp>;

describe('PhotoUploadService', () => {
  const mockUserId = 'user_123';
  const mockFile: Express.Multer.File = {
    fieldname: 'photo',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024 * 1024, // 1MB
    buffer: Buffer.from('fake image data'),
    destination: '',
    filename: '',
    path: '',
    stream: {} as any,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock sharp chain
    const mockSharpInstance = {
      resize: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      toFile: jest.fn().mockResolvedValue({}),
    };
    
    mockSharp.mockReturnValue(mockSharpInstance as any);
  });

  describe('validatePhotoFile', () => {
    it('should validate correct photo file', () => {
      const result = PhotoUploadService.validatePhotoFile(mockFile);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid mime type', () => {
      const invalidFile = {
        ...mockFile,
        mimetype: 'text/plain',
      };

      const result = PhotoUploadService.validatePhotoFile(invalidFile);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should reject file too large', () => {
      const largeFile = {
        ...mockFile,
        size: 10 * 1024 * 1024, // 10MB (exceeds 5MB limit)
      };

      const result = PhotoUploadService.validatePhotoFile(largeFile);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File size too large');
    });

    it('should accept valid mime types', () => {
      const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
      
      validMimeTypes.forEach(mimetype => {
        const file = { ...mockFile, mimetype };
        const result = PhotoUploadService.validatePhotoFile(file);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('processAndSavePhoto', () => {
    beforeEach(() => {
      // Mock environment variables
      process.env.BASE_URL = 'http://localhost:3001';
    });

    it('should process and save photo successfully', async () => {
      const result = await PhotoUploadService.processAndSavePhoto(mockFile, mockUserId);
      
      expect(result.success).toBe(true);
      expect(result.photoUrl).toMatch(/http:\/\/localhost:3001\/uploads\/photos\/user_123_.*\.jpeg/);
      expect(result.thumbnailUrl).toMatch(/http:\/\/localhost:3001\/uploads\/photos\/user_123_.*_thumb\.jpeg/);
      expect(result.error).toBeUndefined();

      // Verify sharp was called correctly
      expect(mockSharp).toHaveBeenCalledWith(mockFile.buffer);
      
      const sharpInstance = mockSharp.mock.results[0].value;
      expect(sharpInstance.resize).toHaveBeenCalledWith(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true,
      });
      expect(sharpInstance.jpeg).toHaveBeenCalledWith({ quality: 85 });
      expect(sharpInstance.toFile).toHaveBeenCalled();
    });

    it('should handle processing errors', async () => {
      const sharpInstance = mockSharp.mock.results[0]?.value || {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toFile: jest.fn().mockRejectedValue(new Error('Processing failed')),
      };
      
      mockSharp.mockReturnValue(sharpInstance as any);

      const result = await PhotoUploadService.processAndSavePhoto(mockFile, mockUserId);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Processing failed');
      expect(result.photoUrl).toBeUndefined();
    });

    it('should create both main photo and thumbnail', async () => {
      await PhotoUploadService.processAndSavePhoto(mockFile, mockUserId);
      
      // Should be called twice - once for main photo, once for thumbnail
      expect(mockSharp).toHaveBeenCalledTimes(2);
      
      const calls = mockSharp.mock.results;
      
      // Main photo processing
      expect(calls[0].value.resize).toHaveBeenCalledWith(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true,
      });
      
      // Thumbnail processing
      expect(calls[1].value.resize).toHaveBeenCalledWith(300, 300, {
        fit: 'cover',
        position: 'center',
      });
    });
  });

  describe('processMultiplePhotos', () => {
    it('should process multiple photos', async () => {
      const files = [mockFile, { ...mockFile, originalname: 'test2.jpg' }];
      
      const results = await PhotoUploadService.processMultiplePhotos(files, mockUserId);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle mixed success/failure results', async () => {
      const files = [mockFile, { ...mockFile, originalname: 'test2.jpg' }];
      
      // Mock first photo success, second photo failure
      let callCount = 0;
      mockSharp.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          // First photo (main + thumbnail)
          return {
            resize: jest.fn().mockReturnThis(),
            jpeg: jest.fn().mockReturnThis(),
            toFile: jest.fn().mockResolvedValue({}),
          } as any;
        } else {
          // Second photo - fail
          return {
            resize: jest.fn().mockReturnThis(),
            jpeg: jest.fn().mockReturnThis(),
            toFile: jest.fn().mockRejectedValue(new Error('Failed')),
          } as any;
        }
      });
      
      const results = await PhotoUploadService.processMultiplePhotos(files, mockUserId);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Failed');
    });
  });

  describe('deletePhoto', () => {
    it('should delete photo and thumbnail', async () => {
      const photoUrl = 'http://localhost:3001/uploads/photos/user_123_abc123.jpeg';
      mockFs.unlink.mockResolvedValue();
      
      const result = await PhotoUploadService.deletePhoto(photoUrl);
      
      expect(result).toBe(true);
      expect(mockFs.unlink).toHaveBeenCalledTimes(2); // Main photo + thumbnail
      
      const calls = mockFs.unlink.mock.calls;
      expect(calls[0][0]).toContain('user_123_abc123.jpeg');
      expect(calls[1][0]).toContain('user_123_abc123_thumb.jpeg');
    });

    it('should handle deletion errors gracefully', async () => {
      const photoUrl = 'http://localhost:3001/uploads/photos/user_123_abc123.jpeg';
      mockFs.unlink.mockRejectedValue(new Error('File not found'));
      
      const result = await PhotoUploadService.deletePhoto(photoUrl);
      
      expect(result).toBe(false);
    });

    it('should ignore errors for missing files', async () => {
      const photoUrl = 'http://localhost:3001/uploads/photos/user_123_abc123.jpeg';
      mockFs.unlink.mockRejectedValue(new Error('ENOENT: no such file'));
      
      const result = await PhotoUploadService.deletePhoto(photoUrl);
      
      expect(result).toBe(false);
    });
  });

  describe('deleteMultiplePhotos', () => {
    it('should delete multiple photos', async () => {
      const photoUrls = [
        'http://localhost:3001/uploads/photos/user_123_abc123.jpeg',
        'http://localhost:3001/uploads/photos/user_123_def456.jpeg',
      ];
      
      mockFs.unlink.mockResolvedValue();
      
      const results = await PhotoUploadService.deleteMultiplePhotos(photoUrls);
      
      expect(results).toEqual([true, true]);
      expect(mockFs.unlink).toHaveBeenCalledTimes(4); // 2 photos × 2 files each
    });

    it('should handle mixed deletion results', async () => {
      const photoUrls = [
        'http://localhost:3001/uploads/photos/user_123_abc123.jpeg',
        'http://localhost:3001/uploads/photos/user_123_def456.jpeg',
      ];
      
      mockFs.unlink
        .mockResolvedValueOnce() // First photo main
        .mockResolvedValueOnce() // First photo thumbnail
        .mockRejectedValueOnce(new Error('Failed')) // Second photo main
        .mockRejectedValueOnce(new Error('Failed')); // Second photo thumbnail
      
      const results = await PhotoUploadService.deleteMultiplePhotos(photoUrls);
      
      expect(results).toEqual([true, false]);
    });
  });

  describe('getPhotoMetadata', () => {
    it('should return photo metadata', async () => {
      const mockMetadata = {
        width: 1920,
        height: 1080,
        format: 'jpeg',
      };
      
      const mockSharpInstance = {
        metadata: jest.fn().mockResolvedValue(mockMetadata),
      };
      
      mockSharp.mockReturnValue(mockSharpInstance as any);
      
      const result = await PhotoUploadService.getPhotoMetadata(mockFile);
      
      expect(result).toEqual({
        width: 1920,
        height: 1080,
        format: 'jpeg',
        size: mockFile.size,
      });
      
      expect(mockSharp).toHaveBeenCalledWith(mockFile.buffer);
      expect(mockSharpInstance.metadata).toHaveBeenCalled();
    });

    it('should handle missing metadata gracefully', async () => {
      const mockMetadata = {}; // Empty metadata
      
      const mockSharpInstance = {
        metadata: jest.fn().mockResolvedValue(mockMetadata),
      };
      
      mockSharp.mockReturnValue(mockSharpInstance as any);
      
      const result = await PhotoUploadService.getPhotoMetadata(mockFile);
      
      expect(result).toEqual({
        width: 0,
        height: 0,
        format: 'unknown',
        size: mockFile.size,
      });
    });
  });

  describe('getStorageStats', () => {
    it('should return storage statistics', async () => {
      const mockFiles = ['photo1.jpg', 'photo2.jpg', 'photo3.jpg'];
      const mockStats = { size: 1024 };
      
      mockFs.readdir.mockResolvedValue(mockFiles as any);
      mockFs.stat.mockResolvedValue(mockStats as any);
      
      const result = await PhotoUploadService.getStorageStats();
      
      expect(result).toEqual({
        totalFiles: 3,
        totalSize: 3072, // 3 × 1024
        averageSize: 1024,
      });
      
      expect(mockFs.readdir).toHaveBeenCalled();
      expect(mockFs.stat).toHaveBeenCalledTimes(3);
    });

    it('should handle empty directory', async () => {
      mockFs.readdir.mockResolvedValue([]);
      
      const result = await PhotoUploadService.getStorageStats();
      
      expect(result).toEqual({
        totalFiles: 0,
        totalSize: 0,
        averageSize: 0,
      });
    });

    it('should handle errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory not found'));
      
      const result = await PhotoUploadService.getStorageStats();
      
      expect(result).toEqual({
        totalFiles: 0,
        totalSize: 0,
        averageSize: 0,
      });
    });
  });

  describe('cleanupOldPhotos', () => {
    it('should delete old photos', async () => {
      const mockFiles = ['old_photo.jpg', 'new_photo.jpg'];
      const oldDate = new Date('2023-01-01');
      const newDate = new Date();
      
      mockFs.readdir.mockResolvedValue(mockFiles as any);
      mockFs.stat
        .mockResolvedValueOnce({ mtime: oldDate } as any) // Old file
        .mockResolvedValueOnce({ mtime: newDate } as any); // New file
      mockFs.unlink.mockResolvedValue();
      
      const result = await PhotoUploadService.cleanupOldPhotos(30);
      
      expect(result).toBe(1); // Only one old file deleted
      expect(mockFs.unlink).toHaveBeenCalledTimes(1);
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('old_photo.jpg')
      );
    });

    it('should handle cleanup errors', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Access denied'));
      
      const result = await PhotoUploadService.cleanupOldPhotos(30);
      
      expect(result).toBe(0);
    });
  });
});