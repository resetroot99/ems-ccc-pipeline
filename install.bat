@echo off
echo ===============================================
echo    EMS CCC Pipeline - Windows Installer
echo ===============================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found. Installing Node.js automatically...
    echo.
    
    REM Try winget first (Windows 10/11)
    winget --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo Installing Node.js via winget...
        winget install OpenJS.NodeJS --silent --accept-package-agreements --accept-source-agreements
        if %errorlevel% equ 0 (
            echo ✅ Node.js installed successfully via winget!
            echo Please restart this installer to continue.
            pause
            exit /b 0
        )
    )
    
    REM Fallback: Try chocolatey
    choco --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo Installing Node.js via chocolatey...
        choco install nodejs -y
        if %errorlevel% equ 0 (
            echo ✅ Node.js installed successfully via chocolatey!
            echo Please restart this installer to continue.
            pause
            exit /b 0
        )
    )
    
    REM Final fallback: Manual download
    echo.
    echo ⚠️  Automatic installation failed.
    echo Please manually install Node.js:
    echo 1. Visit: https://nodejs.org/
    echo 2. Download and install the LTS version
    echo 3. Restart this installer
    echo.
    echo Opening Node.js download page...
    start https://nodejs.org/
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
echo Setting up location configuration...
npm run setup-location

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