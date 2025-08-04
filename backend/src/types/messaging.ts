export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  sentAt: Date;
  isRead: boolean;
}

export interface CreateMessageInput {
  matchId: string;
  senderId: string;
  content: string;
}

export interface UpdateMessageInput {
  isRead?: boolean;
}

export interface MessageWithSender extends Message {
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    photos: string[];
  };
}