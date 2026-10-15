"""Keeps the portal address and this PC's private token. On Windows the token is encrypted for this user."""
from __future__ import annotations

import base64
import ctypes
import json
import os
import sys
from ctypes import wintypes
from pathlib import Path

IS_WINDOWS = sys.platform == 'win32'


def config_path() -> Path:
    base = os.environ.get('APPDATA') or str(Path.home())
    return Path(base) / 'RepairMeAgent' / 'config.json'


class _Blob(ctypes.Structure):
    _fields_ = [('cbData', wintypes.DWORD), ('pbData', ctypes.POINTER(ctypes.c_char))]


def _blob(data: bytes) -> tuple[_Blob, object]:
    buffer = ctypes.create_string_buffer(data, len(data))
    return _Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_char))), buffer


def protect(data: bytes) -> bytes:
    if not IS_WINDOWS:
        return data
    out = _Blob()
    source, keep = _blob(data)
    if not ctypes.windll.crypt32.CryptProtectData(
        ctypes.byref(source), 'RepairMeAgent', None, None, None, 0, ctypes.byref(out)
    ):
        raise OSError('Unable to protect the token')
    del keep
    try:
        return ctypes.string_at(out.pbData, out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(out.pbData)


def unprotect(data: bytes) -> bytes:
    if not IS_WINDOWS:
        return data
    out = _Blob()
    source, keep = _blob(data)
    if not ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(source), None, None, None, None, 0, ctypes.byref(out)
    ):
        raise OSError('Unable to read the saved token')
    del keep
    try:
        return ctypes.string_at(out.pbData, out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(out.pbData)


def save(server: str, token: str, path: Path | None = None, **extra: str) -> None:
    path = path or config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = base64.b64encode(protect(token.encode())).decode()
    path.write_text(json.dumps({'server': server, 'token': encoded, **extra}))
    if not IS_WINDOWS:
        path.chmod(0o600)


def load(path: Path | None = None) -> tuple[str, str] | None:
    path = path or config_path()
    try:
        raw = json.loads(path.read_text())
        return raw['server'], unprotect(base64.b64decode(raw['token'])).decode()
    except (OSError, ValueError, KeyError):
        return None


def load_config(path: Path | None = None) -> dict | None:
    """Everything saved: server, token and the account the computer was connected for."""
    path = path or config_path()
    try:
        raw = json.loads(path.read_text())
        raw['token'] = unprotect(base64.b64decode(raw['token'])).decode()
        raw['server']
        return raw
    except (OSError, ValueError, KeyError):
        return None


def clear(path: Path | None = None) -> None:
    try:
        (path or config_path()).unlink()
    except OSError:
        pass
