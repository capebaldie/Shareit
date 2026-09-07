"""Run: python test_local_ips.py"""
import socket
from unittest.mock import patch

import server


def ips(hostname_ips, route_ip):
    """Simulate get_local_ips() on a machine with these adapters."""
    addrinfo = [(None, None, None, None, (ip, 0)) for ip in hostname_ips]

    class FakeSock:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def connect(self, addr): pass
        def getsockname(self): 
            if route_ip is None:
                raise OSError("no route")
            return (route_ip, 0)

    with patch.object(socket, "getaddrinfo", return_value=addrinfo), \
         patch.object(socket, "socket", lambda *a, **k: FakeSock()):
        return server.get_local_ips()


# Windows with VirtualBox + Docker + Hyper-V, real Wi-Fi on the Windows hotspot range.
# Numeric ranking alone picks 192.168.56.1 (VirtualBox) -- unreachable from a phone.
adapters = ["192.168.56.1", "192.168.65.3", "172.28.112.1", "192.168.137.1"]
assert ips(adapters, "192.168.137.1")[0] == "192.168.137.1", ips(adapters, "192.168.137.1")

# Same box, ordinary home Wi-Fi.
adapters = ["192.168.56.1", "172.28.112.1", "192.168.1.7"]
assert ips(adapters, "192.168.1.7")[0] == "192.168.1.7", ips(adapters, "192.168.1.7")

# No default route (isolated network): falls back to the old ranking, still usable.
assert ips(["192.168.1.7"], None)[0] == "192.168.1.7"

# Nothing at all.
assert ips([], None) == ["127.0.0.1"]

# Every adapter stays listed as a fallback, route IP just leads.
out = ips(["192.168.56.1", "192.168.1.7"], "192.168.1.7")
assert out == ["192.168.1.7", "192.168.56.1"], out

print("all ok")
