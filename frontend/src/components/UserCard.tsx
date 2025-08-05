import React, { useState } from 'react';
import { PotentialMatch } from '../types/api';

interface UserCardProps {
  match: PotentialMatch;
}

const UserCard: React.FC<UserCardProps> = ({ match }) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const { user, compatibilityScore, compatibilityFactors, fitnessStats } = match;

  const nextPhoto = () => {
    if (user.photos.length > 1) {
      setCurrentPhotoIndex(prev => (prev + 1) % user.photos.length);
    }
  };

  const prevPhoto = () => {
    if (user.photos.length > 1) {
      setCurrentPhotoIndex(prev => (prev === 0 ? user.photos.length - 1 : prev - 1));
    }
  };

  const formatDistance = (distance: number) => {
    return `${(distance / 1000).toFixed(1)} km`;
  };

  // Removed unused formatPace function - pace formatting is handled elsewhere

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Photo Section */}
      <div className="relative h-96">
        {user.photos.length > 0 ? (
          <>
            <img
              src={user.photos[currentPhotoIndex]}
              alt={`${user.firstName} ${user.lastName}`}
              className="w-full h-full object-cover"
            />

            {/* Photo Navigation */}
            {user.photos.length > 1 && (
              <>
                <button
                  onClick={prevPhoto}
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 rounded-full p-2 hover:bg-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <button
                  onClick={nextPhoto}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 rounded-full p-2 hover:bg-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>

                {/* Photo Indicators */}
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                  {user.photos.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full ${
                        index === currentPhotoIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
            <div className="text-white text-6xl font-bold">
              {user.firstName[0]}
              {user.lastName[0]}
            </div>
          </div>
        )}

        {/* Compatibility Badge */}
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1">
          <span className="text-sm font-semibold text-green-600">{compatibilityScore}% Match</span>
        </div>
      </div>

      {/* User Info */}
      <div className="p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">
            {user.firstName}, {user.age}
          </h2>
          <p className="text-gray-600">
            {user.city}, {user.state}
          </p>
        </div>

        {/* Bio */}
        {user.bio && <p className="text-gray-700 mb-4 line-clamp-3">{user.bio}</p>}

        {/* Fitness Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-lg font-semibold text-blue-600">
              {fitnessStats.weeklyActivities}
            </div>
            <div className="text-xs text-gray-600">Activities/Week</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-lg font-semibold text-green-600">
              {formatDistance(fitnessStats.weeklyDistance)}
            </div>
            <div className="text-xs text-gray-600">Weekly Distance</div>
          </div>
        </div>

        {/* Favorite Activities */}
        {fitnessStats.favoriteActivities && fitnessStats.favoriteActivities.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {fitnessStats.favoriteActivities.slice(0, 3).map((activity, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
                >
                  {activity}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Compatibility Factors */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold mb-2 text-gray-700">Compatibility Factors</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Activity Overlap</span>
              <div className="flex items-center">
                <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{
                      width: `${compatibilityFactors.activityOverlap}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-medium">{compatibilityFactors.activityOverlap}%</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Performance</span>
              <div className="flex items-center">
                <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${compatibilityFactors.performanceSimilarity}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-medium">
                  {compatibilityFactors.performanceSimilarity}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserCard;
