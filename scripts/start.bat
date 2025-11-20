@echo off
echo Starting Eagle Swap Backend...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist .env (
    echo Warning: .env file not found, copying from .env.example
    if exist .env.example (
        copy .env.example .env
        echo Please edit .env file with your configuration
    ) else (
        echo Error: .env.example file not found
        pause
        exit /b 1
    )
)

REM Create necessary directories
if not exist data mkdir data
if not exist logs mkdir logs

REM Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Build the project
echo Building project...
npm run build
if %errorlevel% neq 0 (
    echo Error: Build failed
    pause
    exit /b 1
)

REM Start the server
echo Starting server...
npm start

pause