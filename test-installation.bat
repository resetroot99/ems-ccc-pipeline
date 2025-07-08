@echo off
echo ===============================================
echo    EMS CCC Pipeline - Installation Test
echo ===============================================
echo.

echo Testing Node.js installation...
node --version
if %errorlevel% neq 0 (
    echo ❌ Node.js not found!
    goto :end
) else (
    echo ✅ Node.js is working
)

echo.
echo Testing npm...
npm --version
if %errorlevel% neq 0 (
    echo ❌ npm not found!
    goto :end
) else (
    echo ✅ npm is working
)

echo.
echo Testing project dependencies...
if exist node_modules (
    echo ✅ Dependencies are installed
) else (
    echo ❌ Dependencies not found - run install.bat first
    goto :end
)

echo.
echo Testing configuration...
if exist config.js (
    echo ✅ Configuration file exists
) else (
    echo ❌ config.js not found
    goto :end
)

echo.
echo Testing export directory...
if exist "C:\CCC_EMS_EXPORTS" (
    echo ✅ Export directory exists: C:\CCC_EMS_EXPORTS
) else (
    echo ⚠️  Export directory not found: C:\CCC_EMS_EXPORTS
    echo    Create this folder manually or from CCC ONE
)

echo.
echo Testing sample file...
copy examples\sample.ems C:\CCC_EMS_EXPORTS\ >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Sample file copied for testing
    del C:\CCC_EMS_EXPORTS\sample.ems >nul 2>&1
) else (
    echo ⚠️  Could not copy sample file (check permissions)
)

echo.
echo ===============================================
echo            Installation Test Complete
echo ===============================================
echo.
echo If all tests pass ✅, you're ready to run:
echo   start-service.bat
echo.

:end
pause 