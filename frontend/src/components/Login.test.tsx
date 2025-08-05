import React from 'react';
import ReactDOM from 'react-dom/client';
import Login from './Login';

// Mock the api module to prevent axios import issues
jest.mock('../services/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue({ data: { authUrl: 'test' } }),
  },
}));

describe('Login Component', () => {
  test('renders without crashing', () => {
    const div = document.createElement('div');
    const root = ReactDOM.createRoot(div);
    root.render(<Login />);
    root.unmount();
  });
});
