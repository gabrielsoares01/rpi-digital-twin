"""Unit tests for websocket_server.WebSocketServer.

These tests exercise the Socket.IO event handlers and broadcast logic
directly, without opening a real network socket.
"""

from unittest.mock import AsyncMock

import pytest

from websocket_server import WebSocketServer


@pytest.fixture
def server():
    return WebSocketServer(host="127.0.0.1", port=0)


async def test_connect_event_tracks_client(server):
    await server.sio._trigger_event("connect", "/", "sid-1", {})
    assert "sid-1" in server.clients


async def test_disconnect_event_removes_client(server):
    await server.sio._trigger_event("connect", "/", "sid-1", {})
    await server.sio._trigger_event("disconnect", "/", "sid-1")
    assert "sid-1" not in server.clients


async def test_disconnect_unknown_client_is_a_noop(server):
    await server.sio._trigger_event("disconnect", "/", "never-connected")
    assert server.clients == set()


async def test_broadcast_does_nothing_without_connected_clients(server):
    server.sio.emit = AsyncMock()
    await server.broadcast({"foo": "bar"})
    server.sio.emit.assert_not_called()


async def test_broadcast_emits_telemetry_to_all_clients(server):
    server.clients = {"sid-1", "sid-2"}
    server.sio.emit = AsyncMock()
    payload = {"timestamp": 1.0, "accel": {"x": 0, "y": 0, "z": 9.81}}

    await server.broadcast(payload)

    server.sio.emit.assert_awaited_once_with("telemetry", payload)


async def test_broadcast_respects_custom_event_name(server):
    server.clients = {"sid-1"}
    server.sio.emit = AsyncMock()

    await server.broadcast({"foo": "bar"}, event_name="custom_event")

    server.sio.emit.assert_awaited_once_with("custom_event", {"foo": "bar"})


async def test_stop_without_start_is_a_noop(server):
    await server.stop()  # runner is None, must not raise
