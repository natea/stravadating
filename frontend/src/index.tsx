import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  // Temporarily disabled StrictMode to prevent double OAuth calls
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
);
