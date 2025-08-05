import React from 'react';
import { Message } from '../types/api';
import { format, isToday, isYesterday } from 'date-fns';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  onDeleteMessage: (messageId: string) => void;
}

const MessageList: React.FC<MessageListProps> = ({ messages, currentUserId, onDeleteMessage }) => {
  const formatMessageTime = (date: Date) => {
    const messageDate = new Date(date);

    if (isToday(messageDate)) {
      return format(messageDate, 'h:mm a');
    } else if (isYesterday(messageDate)) {
      return `Yesterday ${format(messageDate, 'h:mm a')}`;
    } else {
      return format(messageDate, 'MMM d, h:mm a');
    }
  };

  const renderDateSeparator = (date: Date) => {
    const messageDate = new Date(date);
    let dateText = '';

    if (isToday(messageDate)) {
      dateText = 'Today';
    } else if (isYesterday(messageDate)) {
      dateText = 'Yesterday';
    } else {
      dateText = format(messageDate, 'MMMM d, yyyy');
    }

    return (
      <div className="flex items-center my-4">
        <div className="flex-1 border-t border-gray-300"></div>
        <span className="px-3 text-xs text-gray-500 bg-gray-100">{dateText}</span>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>
    );
  };

  let lastDate: string | null = null;

  return (
    <div className="space-y-2">
      {messages.map((message, _index) => {
        const messageDate = new Date(message.sentAt);
        const dateKey = format(messageDate, 'yyyy-MM-dd');
        const showDateSeparator = dateKey !== lastDate;
        lastDate = dateKey;

        const isSender = message.senderId === currentUserId;

        return (
          <React.Fragment key={message.id}>
            {showDateSeparator && renderDateSeparator(messageDate)}

            <div className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  isSender ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
                }`}
              >
                {/* Message Content */}
                <p className="break-words">{message.content}</p>

                {/* Message Meta */}
                <div
                  className={`flex items-center gap-2 mt-1 text-xs ${
                    isSender ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  <span>{formatMessageTime(messageDate)}</span>

                  {isSender && (
                    <>
                      {message.isRead && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}

                      <button
                        onClick={() => onDeleteMessage(message.id)}
                        className="hover:text-red-300 ml-2"
                        title="Delete message"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default MessageList;
