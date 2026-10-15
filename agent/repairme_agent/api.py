"""Talks to the RepairMe portal over HTTPS."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request


class ApiError(Exception):
    def __init__(self, message: str, status: int = 0, revoked: bool = False) -> None:
        super().__init__(message)
        self.status = status
        self.revoked = revoked


def normalize_server(url: str) -> str:
    url = url.strip().rstrip('/')
    if '://' not in url:
        url = 'https://' + url
    parts = urllib.parse.urlparse(url)
    local = parts.hostname in ('localhost', '127.0.0.1')
    if not parts.hostname:
        raise ApiError('Enter the portal address, for example https://yourcompany.netlify.app')
    if parts.scheme != 'https' and not local:
        raise ApiError('The portal address must start with https://')
    return f'{parts.scheme}://{parts.netloc}'


def _post(url: str, body: dict, token: str | None = None, timeout: int = 20) -> dict:
    headers = {'Content-Type': 'application/json', 'User-Agent': 'RepairMeAgent'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    request = urllib.request.Request(url, json.dumps(body).encode(), headers, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read() or b'{}')
    except urllib.error.HTTPError as error:
        try:
            detail = json.loads(error.read() or b'{}')
        except ValueError:
            detail = {}
        message = detail.get('error') or detail.get('reason') or f'Server answered {error.code}'
        revoked = error.code == 401 and detail.get('reason') in ('revoked', 'inactive', 'invalid')
        raise ApiError(message, error.code, revoked) from None
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise ApiError(f'Cannot reach the portal: {getattr(error, "reason", error)}') from None


def pair(server: str, code: str, device_name: str, os_name: str, version: str) -> str:
    result = _post(
        normalize_server(server) + '/api/agent/pair',
        {'code': code.strip(), 'device_name': device_name, 'os': os_name, 'agent_version': version},
    )
    token = result.get('token')
    if not token:
        raise ApiError('The portal did not return a token')
    return token


def heartbeat(server: str, token: str, report: dict) -> dict:
    return _post(normalize_server(server) + '/api/agent/heartbeat', report, token)
