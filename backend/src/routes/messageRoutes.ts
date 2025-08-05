import { Router } from 'express';
import { MessageController } from '../controllers/messageController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all message routes
router.use(authenticateToken);

/**
 * @route GET /api/messages/conversations
 * @desc Get all conversations for the authenticated user
 * @access Private
 */
router.get('/conversations', MessageController.getConversations);

/**
 * @route GET /api/messages/unread-count
 * @desc Get unread message count for the authenticated user
 * @access Private
 */
router.get('/unread-count', MessageController.getUnreadCount);

/**
 * @route GET /api/messages/search
 * @desc Search messages
 * @access Private
 * @query q - Search term (min 2 characters)
 * @query page - Page number (default: 1)
 * @query limit - Results per page (default: 20, max: 100)
 */
router.get('/search', MessageController.searchMessages);

/**
 * @route GET /api/messages/:matchId
 * @desc Get messages for a specific match
 * @access Private
 * @param matchId - ID of the match
 * @query page - Page number (default: 1)
 * @query limit - Messages per page (default: 50, max: 100)
 */
router.get('/:matchId', MessageController.getMessages);

/**
 * @route POST /api/messages
 * @desc Send a new message
 * @access Private
 * @body recipientId - ID of the recipient
 * @body content - Message content (max 5000 characters)
 * @body matchId - ID of the match
 */
router.post('/', MessageController.sendMessage);

/**
 * @route PUT /api/messages/:messageId/read
 * @desc Mark a specific message as read
 * @access Private
 * @param messageId - ID of the message to mark as read
 */
router.put('/:messageId/read', MessageController.markAsRead);

/**
 * @route PUT /api/messages/conversation/:matchId/read
 * @desc Mark all messages in a conversation as read
 * @access Private
 * @param matchId - ID of the match/conversation
 */
router.put('/conversation/:matchId/read', MessageController.markConversationAsRead);

/**
 * @route DELETE /api/messages/:messageId
 * @desc Delete a message (soft delete)
 * @access Private
 * @param messageId - ID of the message to delete
 */
router.delete('/:messageId', MessageController.deleteMessage);

export default router;