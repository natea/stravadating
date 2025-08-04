// User types
export * from './user';

// Fitness types
export * from './fitness';

// Strava types
export * from './strava';

// Matching types
export * from './matching';

// Messaging types
export * from './messaging';

// Common types
export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  ui?: {
    showWarning?: boolean;
    showRedScreen?: boolean;
    displayMessage?: string;
    actionRequired?: string;
  };
}

export interface DatabaseError extends Error {
  code?: string;
  constraint?: string;
}