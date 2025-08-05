import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Mock all services that use axios
jest.mock('./services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('./services/matchingService', () => ({
  matchingService: {
    getPotentialMatches: jest.fn(),
    createMatch: jest.fn(),
    getUserMatches: jest.fn(),
  },
}));

jest.mock('./services/adminService', () => ({
  adminService: {
    getThresholds: jest.fn(),
    getStats: jest.fn(),
  },
}));

describe('App Component', () => {
  test('renders without crashing', () => {
    const div = document.createElement('div');
    const root = ReactDOM.createRoot(div);
    root.render(<App />);
    root.unmount();
  });
});
