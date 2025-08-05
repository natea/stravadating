import { Request, Response } from 'express';
import { MessageService } from '../services/messageService';
import { logger } from '../utils/logger';

export class MessageController {
  /**
   * Send a message
   */
  static async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const senderId = req.user?.userId;
      if (!senderId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { recipientId, content, matchId } = req.body;

      // Validate input
      if (!recipientId || !content || !matchId) {
        res.status(400).json({ error: 'Recipient ID, content, and match ID are required' });
        return;
      }

      if (content.trim().length === 0) {
        res.status(400).json({ error: 'Message content cannot be empty' });
        return;
      }

      if (content.length > 5000) {
        res.status(400).json({ error: 'Message content too long (max 5000 characters)' });
        return;
      }

      const message = await MessageService.sendMessage({
        senderId,
        recipientId,
        content: content.trim(),
        matchId,
      });

      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      logger.error('Error sending message:', error);
      
      if (error instanceof Error && error.message.includes('not matched')) {
        res.status(403).json({ 
          error: 'Cannot send message',
          message: error.message
        });
        return;
      }

      res.status(500).json({ 
        error: 'Failed to send message',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get messages for a match
   */
  static async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { matchId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!matchId) {
        res.status(400).json({ error: 'Match ID is required' });
        return;
      }

      if (page < 1) {
        res.status(400).json({ error: 'Page must be greater than 0' });
        return;
      }

      if (limit < 1 || limit > 100) {
        res.status(400).json({ error: 'Limit must be between 1 and 100' });
        return;
      }

      const result = await MessageService.getMessages(matchId, userId, {
        page,
        limit,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      res.json({
        success: true,
        data: result.messages,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error getting messages:', error);
      
      if (error instanceof Error && error.message.includes('not authorized')) {
        res.status(403).json({ 
          error: 'Access denied',
          message: error.message
        });
        return;
      }

      res.status(500).json({ 
        error: 'Failed to get messages',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Mark message as read
   */
  static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { messageId } = req.params;

      if (!messageId) {
        res.status(400).json({ error: 'Message ID is required' });
        return;
      }

      await MessageService.markMessageAsRead(messageId, userId);

      res.json({
        success: true,
        message: 'Message marked as read',
      });
    } catch (error) {
      logger.error('Error marking message as read:', error);
      res.status(500).json({ 
        error: 'Failed to mark message as read',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Mark all messages in a conversation as read
   */
  static async markConversationAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { matchId } = req.params;

      if (!matchId) {
        res.status(400).json({ error: 'Match ID is required' });
        return;
      }

      await MessageService.markConversationAsRead(matchId, userId);

      res.json({
        success: true,
        message: 'Conversation marked as read',
      });
    } catch (error) {
      logger.error('Error marking conversation as read:', error);
      res.status(500).json({ 
        error: 'Failed to mark conversation as read',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get unread message count
   */
  static async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const count = await MessageService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      logger.error('Error getting unread count:', error);
      res.status(500).json({ 
        error: 'Failed to get unread count',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Search messages
   */
  static async searchMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const searchTerm = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!searchTerm || searchTerm.trim().length < 2) {
        res.status(400).json({ error: 'Search term must be at least 2 characters' });
        return;
      }

      const result = await MessageService.searchMessages(userId, searchTerm.trim(), {
        page,
        limit,
      });

      res.json({
        success: true,
        data: result.messages,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error searching messages:', error);
      res.status(500).json({ 
        error: 'Failed to search messages',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete a message
   */
  static async deleteMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { messageId } = req.params;

      if (!messageId) {
        res.status(400).json({ error: 'Message ID is required' });
        return;
      }

      await MessageService.deleteMessage(messageId, userId);

      res.json({
        success: true,
        message: 'Message deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting message:', error);
      
      if (error instanceof Error && error.message.includes('not authorized')) {
        res.status(403).json({ 
          error: 'Not authorized to delete this message',
          message: error.message
        });
        return;
      }

      res.status(500).json({ 
        error: 'Failed to delete message',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get conversation list
   */
  static async getConversations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const conversations = await MessageService.getConversations(userId);

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      logger.error('Error getting conversations:', error);
      res.status(500).json({ 
        error: 'Failed to get conversations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}