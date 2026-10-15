import json
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from repairme_agent import api, storage  # noqa: E402
from repairme_agent.activity import ActivityTracker, Sample  # noqa: E402
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

    def test_foreground_change_without_input_is_not_stable(self):
        t = ActivityTracker()
        for i in range(60):
            t.feed(sample(5 * (i + 1), idle=900, app='a.exe' if i < 30 else 'b.exe'))
        self.assertEqual(t.state, 'active')

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


class FakeSystem:
    def __init__(self):
        self.now = 1000.0
        self.reports = []

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
        self.reports.append(payload)
        return {'ok': True, 'today_active_seconds': 123}


class WorkerBehaviour(unittest.TestCase):
    def make(self):
        f = FakeSystem()
        w = Worker('https://p.example', 't' * 64, sampler=f.sampler, machine=f.machine, processes=f.processes, send=f.send, clock=f.clock)
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

    def test_failed_send_does_not_resend_time(self):
        f, w = self.make()

        def fail(server, token, payload):
            raise api.ApiError('down')

        w.send = fail
        for _ in range(7):
            w.step()
        self.assertFalse(w.online)
        w.send = f.send
        for _ in range(7):
            w.step()
        self.assertLessEqual(f.reports[-1]['active_seconds'], 30)

    def test_revoked_device_stops_the_worker(self):
        f, w = self.make()

        def revoked(server, token, payload):
            raise api.ApiError('revoked', 401, True)

        w.send = revoked
        for _ in range(7):
            w.step()
        self.assertTrue(w.revoked)


class Handler(BaseHTTPRequestHandler):
    seen = []

    def log_message(self, *args):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        Handler.seen.append((self.path, self.headers.get('Authorization'), body))
        if self.path == '/api/agent/pair':
            ok = body['code'] == 'abcd-1234-ef56'
            self.reply(200 if ok else 400, {'token': 'f' * 64} if ok else {'error': 'Code is not valid or has expired'})
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
        token = api.pair(self.url, 'abcd-1234-ef56', 'PC-1', 'Windows 11', '1.0.0')
        self.assertEqual(token, 'f' * 64)
        result = api.heartbeat(self.url, token, json.loads(SAMPLE_REPORT.read_text()))
        self.assertTrue(result['ok'])
        path, auth, _ = Handler.seen[-1]
        self.assertEqual((path, auth), ('/api/agent/heartbeat', 'Bearer ' + token))

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
            storage.save('https://p.example', 'secret-token-value', path)
            if sys.platform == 'win32':
                self.assertNotIn('secret-token-value', path.read_text())
            self.assertEqual(storage.load(path), ('https://p.example', 'secret-token-value'))
            storage.clear(path)
            self.assertIsNone(storage.load(path))


if __name__ == '__main__':
    unittest.main()
