"""Entry point for the doc-md Python sidecar."""

import sys

from doc_md import __version__
from doc_md.rpc import RpcServer
from doc_md import indexer
from doc_md.parser import parse_note


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

    # Parser
    server.register("parse_note", parse_note)

    # Indexer
    server.register("index_vault", indexer.index_vault)
    server.register("index_file", indexer.index_file)
    server.register("get_backlinks", indexer.get_backlinks)
    server.register("get_forward_links", indexer.get_forward_links)
    server.register("get_all_note_names", indexer.get_all_note_names)
    server.register("get_all_tags", indexer.get_all_tags)

    # Start the JSON-RPC server loop
    server.run()


if __name__ == "__main__":
    main()
