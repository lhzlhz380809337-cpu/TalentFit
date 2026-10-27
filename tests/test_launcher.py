"""Exercise the shipped ZIP in a clean Chinese path without installed runtimes."""
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import tempfile
import time
import unittest
from urllib.request import urlopen
import zipfile

ROOT = Path(__file__).resolve().parent.parent

class LauncherTest(unittest.TestCase):
    @unittest.skipUnless(os.name == 'nt', 'Windows launcher')
    def test_portable_launch_and_reuse(self):
        archive_path = ROOT / 'release' / 'TalentFit-Windows-x64.zip'
        self.assertTrue(archive_path.is_file(), 'Run desktop/package.ps1 first')
        with tempfile.TemporaryDirectory(prefix='TalentFit 中文 空格 ') as temporary:
            with zipfile.ZipFile(archive_path) as archive:
                self.assertFalse(any('/data/' in n or '/logs/' in n or n.endswith('.env') for n in archive.namelist()))
                archive.extractall(temporary)
            root = Path(temporary) / 'TalentFit'
            environment = dict(os.environ, PATH='', TF_API_KEY='must-not-leak')
            occupied = socket.socket()
            try:
                occupied.bind(('127.0.0.1', 17840))
                occupied.listen()
            except OSError:
                occupied.close()
                occupied = None
            process = subprocess.Popen([str(root / 'TalentFit.exe'), '--smoke-test', '--hold'], cwd=root, env=environment, creationflags=subprocess.CREATE_NO_WINDOW)
            try:
                marker = root / 'logs' / 'smoke-result.txt'
                deadline = time.monotonic() + 30
                while not marker.exists() and time.monotonic() < deadline:
                    self.assertIsNone(process.poll(), 'Launcher exited early')
                    time.sleep(.1)
                self.assertTrue(marker.exists(), 'Launcher did not become ready')
                port = int(re.search(r'port=(\d+)', marker.read_text()).group(1))
                self.assertNotEqual(port, 17840)
                base = f'http://127.0.0.1:{port}'
                def get(path):
                    with urlopen(base + path, timeout=2) as response:
                        return json.load(response)
                self.assertEqual(get('/api/health')['app'], 'TalentFit')
                self.assertEqual(len(get('/api/templates')['data']), 7)
                self.assertEqual(get('/api/jobs')['data'], [])
                with urlopen(base, timeout=2) as response:
                    self.assertIn(b'<div id="root">', response.read())
                second = subprocess.run([str(root / 'TalentFit.exe'), '--smoke-test'], cwd=root, env=environment, timeout=10, creationflags=subprocess.CREATE_NO_WINDOW)
                self.assertEqual(second.returncode, 0)
                self.assertIn(f'port={port}', (root / 'logs' / 'reuse-result.txt').read_text())
                self.assertIsNone(process.poll())
                self.assertEqual(get('/api/health')['app'], 'TalentFit')
                self.assertEqual(process.wait(timeout=15), 0)
                with self.assertRaises(OSError):
                    urlopen(base + '/api/health', timeout=1)
                self.assertTrue((root / 'data' / 'talentfit.db').is_file())
                if occupied:
                    self.assertEqual(occupied.getsockname()[1], 17840)
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()
                if occupied:
                    occupied.close()

if __name__ == '__main__':
    unittest.main()
