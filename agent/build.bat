@echo off
rem Builds dist\RepairMeAgent.exe, one file with no console window. Needs Python 3.10+.
cd /d "%~dp0"
python -m pip install -r requirements.txt pyinstaller
python -m PyInstaller --onefile --windowed --name RepairMeAgent --clean main.py
echo.
echo Done: %~dp0dist\RepairMeAgent.exe
