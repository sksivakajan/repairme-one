import json
import os
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from unittest import mock

# Never touch the real %APPDATA% from tests.
TEMP_APPDATA = tempfile.mkdtemp(prefix='repairme-test-')
os.environ['APPDATA'] = TEMP_APPDATA
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from repairme_agent import api, storage  # noqa: E402
from repairme_agent.activity import ActivityTracker, Sample  # noqa: E402
from repairme_agent.desktop import DesktopApp  # noqa: E402
from repairme_agent.instance import SingleInstance  # noqa: E402
from repairme_agent.ledger import Ledger, minute_key  # noqa: E402
from repairme_agent.worker import Worker  # noqa: E402

SAMPLE_REPORT = Path(__file__).with_name('sample_report.json')


def sample(t, cpu=3.0, ram=40.0, idle=0.0, locked=False, app='code.exe'):
    return Sample(wall=t, cpu=cpu, ram=ram, input_idle=idle, locked=locked, foreground=app)


def run(tracker, seconds, **kwargs):
    start = (tracker.last_wall or 0) + 5
    for i in range(seconds // 5):
        tracker.feed(sample(start + i * 5, **kwargs))


class ActivityRules(unittest.TestCase):
    def test_recent_input_counts_as_work(self):
        t = ActivityTracker()
        run(t, 60, idle=2)
        self.assertEqual(t.state, 'active')
        active, idle = t.take()
        self.assertGreaterEqual(active, 50)
        self.assertEqual(idle, 0)

    def test_stable_pc_without_input_is_not_work(self):
        t = ActivityTracker()
        run(t, 600, idle=900, cpu=2.0, ram=40.0)  # nobody there, nothing changing
        self.assertEqual(t.state, 'idle')
        active, idle = t.take()
        self.assertEqual(active, 0)
        self.assertGreater(idle, 500)

    def test_changing_pc_without_input_is_work(self):
        t = ActivityTracker()
        # no keyboard for 15 minutes, but a long build keeps CPU high and moving
        for i in range(120):
            t.feed(sample(5 * (i + 1), cpu=70 if i % 2 else 40, idle=900))
        self.assertEqual(t.state, 'active')
        self.assertGreater(t.take()[0], 400)

    def test_foreground_change_without_input_is_not_work(self):
        t = ActivityTracker()
        for i in range(60):
            t.feed(sample(5 * (i + 1), idle=900, app='a.exe' if i < 30 else 'b.exe'))
        self.assertEqual(t.state, 'idle')
        self.assertEqual(t.take()[0], 0)

    def test_memory_drift_without_input_is_not_work(self):
        t = ActivityTracker()
        for i in range(120):
            t.feed(sample(5 * (i + 1), idle=900, ram=40.0 + i * 0.2))
        self.assertEqual(t.state, 'idle')
        self.assertEqual(t.take()[0], 0)

    def test_nothing_counts_after_thirty_minutes_without_input(self):
        t = ActivityTracker()
        for i in range(120):  # heavy load, but nobody has touched the PC for 40 minutes
            t.feed(sample(5 * (i + 1), cpu=70 if i % 2 else 40, idle=2400))
        self.assertEqual(t.state, 'idle')
        self.assertEqual(t.take()[0], 0)

    def test_locked_screen_is_not_work(self):
        t = ActivityTracker()
        run(t, 60, locked=True, idle=1)
        self.assertEqual(t.state, 'locked')
        self.assertEqual(t.take()[0], 0)

    def test_sleep_gap_counts_nothing(self):
        t = ActivityTracker()
        run(t, 30, idle=1)
        before = t.take()[0]
        t.feed(sample(t.last_wall + 4 * 3600, idle=1))  # PC slept 4 hours
        self.assertTrue(t.slept)
        self.assertEqual(t.take()[0], 0)
        self.assertGreater(before, 0)
        run(t, 30, idle=1)
        self.assertLess(t.take()[0], 40)  # only the awake time after waking

    def test_clock_going_backwards_counts_nothing(self):
        t = ActivityTracker()
        run(t, 20, idle=1)
        t.take()
        t.feed(sample(t.last_wall - 600, idle=1))
        self.assertEqual(t.take()[0], 0)


class LedgerStorage(unittest.TestCase):
    def make(self):
        return Ledger(Path(tempfile.mkdtemp()) / 'worklog.json')

    def test_credited_seconds_are_not_kept(self):
        ledger = self.make()
        ledger.add(1_000_000, 20)
        ledger.commit_window(credited=True)
        self.assertEqual(ledger.pending(), [])
        self.assertEqual(ledger.today_seconds(1_000_000), 20)

    def test_uncredited_seconds_wait_for_upload_and_survive_restart(self):
        ledger = self.make()
        ledger.add(1_000_000, 30)
        ledger.add(1_000_070, 25)  # the next minute
        ledger.commit_window(credited=False)
        self.assertEqual(ledger.unsent_seconds(), 55)
        again = Ledger(ledger.path)  # the app was restarted
        pending = again.pending()
        self.assertEqual([p['seconds'] for p in pending], [30, 25])
        self.assertEqual(pending[0]['minute'], minute_key(1_000_000))
        again.acknowledge(pending)
        self.assertEqual(Ledger(ledger.path).pending(), [])

    def test_a_minute_never_holds_more_than_60_seconds(self):
        ledger = self.make()
        for _ in range(10):
            ledger.add(1_000_000, 30)
            ledger.commit_window(credited=False)
        self.assertEqual(ledger.pending()[0]['seconds'], 60)


class FakeSystem:
    def __init__(self):
        self.now = 1000.0
        self.reports = []
        self.reply = {'ok': True, 'today_active_seconds': 123}
        self.fail = False

    def sampler(self):
        self.now += 5
        return sample(self.now, idle=1)

    def clock(self):
        return self.now

    def machine(self):
        return {'cpu_percent': 10.0, 'ram_percent': 50.0, 'ram_used_mb': 8000, 'ram_total_mb': 16000, 'cpu_count': 8}

    def processes(self):
        return 120, [{'name': 'code.exe', 'cpu': 5.2, 'ram_mb': 800.0}]

    def send(self, server, token, payload):
        if self.fail:
            raise api.ApiError('down')
        self.reports.append(payload)
        return self.reply


class WorkerBehaviour(unittest.TestCase):
    def make(self, **kwargs):
        f = FakeSystem()
        ledger = Ledger(Path(tempfile.mkdtemp()) / 'worklog.json')
        w = Worker('https://p.example', 't' * 64, sampler=f.sampler, machine=f.machine, processes=f.processes, send=f.send, clock=f.clock, ledger=ledger, **kwargs)
        return f, w

    def test_reports_every_30_seconds_with_counted_time(self):
        f, w = self.make()
        for _ in range(14):
            w.step()
        self.assertEqual(len(f.reports), 2)
        first = f.reports[0]
        self.assertEqual(first['state'], 'active')
        self.assertTrue(20 <= first['active_seconds'] <= 30)
        self.assertEqual(w.today_seconds, 123)
        self.assertTrue(w.online)

    def test_report_matches_portal_schema_and_sample_file(self):
        f, w = self.make()
        for _ in range(7):
            w.step()
        report = f.reports[0]
        expected = json.loads(SAMPLE_REPORT.read_text())
        self.assertEqual(set(report), set(expected))
        for app in report['top_apps']:
            self.assertEqual(set(app), {'name', 'cpu', 'ram_mb'})

    def test_offline_time_is_stored_then_uploaded_once(self):
        f, w = self.make()
        f.fail = True
        for _ in range(19):  # about 90 seconds with no connection
            w.step()
        self.assertFalse(w.online)
        stored = w.ledger.unsent_seconds()
        self.assertGreater(stored, 50)
        f.fail = False
        for _ in range(7):
            w.step()
        sent = [m for r in f.reports for m in r['backlog']]
        self.assertEqual(sum(m['seconds'] for m in sent), stored)
        self.assertEqual(w.ledger.unsent_seconds(), 0)
        for _ in range(14):
            w.step()
        self.assertEqual(sum(len(r['backlog']) for r in f.reports[1:]), 0)  # never uploaded twice

    def test_revoked_device_stops_the_worker(self):
        f, w = self.make()

        def revoked(server, token, payload):
            raise api.ApiError('revoked', 401, True)

        w.send = revoked
        for _ in range(7):
            w.step()
        self.assertTrue(w.revoked)
        self.assertEqual(w.ledger.unsent_seconds(), 0)

    def test_break_events_fire_once_each(self):
        events = []
        f, w = self.make(on_event=events.append)
        f.reply = {'ok': True, 'work': {'break_due': True, 'on_break': False}}
        for _ in range(14):
            w.step()
        self.assertEqual(events, ['break_due'])
        f.reply = {'ok': True, 'work': {'break_due': False, 'on_break': True}}
        for _ in range(7):
            w.step()
        self.assertEqual(w.state, 'break')
        f.reply = {'ok': True, 'work': {'break_due': False, 'on_break': False}}
        for _ in range(7):
            w.step()
        self.assertEqual(events, ['break_due', 'break_over'])


class DesktopBridge(unittest.TestCase):
    def setUp(self):
        storage.clear()
        self.app = DesktopApp('https://portal.example')
        self.app.start_worker = mock.Mock()

    def test_signing_in_to_the_portal_connects_this_computer(self):
        self.assertFalse(self.app.js_api.status()['paired'])
        with mock.patch.object(api, 'pair_full', return_value={'token': 'f' * 64, 'user_id': 'u-1', 'employee': 'Nimal'}) as pair:
            result = self.app.js_api.pair('abcd-1234-ef56', 'https://portal.example', 'u-1')
        self.assertTrue(result['ok'])
        self.assertEqual(pair.call_args.args[:2], ('https://portal.example', 'abcd-1234-ef56'))
        status = self.app.js_api.status()
        self.assertEqual((status['paired'], status['user_id']), (True, 'u-1'))
        self.app.start_worker.assert_called_once()
        self.assertEqual(storage.load_config()['token'], 'f' * 64)

    def test_a_wrong_code_is_reported_not_raised(self):
        with mock.patch.object(api, 'pair_full', side_effect=api.ApiError('Code is not valid or has expired')):
            result = self.app.js_api.pair('nope', 'https://portal.example', 'u-1')
        self.assertEqual(result, {'ok': False, 'error': 'Code is not valid or has expired'})
        self.assertFalse(self.app.js_api.status()['paired'])

    def test_notifications_are_shown_once_even_if_asked_twice(self):
        self.app.icon = mock.Mock()
        self.app.js_api.notify('Break over', 'Welcome back')
        self.app.js_api.notify('Break over', 'Welcome back')
        self.assertEqual(self.app.icon.notify.call_count, 1)

    def test_a_due_break_notifies_and_brings_the_window_forward(self):
        self.app.icon = mock.Mock()
        self.app.show_window = mock.Mock()
        self.app.on_event('break_due')
        self.assertIn('coffee break', self.app.icon.notify.call_args.args[1].lower() + self.app.icon.notify.call_args.args[0].lower())
        self.app.show_window.assert_called_once()

    def test_closing_the_window_keeps_tracking_in_the_tray(self):
        self.app.window = mock.Mock()
        self.assertFalse(self.app.on_closing())
        self.app.window.hide.assert_called_once()
        self.app.quitting = True
        self.assertTrue(self.app.on_closing())


@unittest.skipUnless(sys.platform == 'win32', 'Windows only')
class OpeningTheAppAgain(unittest.TestCase):
    def test_a_second_launch_asks_the_running_app_to_show_its_window(self):
        name = f'test-{os.getpid()}-{time.time_ns()}'
        running = SingleInstance(name)
        self.assertTrue(running.first)
        shown = threading.Event()
        running.watch(shown.set)
        again = SingleInstance(name)
        self.assertFalse(again.first)  # this copy would exit
        again.ask_running_copy_to_show()
        self.assertTrue(shown.wait(3), 'the running app was not asked to show its window')
        running.close()

    def test_every_launch_is_heard_not_only_the_first(self):
        name = f'test-{os.getpid()}-{time.time_ns()}'
        running = SingleInstance(name)
        count = []
        running.watch(lambda: count.append(1))
        for _ in range(3):
            SingleInstance(name).ask_running_copy_to_show()
            time.sleep(0.8)
        self.assertEqual(len(count), 3)
        running.close()

    def test_different_installs_do_not_interfere(self):
        self.assertTrue(SingleInstance(f'a-{time.time_ns()}').first)
        self.assertTrue(SingleInstance(f'b-{time.time_ns()}').first)


class Handler(BaseHTTPRequestHandler):
    seen = []

    def log_message(self, *args):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        Handler.seen.append((self.path, self.headers.get('Authorization'), body))
        if self.path == '/api/agent/pair':
            ok = body['code'] == 'abcd-1234-ef56'
            self.reply(200 if ok else 400, {'token': 'f' * 64, 'user_id': 'u-1'} if ok else {'error': 'Code is not valid or has expired'})
        elif self.headers.get('Authorization') == 'Bearer ' + 'f' * 64:
            self.reply(200, {'ok': True, 'today_active_seconds': 10})
        else:
            self.reply(401, {'ok': False, 'reason': 'revoked'})

    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class PortalContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(('127.0.0.1', 0), Handler)
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def test_pair_then_report(self):
        result = api.pair_full(self.url, 'abcd-1234-ef56', 'PC-1', 'Windows 11', '1.0.0')
        self.assertEqual((result['token'], result['user_id']), ('f' * 64, 'u-1'))
        reply = api.heartbeat(self.url, result['token'], json.loads(SAMPLE_REPORT.read_text()))
        self.assertTrue(reply['ok'])
        path, auth, _ = Handler.seen[-1]
        self.assertEqual((path, auth), ('/api/agent/heartbeat', 'Bearer ' + result['token']))

    def test_wrong_code_and_revoked_token(self):
        with self.assertRaises(api.ApiError) as wrong:
            api.pair(self.url, 'nope', 'PC-1', '', '')
        self.assertIn('not valid', str(wrong.exception))
        with self.assertRaises(api.ApiError) as revoked:
            api.heartbeat(self.url, 'e' * 64, {})
        self.assertTrue(revoked.exception.revoked)

    def test_https_required_for_remote_servers(self):
        with self.assertRaises(api.ApiError):
            api.normalize_server('http://portal.example.com')
        self.assertEqual(api.normalize_server('portal.example.com/'), 'https://portal.example.com')
        self.assertEqual(api.normalize_server('http://localhost:3100'), 'http://localhost:3100')


class SavedToken(unittest.TestCase):
    def test_round_trip_and_not_stored_in_plain_text(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'config.json'
            storage.save('https://p.example', 'secret-token-value', path, user_id='u-1')
            if sys.platform == 'win32':
                self.assertNotIn('secret-token-value', path.read_text())
            self.assertEqual(storage.load(path), ('https://p.example', 'secret-token-value'))
            self.assertEqual(storage.load_config(path)['user_id'], 'u-1')
            storage.clear(path)
            self.assertIsNone(storage.load(path))


if __name__ == '__main__':
    unittest.main()
