# Makefile for Strava Dating App

.PHONY: help install setup dev build test clean docker-up docker-down

help:
	@echo "Available commands:"
	@echo "  make install    - Install all dependencies"
	@echo "  make setup      - Setup database and environment"
	@echo "  make dev        - Run in development mode"
	@echo "  make build      - Build for production"
	@echo "  make test       - Run all tests"
	@echo "  make clean      - Clean build artifacts"
	@echo "  make docker-up  - Start with Docker"
	@echo "  make docker-down - Stop Docker containers"

install:
	@echo "Installing backend dependencies..."
	cd backend && npm install
	@echo "Installing frontend dependencies..."
	cd frontend && npm install --legacy-peer-deps

setup:
	@echo "Setting up environment..."
	cp backend/.env.example backend/.env
	cp frontend/.env.example frontend/.env
	@echo "Setting up database..."
	cd backend && npx prisma generate && npx prisma migrate dev
	@echo "Setup complete! Edit .env files with your credentials"

dev:
	@echo "Starting development servers..."
	@echo "Starting backend on http://localhost:3000"
	cd backend && npm run dev &
	@echo "Starting frontend on http://localhost:3001"
	cd frontend && npm start &
	@echo "Press Ctrl+C to stop all servers"
	wait

build:
	@echo "Building backend..."
	cd backend && npm run build
	@echo "Building frontend..."
	cd frontend && npm run build

test:
	@echo "Running backend tests..."
	cd backend && npm test
	@echo "Running frontend tests..."
	cd frontend && npm test -- --watchAll=false

clean:
	@echo "Cleaning build artifacts..."
	rm -rf backend/dist
	rm -rf frontend/build
	rm -rf backend/node_modules
	rm -rf frontend/node_modules

docker-up:
	@echo "Starting Docker containers..."
	docker-compose up -d
	@echo "Application running at http://localhost:3001"

docker-down:
	@echo "Stopping Docker containers..."
	docker-compose down

docker-logs:
	docker-compose logs -f

db-reset:
	cd backend && npx prisma migrate reset --force

db-studio:
	cd backend && npx prisma studio