import { MessageService } from '../../services/messageService';
import { MessageModel } from '../../models/Message';
import { prisma } from '../../config/database';
import { Server as SocketServer } from 'socket.io';

// Mock dependencies
jest.mock('../../models/Message');
jest.mock('../../config/database', () => ({
  prisma: {
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    match: {
      findUnique: jest.fn(),
    },
  },
}));

const mockMessageModel = MessageModel as jest.Mocked<typeof MessageModel>;
const mockPrisma = prisma as any;

// Mock crypto for consistent tests
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: () => 'mock-encryption-key-12345678901234567890',
  })),
  createCipher: jest.fn(),
  createDecipher: jest.fn(),
  scryptSync: jest.fn(() => Buffer.from('mock-key-32-bytes-long-for-aes256')),
  randomBytes: jest.fn(() => Buffer.from('mock-iv-12-bytes-long')),
}));

describe('MessageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset static properties
    (MessageService as any).io = null;
  });

  describe('initializeSocket', () => {
    it('should initialize socket server and setup handlers', () => {
      const mockIo = {
        on: jest.fn(),
      } as unknown as SocketServer;

      MessageService.initializeSocket(mockIo);

      expect((MessageService as any).io).toBe(mockIo);
      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('sendMessage', () => {
    const mockMessageInput = {
      senderId: 'user1',
      recipientId: 'user2',
      content: 'Hello, how are you?',
      matchId: 'match123',
    };

    it('should send message successfully', async () => {
      const mockMessage = {
        id: 'msg123',
        senderId: 'user1',
        recipientId: 'user2',
        content: 'Hello, how are you?',
        matchId: 'match123',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMatch = {
        id: 'match123',
        user1Id: 'user1',
        user2Id: 'user2',
        status: 'active',
      };

      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      mockMessageModel.create.mockResolvedValue(mockMessage);

      const result = await MessageService.sendMessage(mockMessageInput);

      expect(mockPrisma.match.findUnique).toHaveBeenCalledWith({
        where: { id: 'match123' },
      });
      expect(mockMessageModel.create).toHaveBeenCalledWith({
        senderId: 'user1',
        recipientId: 'user2',
        content: expect.any(String), // encrypted content
        matchId: 'match123',
        metadata: expect.any(Object),
      });
      expect(result).toEqual(expect.objectContaining({
        id: 'msg123',
        senderId: 'user1',
        recipientId: 'user2',
        matchId: 'match123',
      }));
    });

    it('should throw error when match is not found', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(null);

      await expect(MessageService.sendMessage(mockMessageInput)).rejects.toThrow(
        'Match not found or invalid'
      );
    });

    it('should throw error when user is not part of match', async () => {
      const mockMatch = {
        id: 'match123',
        user1Id: 'user3', // Different user
        user2Id: 'user4', // Different user
        status: 'active',
      };

      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);

      await expect(MessageService.sendMessage(mockMessageInput)).rejects.toThrow(
        'User is not part of this match'
      );
    });

    it('should throw error when match is not active', async () => {
      const mockMatch = {
        id: 'match123',
        user1Id: 'user1',
        user2Id: 'user2',
        status: 'archived',
      };

      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);

      await expect(MessageService.sendMessage(mockMessageInput)).rejects.toThrow(
        'Cannot send messages to inactive match'
      );
    });
  });

  describe('getMessages', () => {
    it('should get messages with pagination', async () => {
      const mockMessages = [
        {
          id: 'msg1',
          senderId: 'user1',
          recipientId: 'user2',
          content: 'encrypted_content_1',
          matchId: 'match123',
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'msg2',
          senderId: 'user2',
          recipientId: 'user1',
          content: 'encrypted_content_2',
          matchId: 'match123',
          isRead: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockMessageModel.findMany.mockResolvedValue(mockMessages);
      mockMessageModel.count.mockResolvedValue(2);

      const filter = { matchId: 'match123' };
      const pagination = { page: 1, limit: 10 };

      const result = await MessageService.getMessages(filter, pagination);

      expect(mockMessageModel.findMany).toHaveBeenCalledWith({
        where: { matchId: 'match123' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photos: true,
            },
          },
          recipient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photos: true,
            },
          },
        },
      });

      expect(result).toEqual({
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: 'msg1',
            content: expect.any(String), // decrypted content
          }),
        ]),
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
    });

    it('should filter messages by user ID', async () => {
      const filter = { userId: 'user1' };
      const pagination = { page: 1, limit: 10 };

      mockMessageModel.findMany.mockResolvedValue([]);
      mockMessageModel.count.mockResolvedValue(0);

      await MessageService.getMessages(filter, pagination);

      expect(mockMessageModel.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { senderId: 'user1' },
            { recipientId: 'user1' },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
        include: expect.any(Object),
      });
    });

    it('should filter messages by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const filter = { startDate, endDate };
      const pagination = { page: 1, limit: 10 };

      mockMessageModel.findMany.mockResolvedValue([]);
      mockMessageModel.count.mockResolvedValue(0);

      await MessageService.getMessages(filter, pagination);

      expect(mockMessageModel.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
        include: expect.any(Object),
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark message as read successfully', async () => {
      const mockMessage = {
        id: 'msg123',
        senderId: 'user1',
        recipientId: 'user2',
        content: 'encrypted_content',
        matchId: 'match123',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdatedMessage = { ...mockMessage, isRead: true };

      mockMessageModel.findById.mockResolvedValue(mockMessage);
      mockMessageModel.update.mockResolvedValue(mockUpdatedMessage);

      const result = await MessageService.markAsRead('msg123', 'user2');

      expect(mockMessageModel.findById).toHaveBeenCalledWith('msg123');
      expect(mockMessageModel.update).toHaveBeenCalledWith('msg123', { isRead: true });
      expect(result).toEqual(expect.objectContaining({
        id: 'msg123',
        isRead: true,
      }));
    });

    it('should throw error when message is not found', async () => {
      mockMessageModel.findById.mockResolvedValue(null);

      await expect(MessageService.markAsRead('msg123', 'user2')).rejects.toThrow(
        'Message not found'
      );
    });

    it('should throw error when user is not the recipient', async () => {
      const mockMessage = {
        id: 'msg123',
        senderId: 'user1',
        recipientId: 'user2',
        content: 'encrypted_content',
        matchId: 'match123',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockMessageModel.findById.mockResolvedValue(mockMessage);

      await expect(MessageService.markAsRead('msg123', 'user3')).rejects.toThrow(
        'Only recipient can mark message as read'
      );
    });

    it('should not update if message is already read', async () => {
      const mockMessage = {
        id: 'msg123',
        senderId: 'user1',
        recipientId: 'user2',
        content: 'encrypted_content',
        matchId: 'match123',
        isRead: true, // Already read
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockMessageModel.findById.mockResolvedValue(mockMessage);

      const result = await MessageService.markAsRead('msg123', 'user2');

      expect(mockMessageModel.update).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        id: 'msg123',
        isRead: true,
      }));
    });
  });

  describe('deleteMessage', () => {
    it('should delete message successfully', async () => {
      const mockMessage = {
        id: 'msg123',
        senderId: 'user1',
        recipientId: 'user2',
        content: 'encrypted_content',
        matchId: 'match123',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockMessageModel.findById.mockResolvedValue(mockMessage);
      mockMessageModel.delete.mockResolvedValue(true);

      const result = await MessageService.deleteMessage('msg123', 'user1');

      expect(mockMessageModel.findById).toHaveBeenCalledWith('msg123');
      expect(mockMessageModel.delete).toHaveBeenCalledWith('msg123');
      expect(result).toBe(true);
    });

    it('should throw error when message is not found', async () => {
      mockMessageModel.findById.mockResolvedValue(null);

      await expect(MessageService.deleteMessage('msg123', 'user1')).rejects.toThrow(
        'Message not found'
      );
    });

    it('should throw error when user is not the sender', async () => {
      const mockMessage = {
        id: 'msg123',
        senderId: 'user1',
        recipientId: 'user2',
        content: 'encrypted_content',
        matchId: 'match123',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockMessageModel.findById.mockResolvedValue(mockMessage);

      await expect(MessageService.deleteMessage('msg123', 'user3')).rejects.toThrow(
        'Only sender can delete message'
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread message count for user', async () => {
      mockMessageModel.count.mockResolvedValue(5);

      const result = await MessageService.getUnreadCount('user1');

      expect(mockMessageModel.count).toHaveBeenCalledWith({
        where: {
          recipientId: 'user1',
          isRead: false,
        },
      });
      expect(result).toBe(5);
    });

    it('should return unread count for specific match', async () => {
      mockMessageModel.count.mockResolvedValue(3);

      const result = await MessageService.getUnreadCount('user1', 'match123');

      expect(mockMessageModel.count).toHaveBeenCalledWith({
        where: {
          recipientId: 'user1',
          matchId: 'match123',
          isRead: false,
        },
      });
      expect(result).toBe(3);
    });
  });

  describe('getConversationPreview', () => {
    it('should return conversation previews for user', async () => {
      const mockPreviews = [
        {
          matchId: 'match123',
          otherUserId: 'user2',
          otherUser: {
            id: 'user2',
            firstName: 'Jane',
            lastName: 'Doe',
            photos: ['photo1.jpg'],
          },
          lastMessage: {
            id: 'msg123',
            content: 'encrypted_content',
            senderId: 'user2',
            createdAt: new Date(),
            isRead: false,
          },
          unreadCount: 2,
        },
      ];

      // Mock the complex query
      mockPrisma.message.findMany.mockResolvedValue([
        {
          id: 'msg123',
          matchId: 'match123',
          senderId: 'user2',
          recipientId: 'user1',
          content: 'encrypted_content',
          isRead: false,
          createdAt: new Date(),
          match: {
            id: 'match123',
            user1Id: 'user1',
            user2Id: 'user2',
            user1: {
              id: 'user1',
              firstName: 'John',
              lastName: 'Smith',
              photos: ['photo2.jpg'],
            },
            user2: {
              id: 'user2',
              firstName: 'Jane',
              lastName: 'Doe',
              photos: ['photo1.jpg'],
            },
          },
        },
      ]);

      const result = await MessageService.getConversationPreview('user1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({
        matchId: 'match123',
        otherUserId: 'user2',
        lastMessage: expect.objectContaining({
          content: expect.any(String), // decrypted
        }),
      }));
    });
  });

  describe('encryption and decryption', () => {
    it('should encrypt and decrypt messages consistently', () => {
      const originalMessage = 'This is a secret message';
      
      const encrypted = (MessageService as any).encryptMessage(originalMessage);
      const decrypted = (MessageService as any).decryptMessage(encrypted);

      expect(encrypted).not.toBe(originalMessage);
      expect(decrypted).toBe(originalMessage);
    });

    it('should handle empty messages', () => {
      const encrypted = (MessageService as any).encryptMessage('');
      const decrypted = (MessageService as any).decryptMessage(encrypted);

      expect(decrypted).toBe('');
    });
  });

  describe('emitToUser', () => {
    it('should emit event to user if socket is connected', () => {
      const mockSocket = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      const mockIo = {
        to: jest.fn().mockReturnValue(mockSocket),
      } as unknown as SocketServer;

      (MessageService as any).io = mockIo;

      (MessageService as any).emitToUser('user1', 'newMessage', { messageId: 'msg123' });

      expect(mockIo.to).toHaveBeenCalledWith('user_user1');
      expect(mockSocket.emit).toHaveBeenCalledWith('newMessage', { messageId: 'msg123' });
    });

    it('should not emit if socket is not initialized', () => {
      (MessageService as any).io = null;

      // Should not throw error
      expect(() => {
        (MessageService as any).emitToUser('user1', 'newMessage', { messageId: 'msg123' });
      }).not.toThrow();
    });
  });
});