import React, { useState } from 'react';
import { api } from '../services/api';

const Login: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStravaLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get Strava auth URL from backend
      const response = await api.get('/auth/strava');
      console.log('Strava auth response:', response.data);

      if (response.data?.data?.authUrl) {
        // Redirect to Strava OAuth page
        window.location.href = response.data.data.authUrl;
      } else if (response.data?.authUrl) {
        // Fallback for different response structure
        window.location.href = response.data.authUrl;
      } else {
        console.error('No authUrl in response:', response.data);
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Failed to initiate Strava login:', err);
      setError('Failed to connect with Strava. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              StravaDating
            </h1>
            <p className="text-gray-600">Connect with fitness-minded singles</p>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">
                Welcome Back!
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Sign in with your Strava account to find your perfect fitness
                match
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Strava Login Button */}
            <button
              onClick={handleStravaLogin}
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg font-semibold transition-all ${
                isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                  Connecting...
                </>
              ) : (
                <>
                  <svg
                    className="w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                  </svg>
                  Continue with Strava
                </>
              )}
            </button>

            {/* Terms */}
            <p className="text-xs text-gray-500 text-center">
              By signing in, you agree to our{' '}
              <a href="/terms" className="text-blue-600 hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </a>
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-center text-sm text-gray-600">
              <p className="mb-2">New to StravaDating?</p>
              <button
                onClick={handleStravaLogin}
                className="text-blue-600 font-semibold hover:underline"
              >
                Create an account with Strava
              </button>
            </div>

            {/* Development Login Link */}
            {process.env.NODE_ENV !== 'production' && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <a
                    href="/dev-login"
                    className="text-xs text-orange-600 hover:underline bg-orange-50 px-3 py-1 rounded-full border border-orange-200"
                  >
                    🔧 Dev Login (Test as any user)
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Why Strava?</strong> We use Strava to verify your fitness
              activities and match you with compatible partners based on your
              training habits and goals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
