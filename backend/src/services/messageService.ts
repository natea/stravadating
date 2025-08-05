import { prisma } from '../config/database';
import { Server as SocketServer } from 'socket.io';

export interface SendMessageInput {
  senderId: string;
  recipientId: string;
  content: string;
  matchId: string;
}

export interface MessageFilter {
  matchId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export class MessageService {
  private static io: SocketServer | null = null;

  /**
   * Initialize Socket.io server
   */
  static initializeSocket(io: SocketServer) {
    this.io = io;
    this.setupSocketHandlers();
  }

  /**
   * Setup socket event handlers
   */
  private static setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log('User connected:', socket.id);

      // Join user to their personal room
      socket.on('join-user-room', (userId: string) => {
        socket.join(`user-${userId}`);
        console.log(`User ${userId} joined their room`);
      });

      // Join match conversation room
      socket.on('join-match-room', (matchId: string) => {
        socket.join(`match-${matchId}`);
        console.log(`Socket joined match room: ${matchId}`);
      });

      // Handle typing indicators
      socket.on('typing-start', (data: { matchId: string; userId: string }) => {
        socket.to(`match-${data.matchId}`).emit('user-typing', {
          userId: data.userId,
          isTyping: true,
        });
      });

      socket.on('typing-stop', (data: { matchId: string; userId: string }) => {
        socket.to(`match-${data.matchId}`).emit('user-typing', {
          userId: data.userId,
          isTyping: false,
        });
      });

      // Handle message read receipts
      socket.on('mark-as-read', async (data: { messageId: string; userId: string }) => {
        await this.markMessageAsRead(data.messageId, data.userId);
      });

      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
      });
    });
  }

  /**
   * Send a message
   */
  static async sendMessage(input: SendMessageInput): Promise<any> {
    // Verify users are matched
    const match = await prisma.match.findFirst({
      where: {
        id: input.matchId,
        OR: [
          { user1Id: input.senderId, user2Id: input.recipientId },
          { user1Id: input.recipientId, user2Id: input.senderId },
        ],
        status: 'active',
      },
    });

    if (!match) {
      throw new Error('Users are not matched or match is not active');
    }

    // Create message in database
    const message = await prisma.message.create({
      data: {
        senderId: input.senderId,
        matchId: input.matchId,
        content: input.content,
        isRead: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photos: true,
          },
        },
      },
    });

    // Emit real-time event
    if (this.io) {
      // Send to recipient
      this.io.to(`user-${input.recipientId}`).emit('new-message', message);

      // Send to match room (for active conversations)
      this.io.to(`match-${input.matchId}`).emit('message-sent', message);
    }

    // Note: Match doesn't have updatedAt field in current schema

    return message;
  }

  /**
   * Get messages for a match with pagination
   */
  static async getMessages(
    matchId: string,
    userId: string,
    options: PaginationOptions
  ): Promise<{
    messages: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    // Verify user is part of this match
    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
    });

    if (!match) {
      throw new Error('Match not found or user not authorized');
    }

    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    // Get total count
    const total = await prisma.message.count({
      where: { matchId },
    });

    // Get messages
    const messages = await prisma.message.findMany({
      where: { matchId },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photos: true,
          },
        },
      },
      orderBy: { sentAt: sortOrder },
      skip,
      take: limit,
    });

    return {
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark message as read
   */
  static async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
      },
    });

    if (!message) {
      throw new Error('Message not found or user not authorized');
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
    });

    // Emit read receipt
    if (this.io) {
      this.io.to(`user-${message.senderId}`).emit('message-read', {
        messageId,
        readBy: userId,
        readAt: new Date(),
      });
    }
  }

  /**
   * Mark all messages in a conversation as read
   */
  static async markConversationAsRead(matchId: string, userId: string): Promise<void> {
    await prisma.message.updateMany({
      where: {
        matchId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    // Emit bulk read receipt
    if (this.io) {
      this.io.to(`match-${matchId}`).emit('conversation-read', {
        matchId,
        readBy: userId,
        readAt: new Date(),
      });
    }
  }

  /**
   * Get unread message count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    // Get all matches for the user
    const userMatches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        status: 'active',
      },
      select: { id: true },
    });

    const matchIds = userMatches.map(m => m.id);
    
    return await prisma.message.count({
      where: {
        matchId: { in: matchIds },
        senderId: { not: userId },
        isRead: false,
      },
    });
  }

  /**
   * Search messages
   */
  static async searchMessages(
    userId: string,
    searchTerm: string,
    options: PaginationOptions
  ): Promise<any> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    // Get all matches for the user
    const userMatches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        status: 'active',
      },
      select: { id: true },
    });

    const matchIds = userMatches.map(m => m.id);

    // Search messages (note: searching encrypted content requires special handling)
    // For now, we'll search in sender names and return recent messages
    const messages = await prisma.message.findMany({
      where: {
        matchId: { in: matchIds },
        OR: [
          {
            sender: {
              OR: [
                { firstName: { contains: searchTerm, mode: 'insensitive' } },
                { lastName: { contains: searchTerm, mode: 'insensitive' } },
              ],
            },
          },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photos: true,
          },
        },
        match: true,
      },
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
    });

    // Filter by content after getting messages
    const filteredMessages = messages.filter(msg =>
      msg.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return {
      messages: filteredMessages,
      pagination: {
        page,
        limit,
        total: filteredMessages.length,
      },
    };
  }

  /**
   * Delete a message (soft delete)
   */
  static async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: userId,
      },
    });

    if (!message) {
      throw new Error('Message not found or user not authorized to delete');
    }

    // Soft delete by updating content
    await prisma.message.update({
      where: { id: messageId },
      data: {
        content: '[Message deleted]',
      },
    });

    // Emit deletion event
    if (this.io) {
      this.io.to(`match-${message.matchId}`).emit('message-deleted', {
        messageId,
        deletedBy: userId,
      });
    }
  }

  /**
   * Get conversation list for a user
   */
  static async getConversations(userId: string): Promise<any[]> {
    // Get all active matches
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        status: 'active',
      },
      include: {
        user1: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photos: true,
          },
        },
        user2: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photos: true,
          },
        },
      },
    });

    // Get last message and unread count for each match
    const conversationsWithDetails = await Promise.all(
      matches.map(async (match) => {
        const otherUser = match.user1Id === userId ? match.user2 : match.user1;
        
        // Get last message
        const lastMessage = await prisma.message.findFirst({
          where: { matchId: match.id },
          orderBy: { sentAt: 'desc' },
          include: {
            sender: {
              select: { id: true, firstName: true },
            },
          },
        });

        // Get unread count
        const unreadCount = await prisma.message.count({
          where: {
            matchId: match.id,
            senderId: { not: userId },
            isRead: false,
          },
        });

        let lastMessageContent = null;
        if (lastMessage) {
          lastMessageContent = lastMessage.content;
        }

        return {
          matchId: match.id,
          otherUser,
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            content: lastMessageContent,
            senderId: lastMessage.senderId,
            senderName: lastMessage.sender.firstName,
            createdAt: lastMessage.sentAt,
          } : null,
          unreadCount,
          matchedAt: match.matchedAt,
        };
      })
    );

    // Sort by last message time or match time
    return conversationsWithDetails.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || a.matchedAt;
      const bTime = b.lastMessage?.createdAt || b.matchedAt;
      return bTime.getTime() - aTime.getTime();
    });
  }
}