@echo off
echo Cleaning up project for GitHub...

echo Removing node_modules directory...
if exist node_modules rmdir /s /q node_modules

echo Removing dist directory...
if exist dist rmdir /s /q dist

echo Removing dist-electron directory...
if exist dist-electron rmdir /s /q dist-electron

echo Removing release directory...
if exist release rmdir /s /q release

echo Removing package-lock.json...
if exist package-lock.json del package-lock.json

echo Cleanup complete!
echo Ready to commit to GitHub.
echo Run 'npm install' after cloning to install dependencies.
pause
