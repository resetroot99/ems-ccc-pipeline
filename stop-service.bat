@echo off
echo Stopping EMS CCC Pipeline Service...

REM Kill any running node processes for this project
taskkill /f /im node.exe

echo Service stopped.
pause 