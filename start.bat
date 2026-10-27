@echo off
cd /d "%~dp0"
if exist "TalentFit.exe" (
    start "" "%~dp0TalentFit.exe"
    exit /b 0
)
echo TalentFit portable files are not built yet.
echo Developer setup: npm ci, npm run setup:runtime, npm run package:windows
echo For daily use, unzip the complete Windows release and run TalentFit.exe.
pause
