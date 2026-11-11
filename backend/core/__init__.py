# backend/core/__init__.py

import socket

# Force Python's socket library to prefer IPv4 over IPv6 on cloud containers
_orig_getaddrinfo = socket.getaddrinfo

def _getaddrinfo_ipv4_only(host, port, family=0, type=0, proto=0, flags=0):
    # If the protocol family is unconstrained (0), force AF_INET (IPv4)
    if family == 0:
        family = socket.AF_INET
    return _orig_getaddrinfo(host, port, family, type, proto, flags)

socket.getaddrinfo = _getaddrinfo_ipv4_only