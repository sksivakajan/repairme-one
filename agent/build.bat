@echo off
rem Builds dist\RepairMeDesktop.exe (the app) and dist\RepairMeSetup.exe (the installer wizard). Needs Python 3.10+.
cd /d "%~dp0"
python -m pip install -r requirements.txt pyinstaller
python -m PyInstaller --onefile --windowed --noconfirm --name RepairMeDesktop --collect-all webview --collect-all pythonnet --collect-all clr_loader --hidden-import pystray._win32 main.py
if errorlevel 1 exit /b 1
python -m PyInstaller --onefile --windowed --noconfirm --name RepairMeSetup --add-data "dist\RepairMeDesktop.exe;payload" installer.py
if errorlevel 1 exit /b 1
echo.
echo Done:
echo   %~dp0dist\RepairMeDesktop.exe
echo   %~dp0dist\RepairMeSetup.exe   (give this one to employees)
