# RepairMe Agent

A small Windows app that runs in the background (tray icon) and tells the RepairMe portal whether the
computer is really in use. The portal shows each person's worked time as a live digital watch, and shows
managers, HR and the CEO who is working, idle, locked or offline.

## What it sends (every 30 seconds)

- State: `active`, `idle` or `locked`, and the seconds of real activity since the last report.
- Seconds since the last keyboard or mouse use. Never what was typed.
- CPU and memory use of the whole PC, the number of running programs, and the names of the busiest
  programs and the program in front (for example `chrome.exe`).

It never records the screen, keystrokes, window titles, files or web pages. Tell employees about it before
you use it; monitoring staff may need consent or notice under local law.

## How "working" is decided

Every 5 seconds the agent looks at the PC.

| PC looks like                                                                                                                                | Counted as                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Keyboard or mouse used in the last 5 minutes                                                                                                 | working                                     |
| No input for over 5 minutes, but the program in front changes, or CPU stays high and moving (a build, a render), or memory moves by 5 points | working                                     |
| No input, and CPU, memory and the front program all unchanged for the last 5 minutes ("stable")                                              | not working                                 |
| Screen locked                                                                                                                                | not working                                 |
| PC asleep, shut down, or the agent closed (a gap of more than 30 seconds between looks)                                                      | not working; nothing is counted for the gap |

The portal also caps the time it credits to the real time since the previous report, so a modified agent
cannot add time. Time while the agent cannot reach the portal is not counted.

## Use it

1. Build: run `build.bat` (needs Python 3.10+). It creates `dist\RepairMeAgent.exe`.
2. In the portal, open **Attendance → Desktop agent → Connect this PC** and create a code.
3. Copy `RepairMeAgent.exe` to the employee's PC and open it. Enter the portal address and the code.
4. The agent starts with Windows after that. A tray icon shows its state: green working, amber idle or
   locked, grey offline. Right-click for the status, **Open portal** and **Disconnect this PC**.

Each account can connect up to 5 computers. Employees, HR and the CEO can disconnect a computer from the
portal at any time; the agent then stops and asks for a new code the next time it starts.

The private token is stored encrypted for the Windows user in `%APPDATA%\RepairMeAgent\config.json`. The
portal stores only a hash of it.

## Develop and test

```
pip install -r requirements.txt
python -m unittest discover -s tests -v
python main.py                         # tray app
python main.py --pair CODE --server http://localhost:3100   # headless, for testing
```
