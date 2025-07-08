@echo off
echo Stopping EMS CCC Pipeline Service...

REM Kill only our specific pipeline process
wmic process where "commandline like '%src/index.js start%'" delete

echo Service stopped.
echo If the service is still running, use Ctrl+C in the service window.
pause 