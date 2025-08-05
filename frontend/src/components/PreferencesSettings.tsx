import React, { useState, useEffect } from 'react';
import { MatchingPreferences } from '../types/api';
import { matchingService } from '../services/matchingService';

const PreferencesSettings: React.FC = () => {
  const [preferences, setPreferences] = useState<MatchingPreferences>({
    id: '',
    userId: '',
    minAge: 18,
    maxAge: 100,
    maxDistance: 50,
    preferredActivities: [],
    minCompatibilityScore: 50,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const activityOptions = [
    'Run',
    'Ride',
    'Swim',
    'Hike',
    'Walk',
    'Workout',
    'Yoga',
    'CrossFit',
    'WeightTraining',
    'RockClimbing',
    'Rowing',
    'Kayaking',
    'Ski',
    'Snowboard',
  ];

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const data = await matchingService.getPreferences();
      setPreferences(data);
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveMessage(null);
      await matchingService.updatePreferences(preferences);
      setSaveMessage({
        type: 'success',
        text: 'Preferences saved successfully!',
      });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: 'Failed to save preferences. Please try again.',
      });
      console.error('Failed to save preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActivity = (activity: string) => {
    setPreferences(prev => ({
      ...prev,
      preferredActivities: prev.preferredActivities.includes(activity)
        ? prev.preferredActivities.filter(a => a !== activity)
        : [...prev.preferredActivities, activity],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Matching Preferences</h1>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`mb-4 p-3 rounded-lg ${
            saveMessage.type === 'success'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Age Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Age Range</label>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Min Age</label>
              <input
                type="number"
                min="18"
                max="100"
                value={preferences.minAge}
                onChange={e =>
                  setPreferences(prev => ({
                    ...prev,
                    minAge: Math.max(18, Math.min(100, parseInt(e.target.value) || 18)),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">Max Age</label>
              <input
                type="number"
                min="18"
                max="100"
                value={preferences.maxAge}
                onChange={e =>
                  setPreferences(prev => ({
                    ...prev,
                    maxAge: Math.max(18, Math.min(100, parseInt(e.target.value) || 100)),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Ages {preferences.minAge} - {preferences.maxAge}
          </div>
        </div>

        {/* Maximum Distance */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maximum Distance: {preferences.maxDistance} km
          </label>
          <input
            type="range"
            min="1"
            max="500"
            value={preferences.maxDistance}
            onChange={e =>
              setPreferences(prev => ({
                ...prev,
                maxDistance: parseInt(e.target.value),
              }))
            }
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1 km</span>
            <span>500 km</span>
          </div>
        </div>

        {/* Minimum Compatibility Score */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Minimum Compatibility Score: {preferences.minCompatibilityScore}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={preferences.minCompatibilityScore}
            onChange={e =>
              setPreferences(prev => ({
                ...prev,
                minCompatibilityScore: parseInt(e.target.value),
              }))
            }
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0% (Show all)</span>
            <span>100% (Perfect matches only)</span>
          </div>
        </div>

        {/* Preferred Activities */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Preferred Activities
          </label>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {activityOptions.map(activity => (
              <button
                key={activity}
                onClick={() => toggleActivity(activity)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  preferences.preferredActivities.includes(activity)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {activity}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Select activities you'd like to do with potential matches
          </p>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              isSaving
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreferencesSettings;
