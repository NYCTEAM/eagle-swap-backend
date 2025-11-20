@echo off
echo Setting up Eagle Swap Backend...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: npm is not available
    pause
    exit /b 1
)

echo npm version:
npm --version

REM Create necessary directories
echo Creating directories...
if not exist data mkdir data
if not exist logs mkdir logs
if not exist dist mkdir dist

REM Copy environment file if it doesn't exist
if not exist .env (
    if exist .env.example (
        echo Copying .env.example to .env...
        copy .env.example .env
        echo.
        echo IMPORTANT: Please edit .env file with your configuration before starting the server
        echo.
    ) else (
        echo Warning: .env.example file not found
    )
)

REM Install dependencies
echo Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

REM Run database initialization
echo Initializing database...
npm run db:init
if %errorlevel% neq 0 (
    echo Warning: Database initialization failed, you may need to run it manually
)

REM Run database seeding
echo Seeding database with sample data...
npm run db:seed
if %errorlevel% neq 0 (
    echo Warning: Database seeding failed, you may need to run it manually
)

echo.
echo Setup completed successfully!
echo.
echo Next steps:
echo 1. Edit .env file with your configuration
echo 2. Make sure Eagle RPC Backend is running on port 3000
echo 3. Run 'npm run dev' to start development server
echo 4. Or run 'npm start' to start production server
echo.

pause