@echo off
echo Starting Zhouyi Map Project...

echo.
echo Starting Backend...
REM Ensure backend can find the local SQLite database
REM The repo ships with backend/zhouyi_map.db; point DB_PATH there in dev
start "Backend" cmd /k "cd backend && set DB_PATH=..\data\zhouyi_map.db && go run main.go"

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
# pause > nul
