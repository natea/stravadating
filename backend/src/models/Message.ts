import { prisma } from '../config/database';
import { Message, CreateMessageInput, UpdateMessageInput, MessageWithSender, PaginationOptions, PaginatedResponse } from '../types';

export class MessageModel {
  /**
   * Create a new message
   */
  static async create(data: CreateMessageInput): Promise<Message> {
    return await prisma.message.create({
      data,
    });
  }

  /**
   * Find message by ID
   */
  static async findById(id: string): Promise<Message | null> {
    return await prisma.message.findUnique({
      where: { id },
    });
  }

  /**
   * Find messages by match ID with pagination
   */
  static async findByMatchId(
    matchId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<MessageWithSender> | MessageWithSender[]> {
    if (options) {
      const { page, limit } = options;
      const skip = (page - 1) * limit;

      const [messages, total] = await Promise.all([
        prisma.message.findMany({
          where: { matchId },
          skip,
          take: limit,
          orderBy: { sentAt: 'desc' },
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
        }),
        prisma.message.count({
          where: { matchId },
        }),
      ]);

      return {
        data: messages as MessageWithSender[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    return await prisma.message.findMany({
      where: { matchId },
      orderBy: { sentAt: 'asc' },
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
    }) as MessageWithSender[];
  }

  /**
   * Update message
   */
  static async update(id: string, data: UpdateMessageInput): Promise<Message> {
    return await prisma.message.update({
      where: { id },
      data,
    });
  }

  /**
   * Mark message as read
   */
  static async markAsRead(id: string): Promise<Message> {
    return await prisma.message.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Mark all messages in a match as read for a user
   */
  static async markAllAsReadForMatch(matchId: string, userId: string): Promise<number> {
    const result = await prisma.message.updateMany({
      where: {
        matchId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });
    return result.count;
  }

  /**
   * Delete message
   */
  static async delete(id: string): Promise<void> {
    await prisma.message.delete({
      where: { id },
    });
  }

  /**
   * Get unread message count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return await prisma.message.count({
      where: {
        match: {
          OR: [
            { user1Id: userId },
            { user2Id: userId },
          ],
        },
        senderId: { not: userId },
        isRead: false,
      },
    });
  }

  /**
   * Get unread message count for a specific match
   */
  static async getUnreadCountForMatch(matchId: string, userId: string): Promise<number> {
    return await prisma.message.count({
      where: {
        matchId,
        senderId: { not: userId },
        isRead: false,
      },
    });
  }

  /**
   * Get latest message for each match for a user
   */
  static async getLatestMessagesForUser(userId: string): Promise<MessageWithSender[]> {
    // Get all matches for the user
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
        status: 'active',
      },
      select: { id: true },
    });

    const matchIds = matches.map(match => match.id);

    if (matchIds.length === 0) {
      return [];
    }

    // Get the latest message for each match
    const latestMessages = await prisma.$queryRaw<MessageWithSender[]>`
      SELECT DISTINCT ON (match_id) 
        m.id, m.match_id as "matchId", m.sender_id as "senderId", 
        m.content, m.sent_at as "sentAt", m.is_read as "isRead",
        json_build_object(
          'id', u.id,
          'firstName', u.first_name,
          'lastName', u.last_name,
          'photos', u.photos
        ) as sender
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.match_id = ANY(${matchIds})
      ORDER BY m.match_id, m.sent_at DESC
    `;

    return latestMessages;
  }

  /**
   * Search messages in a match
   */
  static async searchInMatch(
    matchId: string,
    searchTerm: string,
    options?: PaginationOptions
  ): Promise<PaginatedResponse<MessageWithSender> | MessageWithSender[]> {
    const whereClause = {
      matchId,
      content: {
        contains: searchTerm,
        mode: 'insensitive' as const,
      },
    };

    if (options) {
      const { page, limit } = options;
      const skip = (page - 1) * limit;

      const [messages, total] = await Promise.all([
        prisma.message.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { sentAt: 'desc' },
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
        }),
        prisma.message.count({
          where: whereClause,
        }),
      ]);

      return {
        data: messages as MessageWithSender[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    return await prisma.message.findMany({
      where: whereClause,
      orderBy: { sentAt: 'desc' },
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
  }

  /**
   * Delete all messages for a match
   */
  static async deleteAllForMatch(matchId: string): Promise<number> {
    const result = await prisma.message.deleteMany({
      where: { matchId },
    });
    return result.count;
  }
}