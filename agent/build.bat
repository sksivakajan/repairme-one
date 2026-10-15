@echo off
rem Builds the RepairMe Desktop app, its installer, and the ZIP to hand to employees. Needs Python 3.10+.
rem To sign (recommended, see README): set REPAIRME_SIGN_PFX and REPAIRME_SIGN_PASSWORD first.
rem Output: dist\RepairMeDesktop.exe, dist\RepairMeSetup.exe, dist\RepairMe-Desktop-Setup.zip
cd /d "%~dp0"
python -m pip install -r requirements.txt pyinstaller
python make_assets.py
if errorlevel 1 exit /b 1
python -m PyInstaller --onefile --windowed --noconfirm --name RepairMeDesktop --icon assets\repairme.ico --add-data "assets;assets" --collect-all webview --collect-all pythonnet --collect-all clr_loader --hidden-import pystray._win32 main.py
if errorlevel 1 exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -File sign.ps1 dist\RepairMeDesktop.exe
if errorlevel 1 exit /b 1
python -m PyInstaller --onefile --windowed --noconfirm --name RepairMeSetup --icon assets\repairme.ico --add-data "assets;assets" --add-data "dist\RepairMeDesktop.exe;payload" installer.py
if errorlevel 1 exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -File sign.ps1 dist\RepairMeSetup.exe
if errorlevel 1 exit /b 1
python make_bundle.py
echo.
echo Done. Give employees:  %~dp0dist\RepairMe-Desktop-Setup.zip
