import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const ProfileComplete: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    age: '',
    bio: '',
    goals: '',
    preferredActivities: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activities = [
    'Running',
    'Cycling',
    'Swimming',
    'Hiking',
    'Gym',
    'Yoga',
    'CrossFit',
    'Rock Climbing',
    'Trail Running',
    'Triathlon',
    'Walking',
    'Weightlifting',
  ];

  const handleActivityToggle = (activity: string) => {
    setFormData(prev => ({
      ...prev,
      preferredActivities: prev.preferredActivities.includes(activity)
        ? prev.preferredActivities.filter(a => a !== activity)
        : [...prev.preferredActivities, activity],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.age || parseInt(formData.age) < 18) {
      setError('You must be at least 18 years old');
      return;
    }

    if (formData.preferredActivities.length === 0) {
      setError('Please select at least one preferred activity');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await api.put('/users/profile', {
        age: parseInt(formData.age),
        bio: formData.bio,
        goals: formData.goals,
        preferredActivities: formData.preferredActivities,
      });

      navigate('/dashboard');
    } catch (err: unknown) {
      console.error('Failed to complete profile:', err);
      interface AxiosError extends Error {
        response?: {
          data?: {
            message?: string;
          };
        };
      }
      const errorMessage =
        err instanceof Error && 'response' in err
          ? (err as AxiosError).response?.data?.message ||
            'Failed to update profile. Please try again.'
          : 'Failed to update profile. Please try again.';
      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Complete Your Profile</h1>
          <p className="text-gray-600 mb-8">
            Let&apos;s add some details to help find your perfect fitness match!
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Age */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Age <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="18"
                max="100"
                value={formData.age}
                onChange={e => setFormData({ ...formData, age: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your age"
                required
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">About You</label>
              <textarea
                value={formData.bio}
                onChange={e => setFormData({ ...formData, bio: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="Tell us about yourself and your fitness journey..."
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">{formData.bio.length}/500 characters</p>
            </div>

            {/* Fitness Goals */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fitness Goals</label>
              <textarea
                value={formData.goals}
                onChange={e => setFormData({ ...formData, goals: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="What are your fitness goals? (e.g., Marathon training, weight loss, muscle building...)"
                maxLength={300}
              />
            </div>

            {/* Preferred Activities */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Preferred Activities <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {activities.map(activity => (
                  <button
                    key={activity}
                    type="button"
                    onClick={() => handleActivityToggle(activity)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.preferredActivities.includes(activity)
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {activity}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Skip for Now
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                  isSubmitting
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                }`}
              >
                {isSubmitting ? 'Saving...' : 'Complete Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileComplete;
