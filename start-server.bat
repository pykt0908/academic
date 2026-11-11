@echo off
title Teacher Daily Report Web Server
cd /d "%~dp0"
echo ====================================================
echo  Starting Teacher Daily Report Web Server (Read-Only)
echo ====================================================
echo.
echo URL: http://localhost:3000
echo.
node server.js
pause

