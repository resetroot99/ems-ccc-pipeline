@echo off
echo ===============================================
echo    EMS CCC Pipeline - Windows Installer
echo ===============================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo Then run this installer again.
    pause
    exit /b 1
)

echo ✅ Node.js detected: 
node --version

echo.
echo Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies!
    pause
    exit /b 1
)

echo.
echo ✅ Dependencies installed successfully!

echo.
echo Setting up database...
npm run setup

echo.
echo Creating required directories...
if not exist "C:\CCC_EMS_EXPORTS" (
    mkdir "C:\CCC_EMS_EXPORTS"
    echo ✅ Created: C:\CCC_EMS_EXPORTS
) else (
    echo ✅ Directory exists: C:\CCC_EMS_EXPORTS
)

if not exist "processed" mkdir processed
if not exist "logs" mkdir logs

echo.
echo ===============================================
echo           Installation Complete!
echo ===============================================
echo.
echo Next steps:
echo 1. Configure your CCC ONE export directory to: C:\CCC_EMS_EXPORTS
echo 2. Start the pipeline: npm start
echo 3. Or run in background: npm run start-service
echo.
echo For status check: npm run status
echo For historical processing: npm run historical
echo.
pause 