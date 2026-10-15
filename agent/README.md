# RepairMe Desktop

A Windows app that shows the RepairMe portal in its own window, measures work time, and reminds people to take
coffee breaks. It is the same workspace as the website, so employees sign in with the **same username and
password** and see the **same screens**: their tasks, the work-time watch and everything else.

## What the app does

- **Same sign-in, same screens.** The window shows the portal. After signing in, the portal hands the app a one-time
  code and the computer is connected automatically. No code is typed.
- **Work-time watch.** The portal's digital watch runs only while the computer is really in use.
- **Coffee breaks.** After 60 minutes of continuous work the app offers a 10-minute break (Windows notification and a
  prompt in the window). The employee can start it or push it back 10 minutes. Break time is not counted as work.
  When the break ends, the app says so. The same prompt appears in the web portal, using browser notifications.
- **Works offline.** If the internet drops, work time is stored on the computer (`%APPDATA%\RepairMeAgent\worklog.json`)
  and uploaded when the connection returns. Each minute is credited once.
- **Tray icon.** Closing the window keeps the app (and tracking) running in the tray. Green is working, amber is idle
  or locked, purple is a break, grey is offline.

## What it sends (every 30 seconds)

State (`active`, `idle`, `locked`), seconds of real activity, seconds since the last keyboard or mouse use (never what
was typed), CPU and memory use, the number of programs, and the names of the busiest programs and the program in
front. It never records the screen, keystrokes, window titles, files or web pages. Tell employees before you use
it; monitoring staff may need consent or notice under local law.

## How "working" is decided

Every 5 seconds the app looks at the PC.

| PC looks like | Counted as |
| --- | --- |
| Keyboard or mouse used in the last 5 minutes | working |
| No input for over 5 minutes, but the program in front changes, CPU stays high and moving (a build, a render), or memory moves by 5 points | working |
| No input, and CPU, memory and the front program all unchanged for 5 minutes ("stable") | not working |
| Screen locked | not working |
| PC asleep, shut down, or the app closed (more than 30 seconds between looks) | not working; nothing is counted for the gap |
| Coffee break | not working |

The portal caps live credit to the real time since the previous report, and offline minutes are checked: each minute
once, at most 60 seconds, only from the last 3 days, never inside a break.

## Build and install

1. Run `build.bat` (needs Python 3.10+). It creates `dist\RepairMeDesktop.exe` and `dist\RepairMeSetup.exe`.
2. Give employees `RepairMeSetup.exe`, or put it at `public/downloads/RepairMeSetup.exe` before deploying the portal
   so the portal's **Install** page (`/install`) can offer it. Or host it anywhere and set
   `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL`.
3. The setup wizard has five pages: Welcome, What the app does (privacy), Install location, Installing, Finish.

IT roll-out options (current user, no admin rights needed):

```
RepairMeSetup.exe /S                                   silent install
RepairMeSetup.exe /S --dir "D:\Apps\RepairMe" --no-autostart --no-shortcuts --desktop-icon
RepairMeSetup.exe --uninstall /S [--purge]             silent uninstall (--purge also deletes saved sign-in and stored time)
```

Windows needs Microsoft Edge WebView2 (part of Windows 11 and current Windows 10). The setup warns if it is missing.
Uninstall from Settings → Apps → RepairMe Desktop.

## Develop and test

```
pip install -r requirements.txt
python -m unittest discover -s tests -v
python main.py --server http://localhost:3100          # open the app against a local portal
python main.py --pair CODE --server http://localhost:3100   # headless, for testing
```

The private token is stored encrypted for the Windows user in `%APPDATA%\RepairMeAgent\config.json`. The portal
stores only a hash of it. Employees, HR and the CEO can disconnect a computer from the portal at any time; the app
then stops tracking and asks the employee to sign in again.
