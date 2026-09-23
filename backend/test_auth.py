"""Run: python test_auth.py"""
from types import SimpleNamespace

from fastapi import HTTPException

import server


def request(host, header=None, query=None):
    """The three things require_token() reads off a Request."""
    return SimpleNamespace(
        client=SimpleNamespace(host=host) if host else None,
        headers={"x-shareit-token": header} if header else {},
        query_params={"t": query} if query else {},
    )


def rejected(req) -> bool:
    try:
        server.require_token(req)
        return False
    except HTTPException as exc:
        return exc.status_code == 401


TOKEN = server.AUTH_TOKEN

# The host machine owns the files; a loopback request cannot come from another device.
server.require_token(request("127.0.0.1"))
server.require_token(request("::1"))

# Phones pair by header, or by ?t= for <a href>/<img src>, which cannot carry one.
server.require_token(request("192.168.1.7", header=TOKEN))
server.require_token(request("192.168.1.7", query=TOKEN))

# Everyone else on the Wi-Fi.
assert rejected(request("192.168.1.9"))
assert rejected(request("192.168.1.9", header="wrong"))
assert rejected(request("192.168.1.9", header=TOKEN + "x"))
assert rejected(request("192.168.1.9", query=""))

# compare_digest raises TypeError on non-ASCII str, and the caller picks the string.
assert rejected(request("192.168.1.9", header="tökén"))

# No client info at all is not a reason to trust the caller.
assert rejected(request(None))
assert rejected(request("not-an-ip"))

print("all ok")
