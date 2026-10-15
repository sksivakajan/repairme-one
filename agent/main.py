"""RepairMe Agent entry point.

    python main.py                    start the tray app (asks for a connection code the first time)
    python main.py --headless         run without a window, using the saved connection
    python main.py --pair CODE --server https://portal.example   pair from the command line, then run headless
"""
import sys
import threading

from repairme_agent import __version__, api, storage


def headless(args: list[str]) -> int:
    import platform
    import socket

    from repairme_agent.worker import Worker

    if '--pair' in args:
        server = api.normalize_server(args[args.index('--server') + 1])
        token = api.pair(server, args[args.index('--pair') + 1], socket.gethostname(), platform.platform()[:80], __version__)
        storage.save(server, token)
    saved = storage.load()
    if saved is None:
        print('Not connected. Run with --pair CODE --server ADDRESS.')
        return 1
    worker = Worker(*saved, on_update=lambda: None)
    stop = threading.Event()
    try:
        worker.run(stop)
    except KeyboardInterrupt:
        stop.set()
    return 0


if __name__ == '__main__':
    if '--headless' in sys.argv or '--pair' in sys.argv:
        sys.exit(headless(sys.argv[1:]))
    from repairme_agent import app

    sys.exit(app.main(sys.argv[1:]))
