@echo off
REM Stage0 - Windows Command Prompt wrapper for the shared Node.js dev launcher
pushd "%~dp0.."
node "%~dp0dev.mjs" %*
set "STAGE0_EXIT=%ERRORLEVEL%"
popd
exit /b %STAGE0_EXIT%
