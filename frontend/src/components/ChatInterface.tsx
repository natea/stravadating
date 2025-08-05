import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message, Conversation } from '../types/api';
import MessageInput from './MessageInput';
import MessageList from './MessageList';
import ConversationList from './ConversationList';

interface ChatInterfaceProps {
  userId: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ userId }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState<{ [key: string]: boolean }>({});
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  useEffect(() => {
    // Initialize Socket.io connection
    const newSocket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000', {
      auth: {
        token: localStorage.getItem('authToken'),
      },
    });

    newSocket.on('connect', () => {
      console.log('Connected to chat server');
      newSocket.emit('join-user-room', userId);
    });

    newSocket.on('new-message', (message: Message) => {
      handleNewMessage(message);
    });

    newSocket.on('message-sent', (message: Message) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    });

    newSocket.on('user-typing', (data: { userId: string; isTyping: boolean }) => {
      setIsTyping(prev => ({
        ...prev,
        [data.userId]: data.isTyping,
      }));
    });

    newSocket.on('message-read', (data: { messageId: string; readBy: string; readAt: Date }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.messageId ? { ...msg, isRead: true, readAt: data.readAt } : msg
        )
      );
    });

    newSocket.on('message-deleted', (data: { messageId: string }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.messageId
            ? { ...msg, content: '[Message deleted]', isDeleted: true }
            : msg
        )
      );
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [userId]);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.matchId);
      if (socket) {
        socket.emit('join-match-room', selectedConversation.matchId);
      }
    }
  }, [selectedConversation, socket]);

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/messages/conversations', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setConversations(data.data);
        // Set unread counts
        const counts: { [key: string]: number } = {};
        data.data.forEach((conv: Conversation) => {
          counts[conv.matchId] = conv.unreadCount;
        });
        setUnreadCounts(counts);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadMessages = async (matchId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/messages/${matchId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setMessages(data.data.reverse()); // Reverse to show oldest first
        scrollToBottom();
        markConversationAsRead(matchId);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!selectedConversation || !content.trim()) return;

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          recipientId: selectedConversation.otherUser?.id || '',
          content: content.trim(),
          matchId: selectedConversation.matchId,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        console.error('Failed to send message:', data.error);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleNewMessage = (message: Message) => {
    // Update conversation list
    setConversations(prev => {
      const updated = [...prev];
      const convIndex = updated.findIndex(c => c.matchId === message.matchId);
      if (convIndex !== -1) {
        const conv = updated[convIndex];
        updated.splice(convIndex, 1);
        updated.unshift({
          ...conv,
          lastMessage: message,
          unreadCount: conv.unreadCount + 1,
        });
      }
      return updated;
    });

    // Update messages if in current conversation
    if (selectedConversation?.matchId === message.matchId) {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    } else {
      // Update unread count
      setUnreadCounts(prev => ({
        ...prev,
        [message.matchId]: (prev[message.matchId] || 0) + 1,
      }));
    }
  };

  const markConversationAsRead = async (matchId: string) => {
    try {
      await fetch(`/api/messages/conversation/${matchId}/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      setUnreadCounts(prev => ({
        ...prev,
        [matchId]: 0,
      }));
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (!socket || !selectedConversation) return;

    if (isTyping) {
      socket.emit('typing-start', {
        matchId: selectedConversation.matchId,
        userId,
      });

      // Clear existing timeout
      if (typingTimeoutRef.current[selectedConversation.matchId]) {
        clearTimeout(typingTimeoutRef.current[selectedConversation.matchId]);
      }

      // Set new timeout to stop typing after 3 seconds
      typingTimeoutRef.current[selectedConversation.matchId] = setTimeout(() => {
        socket.emit('typing-stop', {
          matchId: selectedConversation.matchId,
          userId,
        });
      }, 3000);
    } else {
      socket.emit('typing-stop', {
        matchId: selectedConversation.matchId,
        userId,
      });

      if (typingTimeoutRef.current[selectedConversation.matchId]) {
        clearTimeout(typingTimeoutRef.current[selectedConversation.matchId]);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      const data = await response.json();
      if (!data.success) {
        console.error('Failed to delete message:', data.error);
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Conversation List */}
      <div className="w-1/3 bg-white border-r">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">Messages</h2>
        </div>
        <ConversationList
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
          unreadCounts={unreadCounts}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white p-4 border-b flex items-center">
              <img
                src={selectedConversation.otherUser?.photos[0] || '/default-avatar.png'}
                alt={selectedConversation.otherUser?.firstName || 'User'}
                className="w-10 h-10 rounded-full mr-3"
              />
              <div>
                <h3 className="font-semibold">
                  {selectedConversation.otherUser?.firstName}{' '}
                  {selectedConversation.otherUser?.lastName}
                </h3>
                {selectedConversation.otherUser && isTyping[selectedConversation.otherUser.id] && (
                  <p className="text-sm text-gray-500">Typing...</p>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  <MessageList
                    messages={messages}
                    currentUserId={userId}
                    onDeleteMessage={deleteMessage}
                  />
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            <MessageInput onSendMessage={sendMessage} onTyping={handleTyping} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
