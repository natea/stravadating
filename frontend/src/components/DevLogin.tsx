import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  age: number;
  gender: string;
  city: string;
  state: string;
  stravaId: number;
}

const DevLogin: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await api.get('/dev/users');
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsUser = async (userId: string, userName: string) => {
    setLoginLoading(userId);
    try {
      const response = await api.post(`/dev/login-as/${userId}`);

      if (response.data.success) {
        // Store auth data
        localStorage.setItem(
          'authToken',
          response.data.data.tokens.accessToken
        );
        localStorage.setItem(
          'refreshToken',
          response.data.data.tokens.refreshToken
        );
        localStorage.setItem('user', JSON.stringify(response.data.data.user));

        console.log(`✅ Logged in as ${userName}`);
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed');
    } finally {
      setLoginLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  const maleUsers = users.filter(u => u.gender === 'male');
  const femaleUsers = users.filter(u => u.gender === 'female');

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔧 Development Login
          </h1>
          <p className="text-gray-600">
            Choose any user to login as for testing purposes
          </p>
          <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 rounded-lg inline-block">
            <p className="text-yellow-800 text-sm">
              ⚠️ This is for development testing only!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Male Users */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">
              👨 Male Users ({maleUsers.length})
            </h2>
            <div className="space-y-3">
              {maleUsers.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <h3 className="font-medium">
                      {user.firstName} {user.lastName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Age {user.age} • {user.city}, {user.state}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <button
                    onClick={() =>
                      loginAsUser(user.id, `${user.firstName} ${user.lastName}`)
                    }
                    disabled={loginLoading === user.id}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                  >
                    {loginLoading === user.id ? 'Logging in...' : 'Login'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Female Users */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-pink-600">
              👩 Female Users ({femaleUsers.length})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {femaleUsers.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <h3 className="font-medium">
                      {user.firstName} {user.lastName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Age {user.age} • {user.city}, {user.state}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <button
                    onClick={() =>
                      loginAsUser(user.id, `${user.firstName} ${user.lastName}`)
                    }
                    disabled={loginLoading === user.id}
                    className="px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700 disabled:bg-gray-400 text-sm"
                  >
                    {loginLoading === user.id ? 'Logging in...' : 'Login'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            ← Back to Normal Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default DevLogin;
