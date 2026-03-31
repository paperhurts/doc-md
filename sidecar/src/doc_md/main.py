"""Entry point for the doc-md Python sidecar."""

import sys

from doc_md import __version__
from doc_md.rpc import RpcServer


def ping() -> str:
    """Health check — returns version string."""
    return f"doc-md sidecar v{__version__}"


def echo(message: str = "") -> str:
    """Echo back a message (for testing)."""
    return message


def get_version() -> dict:
    """Return version info."""
    return {
        "version": __version__,
        "python": sys.version,
    }


def main() -> None:
    server = RpcServer()

    # Core methods
    server.register("ping", ping)
    server.register("echo", echo)
    server.register("get_version", get_version)

    # Start the JSON-RPC server loop
    server.run()


if __name__ == "__main__":
    main()
