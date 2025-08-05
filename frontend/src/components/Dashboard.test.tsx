import React from 'react';
import ReactDOM from 'react-dom/client';
import Dashboard from './Dashboard';

// Mock the api module to prevent axios import issues
jest.mock('../services/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue({ data: { data: {} } }),
  },
}));

describe('Dashboard Component', () => {
  test('renders without crashing', () => {
    const div = document.createElement('div');
    const root = ReactDOM.createRoot(div);

    const mockUser = {
      id: '1',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@test.com',
    };

    root.render(<Dashboard />);
    root.unmount();
  });
});
