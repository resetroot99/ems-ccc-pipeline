@echo off
title EMS CCC Pipeline Service

echo ===============================================
echo      Starting EMS CCC Pipeline Service
echo ===============================================
echo.
echo Pipeline is now running in the background...
echo Monitoring: C:\CCC_EMS_EXPORTS
echo Database: Supabase
echo.
echo To stop: Press Ctrl+C
echo For status: Open new window and run "npm run status"
echo.
echo ===============================================

REM Start the service
npm start 