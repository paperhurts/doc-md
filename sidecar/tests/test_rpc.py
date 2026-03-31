"""Tests for the JSON-RPC server."""

import json

from doc_md.rpc import RpcServer


def _make_request(method: str, params=None, req_id: int = 1) -> str:
    req = {"jsonrpc": "2.0", "id": req_id, "method": method}
    if params is not None:
        req["params"] = params
    return json.dumps(req)


def test_register_and_call():
    server = RpcServer()
    server.register("add", lambda a, b: a + b)

    data = json.loads(_make_request("add", {"a": 2, "b": 3}))
    response = server._handle_request(data)
    parsed = json.loads(response)

    assert parsed["result"] == 5
    assert parsed["id"] == 1


def test_method_not_found():
    server = RpcServer()

    data = json.loads(_make_request("nonexistent"))
    response = server._handle_request(data)
    parsed = json.loads(response)

    assert parsed["error"]["code"] == -32601
    assert "not found" in parsed["error"]["message"].lower()


def test_handler_error():
    server = RpcServer()
    server.register("fail", lambda: 1 / 0)

    data = json.loads(_make_request("fail"))
    response = server._handle_request(data)
    parsed = json.loads(response)

    assert parsed["error"]["code"] == -32000
    assert "division by zero" in parsed["error"]["message"]


def test_ping():
    from doc_md.main import ping

    result = ping()
    assert "doc-md sidecar" in result
