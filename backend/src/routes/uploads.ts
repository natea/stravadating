import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route   GET /uploads/photos/:filename
 * @desc    Serve uploaded photo files
 * @access  Public
 */
router.get('/photos/:filename', async (req, res): Promise<void> => {
  try {
    const { filename } = req.params;
    
    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename',
        message: 'Filename contains invalid characters',
      });
    }

    const uploadDir = process.env.UPLOAD_DIR || 'uploads/photos';
    const filePath = path.join(uploadDir, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'File not found',
        message: 'The requested photo does not exist',
      });
    }

    // Set appropriate headers
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/jpeg'; // default

    switch (ext) {
      case '.png':
        contentType = 'image/png';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.jpg':
      case '.jpeg':
      default:
        contentType = 'image/jpeg';
        break;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('ETag', `"${filename}"`);

    // Check if client has cached version
    const clientETag = req.headers['if-none-match'];
    if (clientETag === `"${filename}"`) {
      return res.status(304).end();
    }

    // Send file
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    logger.error('Error serving photo:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to serve photo',
    });
  }
});

export default router;