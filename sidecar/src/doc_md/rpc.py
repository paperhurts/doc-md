"""JSON-RPC 2.0 protocol handler over stdin/stdout."""

import json
import sys
from typing import Any, Callable

HandlerFn = Callable[..., Any]


class RpcServer:
    """A simple JSON-RPC 2.0 server that reads from stdin and writes to stdout."""

    def __init__(self) -> None:
        self._handlers: dict[str, HandlerFn] = {}

    def register(self, method: str, handler: HandlerFn) -> None:
        """Register a handler for a JSON-RPC method."""
        self._handlers[method] = handler

    def _make_response(self, id: int | None, result: Any = None, error: dict | None = None) -> str:
        resp: dict[str, Any] = {"jsonrpc": "2.0", "id": id}
        if error is not None:
            resp["error"] = error
        else:
            resp["result"] = result
        return json.dumps(resp)

    def _handle_request(self, data: dict) -> str | None:
        req_id = data.get("id")
        method = data.get("method", "")
        params = data.get("params", {})

        # JSON-RPC 2.0: notifications (no "id") must not receive a reply
        if "id" not in data:
            handler = self._handlers.get(method)
            if handler is not None:
                try:
                    if isinstance(params, dict):
                        handler(**params)
                    elif isinstance(params, list):
                        handler(*params)
                    else:
                        handler()
                except Exception:
                    pass
            return None

        handler = self._handlers.get(method)
        if handler is None:
            return self._make_response(
                req_id,
                error={"code": -32601, "message": f"Method not found: {method}"},
            )

        try:
            if isinstance(params, dict):
                result = handler(**params)
            elif isinstance(params, list):
                result = handler(*params)
            else:
                result = handler()
            return self._make_response(req_id, result=result)
        except Exception as e:
            return self._make_response(
                req_id,
                error={"code": -32000, "message": str(e)},
            )

    def run(self) -> None:
        """Main loop: read JSON-RPC requests from stdin, write responses to stdout."""
        # Use readline() instead of iterating sys.stdin to avoid read-ahead buffering
        # that causes latency when requests arrive slowly.
        while True:
            line = sys.stdin.readline()
            if not line:
                break
            line = line.strip()
            if not line:
                continue

            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                response = self._make_response(
                    None,
                    error={"code": -32700, "message": "Parse error"},
                )
                sys.stdout.write(response + "\n")
                sys.stdout.flush()
                continue

            response = self._handle_request(data)
            if response is not None:
                sys.stdout.write(response + "\n")
                sys.stdout.flush()
