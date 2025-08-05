import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PotentialMatch } from '../types/api';
import UserCard from './UserCard';
import { matchingService } from '../services/matchingService';

const MatchingInterface: React.FC = () => {
  const [potentialMatches, setPotentialMatches] = useState<PotentialMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    loadPotentialMatches();
  }, []);

  const loadPotentialMatches = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const matches = await matchingService.getPotentialMatches();
      setPotentialMatches(matches);
    } catch (err) {
      setError('Failed to load potential matches');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (currentIndex >= potentialMatches.length) return;

    const currentMatch = potentialMatches[currentIndex];
    setSwipeDirection(direction);

    if (direction === 'right') {
      try {
        await matchingService.createMatch(currentMatch.userId, currentMatch.compatibilityScore);
      } catch (err) {
        console.error('Failed to create match:', err);
      }
    }

    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setSwipeDirection(null);

      // Load more matches when running low
      if (currentIndex === potentialMatches.length - 3) {
        loadMoreMatches();
      }
    }, 300);
  };

  const loadMoreMatches = async () => {
    try {
      const newMatches = await matchingService.getPotentialMatches(20, potentialMatches.length);
      setPotentialMatches(prev => [...prev, ...newMatches]);
    } catch (err) {
      console.error('Failed to load more matches:', err);
    }
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number; y: number } }
  ) => {
    const swipeThreshold = 100;
    if (info.offset.x > swipeThreshold) {
      handleSwipe('right');
    } else if (info.offset.x < -swipeThreshold) {
      handleSwipe('left');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={loadPotentialMatches}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (currentIndex >= potentialMatches.length) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h2 className="text-2xl font-bold mb-4">No more matches!</h2>
        <p className="text-gray-600 mb-6">Check back later for new potential matches</p>
        <button
          onClick={() => {
            setCurrentIndex(0);
            loadPotentialMatches();
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Refresh Matches
        </button>
      </div>
    );
  }

  const currentMatch = potentialMatches[currentIndex];

  return (
    <div className="relative h-screen bg-gray-100 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {currentMatch && (
            <motion.div
              key={currentMatch.userId}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={handleDragEnd}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                rotate: swipeDirection === 'right' ? 10 : swipeDirection === 'left' ? -10 : 0,
                x: swipeDirection === 'right' ? 300 : swipeDirection === 'left' ? -300 : 0,
              }}
              exit={{
                opacity: 0,
                x: swipeDirection === 'right' ? 500 : -500,
                transition: { duration: 0.3 },
              }}
              className="w-full max-w-md cursor-grab active:cursor-grabbing"
            >
              <UserCard match={currentMatch} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
          <button
            onClick={() => handleSwipe('left')}
            className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
            aria-label="Pass"
          >
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <button
            onClick={() => handleSwipe('right')}
            className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
            aria-label="Like"
          >
            <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
        </div>

        {/* Match Queue Preview */}
        <div className="absolute top-4 right-4 flex gap-2">
          {potentialMatches.slice(currentIndex + 1, currentIndex + 4).map((match, index) => (
            <div
              key={match.userId}
              className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm"
              style={{ opacity: 1 - index * 0.3 }}
            >
              {match.user.photos[0] && (
                <img
                  src={match.user.photos[0]}
                  alt="Next match"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MatchingInterface;
