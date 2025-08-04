export interface UserProfile {
  firstName: string;
  lastName: string;
  age: number;
  location: {
    city: string;
    state: string;
    coordinates: [number, number];
  };
  bio?: string;
  photos: string[];
}

export interface User {
  id: string;
  email: string;
  stravaId: number;
  firstName: string;
  lastName: string;
  age: number;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  bio?: string | null;
  photos: string[];
  createdAt: Date;
  lastActive: Date;
}

export interface CreateUserInput {
  email: string;
  stravaId: number;
  firstName: string;
  lastName: string;
  age: number;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  bio?: string;
  photos?: string[];
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  age?: number;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  bio?: string;
  photos?: string[];
  lastActive?: Date;
}