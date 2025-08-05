import React from 'react';
import { Conversation } from '../types/api';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  unreadCounts: { [key: string]: number };
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversation,
  onSelectConversation,
  unreadCounts,
}) => {
  const formatLastMessageTime = (date: Date | string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const truncateMessage = (message: string, maxLength: number = 50) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  return (
    <div className="overflow-y-auto">
      {conversations.length === 0 ? (
        <div className="p-4 text-center text-gray-500">No conversations yet</div>
      ) : (
        conversations.map(conversation => {
          const unreadCount = unreadCounts[conversation.matchId] || 0;
          const isSelected = selectedConversation?.matchId === conversation.matchId;

          return (
            <div
              key={conversation.matchId}
              onClick={() => onSelectConversation(conversation)}
              className={`flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b transition-colors ${
                isSelected ? 'bg-blue-50' : ''
              }`}
            >
              {/* Avatar */}
              <div className="relative mr-3">
                <img
                  src={conversation.otherUser?.photos[0] || '/default-avatar.png'}
                  alt={conversation.otherUser?.firstName || 'User'}
                  className="w-12 h-12 rounded-full object-cover"
                />
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </div>

              {/* Conversation Details */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h4 className="font-semibold text-gray-900 truncate">
                    {conversation.otherUser?.firstName} {conversation.otherUser?.lastName}
                  </h4>
                  {conversation.lastMessage && (
                    <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                      {formatLastMessageTime(conversation.lastMessage.sentAt)}
                    </span>
                  )}
                </div>

                {conversation.lastMessage ? (
                  <p
                    className={`text-sm truncate ${
                      unreadCount > 0 ? 'font-semibold text-gray-900' : 'text-gray-600'
                    }`}
                  >
                    {conversation.lastMessage.senderId === conversation.otherUser?.id
                      ? truncateMessage(conversation.lastMessage.content)
                      : `You: ${truncateMessage(conversation.lastMessage.content)}`}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 italic">Start a conversation</p>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default ConversationList;
