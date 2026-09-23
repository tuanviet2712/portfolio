@echo off
chcp 65001 >nul
title Trien khai Portfolio len letuanviet.digital
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\deploy.ps1"
pause
