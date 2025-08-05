import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, FitnessStats } from '../types/api';

interface UserProfileProps {
  user: User;
  fitnessStats: FitnessStats;
  isCurrentUser?: boolean;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, fitnessStats, isCurrentUser = false }) => {
  const navigate = useNavigate();
  const formatDistance = (distance: number) => {
    return `${(distance / 1000).toFixed(1)} km`;
  };

  const formatPace = (pace: number | null) => {
    if (!pace) return 'N/A';
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Profile Header */}
      <div className="relative h-64 bg-gradient-to-br from-blue-500 to-purple-600">
        {user.photos && user.photos[0] && (
          <img
            src={user.photos[0]}
            alt={`${user.firstName} ${user.lastName}`}
            className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50"
          />
        )}
        <div className="absolute bottom-4 left-4 text-white">
          <h1 className="text-3xl font-bold">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-lg">
            {user.age} •{' '}
            {user.gender && `${user.gender.charAt(0).toUpperCase() + user.gender.slice(1)} • `}
            {user.city}, {user.state}
          </p>
        </div>
      </div>

      {/* Bio Section */}
      {user.bio && (
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold mb-2">About</h2>
          <p className="text-gray-700">{user.bio}</p>
        </div>
      )}

      {/* Fitness Statistics */}
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">Fitness Statistics</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{fitnessStats.weeklyActivities}</div>
            <div className="text-sm text-gray-600">Activities/Week</div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">
              {formatDistance(fitnessStats.weeklyDistance)}
            </div>
            <div className="text-sm text-gray-600">Weekly Distance</div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600">
              {formatPace(fitnessStats.averagePace)}
            </div>
            <div className="text-sm text-gray-600">Average Pace</div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-600">
              {formatDistance(fitnessStats.totalDistance)}
            </div>
            <div className="text-sm text-gray-600">Total Distance</div>
          </div>
        </div>

        {/* Favorite Activities */}
        {fitnessStats.favoriteActivities && fitnessStats.favoriteActivities.length > 0 && (
          <div className="mt-6">
            <h3 className="text-md font-semibold mb-2">Favorite Activities</h3>
            <div className="flex flex-wrap gap-2">
              {fitnessStats.favoriteActivities.map((activity, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                >
                  {activity}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Photos Gallery */}
        {user.photos && user.photos.length > 1 && (
          <div className="mt-6">
            <h3 className="text-md font-semibold mb-2">Photos</h3>
            <div className="grid grid-cols-3 gap-2">
              {user.photos.slice(1).map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt={`${user.firstName} ${index + 2}`}
                  className="w-full h-32 object-cover rounded-lg"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Button (for current user) */}
      {isCurrentUser && (
        <div className="p-6 border-t">
          <button
            onClick={() => navigate('/profile/edit')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
          >
            Edit Profile
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
