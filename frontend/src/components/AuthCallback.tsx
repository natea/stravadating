import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [fitnessError, setFitnessError] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let hasProcessed = false;

    const handleCallback = async () => {
      // Prevent double processing
      if (hasProcessed) return;
      hasProcessed = true;

      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        if (isMounted) {
          setError('Strava authorization was denied. Please try again.');
          setIsProcessing(false);
        }
        return;
      }

      if (!code || !state) {
        if (isMounted) {
          setError('Invalid authorization response. Please try again.');
          setIsProcessing(false);
        }
        return;
      }

      try {
        console.log('Attempting to complete auth with code:', code?.substring(0, 10) + '...');

        // Complete authentication with backend
        const response = await api.get(`/auth/strava/complete?code=${code}&state=${state}`);

        if (response.data.success) {
          // Store tokens
          localStorage.setItem('authToken', response.data.data.tokens.accessToken);
          localStorage.setItem('refreshToken', response.data.data.tokens.refreshToken);
          localStorage.setItem('user', JSON.stringify(response.data.data.user));

          // Check if this is a new user who needs to complete profile
          if (response.data.data.isNewUser) {
            navigate('/profile/complete');
          } else {
            navigate('/dashboard');
          }
        } else {
          setError(response.data.message || 'Authentication failed. Please try again.');
          setIsProcessing(false);
        }
      } catch (err: unknown) {
        console.error('Auth callback error:', err);
        interface AxiosError extends Error {
          response?: {
            data?: {
              message?: string;
              error?: string;
              data?: any;
            };
          };
        }
        const axiosErr = err as AxiosError;
        // Check if it's a fitness threshold error
        if (axiosErr.response?.data?.error === 'FITNESS_THRESHOLD_NOT_MET') {
          setFitnessError(axiosErr.response.data.data?.fitnessEvaluation);
          setError(null);
        } else {
          const errorMessage =
            axiosErr.response?.data?.message ||
            'Failed to complete authentication. Please try again.';
          setError(errorMessage);
        }
        setIsProcessing(false);
      }
    };

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, [searchParams, navigate]);

  if (fitnessError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mb-4">
              <svg
                className="w-20 h-20 text-orange-500 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Keep Training, Champion! 💪</h2>
            <p className="text-lg text-gray-700 mb-2">Your fitness journey is just beginning!</p>
            <div className="my-6 p-4 bg-orange-50 rounded-lg">
              <p className="text-gray-600 mb-3">
                To join our community, we need to see a bit more activity. Here&apos;s where you
                stand:
              </p>
              {/* Fitness Score */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">Fitness Score</span>
                  <span className="text-sm font-bold text-orange-600">
                    {fitnessError.score}/100
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-orange-400 to-orange-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${fitnessError.score}%` }}
                  />
                </div>
              </div>
              {/* Requirements */}
              {fitnessError.reasons && (
                <div className="text-left space-y-2 mt-4">
                  <p className="text-sm font-semibold text-gray-700">Current Status:</p>
                  {fitnessError.reasons.map((reason: string, index: number) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">
                        {reason.startsWith('✗') ? '❌' : '✅'}
                      </span>
                      <span className="text-sm text-gray-600">
                        {reason.replace(/^[✗✓]\s*/, '')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">💡 Tips to Get Started:</h3>
              <ul className="text-left text-sm text-gray-600 space-y-1">
                <li>• Try to complete at least 3 activities per week</li>
                <li>• Aim for 10km+ total weekly distance</li>
                <li>• Mix it up with running, cycling, or swimming</li>
                <li>• Sync your Strava activities regularly</li>
              </ul>
            </div>

            <p className="text-sm text-gray-500 mb-6">
              Don&apos;t worry! Once you build up your activity history, you&apos;ll be able to join
              our community of fitness enthusiasts.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => (window.location.href = 'https://www.strava.com/dashboard')}
                className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
              >
                Go to Strava Dashboard
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mb-4">
              <svg
                className="w-16 h-16 text-red-500 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication Failed</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <div className="mb-4">
            <svg className="animate-spin h-16 w-16 text-blue-600 mx-auto" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {isProcessing ? 'Completing Authentication...' : 'Redirecting...'}
          </h2>
          <p className="text-gray-600">Please wait while we set up your account.</p>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
