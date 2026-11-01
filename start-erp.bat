@echo off
title College ERP - Website Launcher
cls
echo =============================================================
echo               COLLEGE ERP - 1-CLICK LAUNCHER
echo =============================================================
echo.

cd /d "%~dp0"

:: 1. Check if root dependencies are installed
if not exist "node_modules\" (
    echo [SETUP] Installing required frontend dependencies (first-time setup)...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install npm packages. Make sure Node.js is installed.
        pause
        exit /b 1
    )
    echo [SETUP] Root dependencies installed successfully!
    echo.
)

:: 2. Check if server dependencies are installed
if not exist "server\node_modules\" (
    echo [SETUP] Installing required backend dependencies (first-time setup)...
    cd server
    call npm install
    cd ..
    echo [SETUP] Backend dependencies installed successfully!
    echo.
)

echo [STARTING] Launching College ERP Full-Stack (Backend + Frontend) on Port 3000...
echo [INFO] Your browser will open automatically at http://localhost:3000
echo.
echo =============================================================
echo                    QUICK TEST ACCOUNTS
echo =============================================================
echo  STUDENT:  Roll: 31001     Password: Kavya@31001   (or click demo chip)
echo  FACULTY:  Code: FAC-001   Password: Ashwini@FAC001 (or click demo chip)
echo  STAFF:    Code: TNP-HEAD  Password: TNP@Campus2026
echo =============================================================
echo.

:: Automatically launch browser after 4 seconds in the background
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"

:: Start both Backend (Port 5000) and Frontend (Port 3000)
call npm start

pause
