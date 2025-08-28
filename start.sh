#!/bin/bash

echo "Starting Zhouyi Map Project..."

echo ""
echo "Starting Backend..."
cd backend
go run main.go &
BACKEND_PID=$!

echo ""
echo "Waiting for backend to start..."
sleep 3

echo ""
echo "Starting Frontend..."
cd ../frontend
yarn dev &
FRONTEND_PID=$!

echo ""
echo "Both services are starting..."
echo "Backend: http://localhost:8080"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both services..."

# Wait for user to stop
wait

# Cleanup
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
echo "Services stopped."
