"""RepairMe Desktop entry point.

    RepairMeDesktop.exe                 open the app (sign in with your portal username and password)
    RepairMeDesktop.exe --minimized     start hidden in the tray (used when Windows starts)
    RepairMeDesktop.exe --server URL    use another portal address (for testing)
    python main.py --headless           track without a window, using the saved connection
    python main.py --pair CODE --server URL    connect from the command line, then run headless
"""
import argparse
import sys

from repairme_agent import __version__, api, storage


def headless(args: argparse.Namespace) -> int:
    import platform
    import socket

    from repairme_agent.worker import Worker

    if args.pair:
        server = api.normalize_server(args.server or '')
        result = api.pair_full(server, args.pair, socket.gethostname(), platform.platform()[:80], __version__)
        storage.save(server, result['token'], user_id=result.get('user_id') or '')
    saved = storage.load()
    if saved is None:
        print('Not connected. Run with --pair CODE --server ADDRESS.')
        return 1
    worker = Worker(*saved)
    try:
        worker.run()
    except KeyboardInterrupt:
        worker.stop.set()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog='RepairMeDesktop')
    parser.add_argument('--server')
    parser.add_argument('--minimized', action='store_true')
    parser.add_argument('--headless', action='store_true')
    parser.add_argument('--pair')
    args = parser.parse_args()
    if args.headless or args.pair:
        return headless(args)
    from repairme_agent import desktop

    return desktop.main(args.server, args.minimized)


if __name__ == '__main__':
    sys.exit(main())
