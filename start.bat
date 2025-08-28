@echo off
echo Starting Zhouyi Map Project...

echo.
echo Starting Backend...
start "Backend" cmd /k "cd backend && go run main.go"

echo.
echo Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo.
echo Starting Frontend...
start "Frontend" cmd /k "cd frontend && yarn dev"

echo.
echo Both services are starting...
echo Backend: http://localhost:8080
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit...
pause > nul
