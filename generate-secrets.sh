#!/bin/bash

echo "=== Generating Secure Secrets for Railway Deployment ==="
echo ""

echo "JWT_SECRET:"
openssl rand -base64 32
echo ""

echo "JWT_REFRESH_SECRET:"
openssl rand -base64 32
echo ""

echo "ENCRYPTION_KEY:"
openssl rand -hex 32
echo ""

echo "=== Copy these values to your Railway environment variables ==="
echo "Remember to keep these secret and never commit them to git!"