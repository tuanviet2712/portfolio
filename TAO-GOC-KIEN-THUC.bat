@echo off
chcp 65001 >nul
title Goc kien thuc - tao lai trang
cd /d "%~dp0"
rem Tao lai anh bia + toan bo trang /goc-kien-thuc/ tu tools\kb\articles\*.html
rem Tim node.exe: uu tien ban trong PATH, sau do cac vi tri da biet tren may
set "NODE=node"
where node >nul 2>nul || call :find
if /i not "%NODE%"=="node" if not exist "%NODE%" (
  echo Khong tim thay node.exe. Cai Node.js roi chay lai file nay.
  pause
  exit /b 1
)
"%NODE%" tools\kb\render-assets.cjs
"%NODE%" tools\kb\build-kb.cjs
pause
exit /b

:find
rem 1) node.exe dat canh thu muc du an  2) ban cai dat chuan  3) thu muc bat ky o goc o D:
for %%P in ("%~dp0..\..\node.exe" "%ProgramFiles%\nodejs\node.exe") do if exist "%%~P" ( set "NODE=%%~P" & exit /b )
for /d %%D in ("D:\*") do if exist "%%~D\node.exe" ( set "NODE=%%~D\node.exe" & exit /b )
exit /b
