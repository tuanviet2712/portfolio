@echo off
chcp 65001 >nul
title Portfolio - Xem tren dien thoai
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve-lan.ps1" -Port 5501
pause
