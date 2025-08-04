import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface PhotoUploadResult {
  success: boolean;
  photoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

export interface PhotoProcessingOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
}

export class PhotoUploadService {
  private static readonly UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads/photos';
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  
  private static readonly PHOTO_OPTIONS: PhotoProcessingOptions = {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 85,
    format: 'jpeg',
  };

  private static readonly THUMBNAIL_OPTIONS: PhotoProcessingOptions = {
    maxWidth: 300,
    maxHeight: 300,
    quality: 80,
    format: 'jpeg',
  };

  /**
   * Configure multer for photo uploads
   */
  static getMulterConfig() {
    // Ensure upload directory exists
    this.ensureUploadDirectory();

    const storage = multer.memoryStorage(); // Store in memory for processing

    return multer({
      storage,
      limits: {
        fileSize: this.MAX_FILE_SIZE,
        files: 10, // Max 10 files per upload
      },
      fileFilter: (_req, file, cb) => {
        if (this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
        }
      },
    });
  }

  /**
   * Process and save uploaded photo
   */
  static async processAndSavePhoto(
    file: Express.Multer.File,
    userId: string
  ): Promise<PhotoUploadResult> {
    try {
      logger.info(`Processing photo upload for user ${userId}`);

      // Generate unique filename
      const fileId = uuidv4();
      const photoFilename = `${userId}_${fileId}.${this.PHOTO_OPTIONS.format}`;
      const thumbnailFilename = `${userId}_${fileId}_thumb.${this.THUMBNAIL_OPTIONS.format}`;

      const photoPath = path.join(this.UPLOAD_DIR, photoFilename);
      const thumbnailPath = path.join(this.UPLOAD_DIR, thumbnailFilename);

      // Process main photo
      await sharp(file.buffer)
        .resize(this.PHOTO_OPTIONS.maxWidth, this.PHOTO_OPTIONS.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: this.PHOTO_OPTIONS.quality })
        .toFile(photoPath);

      // Process thumbnail
      await sharp(file.buffer)
        .resize(this.THUMBNAIL_OPTIONS.maxWidth, this.THUMBNAIL_OPTIONS.maxHeight, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: this.THUMBNAIL_OPTIONS.quality })
        .toFile(thumbnailPath);

      // Generate URLs (in production, these would be CDN URLs)
      const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
      const photoUrl = `${baseUrl}/uploads/photos/${photoFilename}`;
      const thumbnailUrl = `${baseUrl}/uploads/photos/${thumbnailFilename}`;

      logger.info(`Successfully processed photo for user ${userId}: ${photoUrl}`);

      return {
        success: true,
        photoUrl,
        thumbnailUrl,
      };
    } catch (error) {
      logger.error(`Failed to process photo for user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process photo',
      };
    }
  }

  /**
   * Process multiple photos
   */
  static async processMultiplePhotos(
    files: Express.Multer.File[],
    userId: string
  ): Promise<PhotoUploadResult[]> {
    const results: PhotoUploadResult[] = [];

    for (const file of files) {
      const result = await this.processAndSavePhoto(file, userId);
      results.push(result);
    }

    return results;
  }

  /**
   * Delete photo files
   */
  static async deletePhoto(photoUrl: string): Promise<boolean> {
    try {
      // Extract filename from URL
      const filename = path.basename(photoUrl);
      const photoPath = path.join(this.UPLOAD_DIR, filename);
      
      // Also delete thumbnail if it exists
      const thumbnailFilename = filename.replace(/\.([^.]+)$/, '_thumb.$1');
      const thumbnailPath = path.join(this.UPLOAD_DIR, thumbnailFilename);

      // Delete files
      await Promise.all([
        fs.unlink(photoPath).catch(() => {}), // Ignore errors if file doesn't exist
        fs.unlink(thumbnailPath).catch(() => {}),
      ]);

      logger.info(`Deleted photo: ${filename}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete photo ${photoUrl}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple photos
   */
  static async deleteMultiplePhotos(photoUrls: string[]): Promise<boolean[]> {
    const results: boolean[] = [];

    for (const url of photoUrls) {
      const result = await this.deletePhoto(url);
      results.push(result);
    }

    return results;
  }

  /**
   * Validate photo file
   */
  static validatePhotoFile(file: Express.Multer.File): { isValid: boolean; error?: string } {
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return {
        isValid: false,
        error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
      };
    }

    if (file.size > this.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size too large. Maximum size is ${this.MAX_FILE_SIZE / (1024 * 1024)}MB.`,
      };
    }

    return { isValid: true };
  }

  /**
   * Get photo metadata
   */
  static async getPhotoMetadata(file: Express.Multer.File): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
  }> {
    const metadata = await sharp(file.buffer).metadata();
    
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: file.size,
    };
  }

  /**
   * Ensure upload directory exists
   */
  private static async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.UPLOAD_DIR);
    } catch {
      await fs.mkdir(this.UPLOAD_DIR, { recursive: true });
      logger.info(`Created upload directory: ${this.UPLOAD_DIR}`);
    }
  }

  /**
   * Clean up old photos (for maintenance)
   */
  static async cleanupOldPhotos(daysOld: number = 30): Promise<number> {
    try {
      const files = await fs.readdir(this.UPLOAD_DIR);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.UPLOAD_DIR, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      logger.info(`Cleaned up ${deletedCount} old photos`);
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old photos:', error);
      return 0;
    }
  }

  /**
   * Get storage usage statistics
   */
  static async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    averageSize: number;
  }> {
    try {
      const files = await fs.readdir(this.UPLOAD_DIR);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(this.UPLOAD_DIR, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      return {
        totalFiles: files.length,
        totalSize,
        averageSize: files.length > 0 ? totalSize / files.length : 0,
      };
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        averageSize: 0,
      };
    }
  }
}