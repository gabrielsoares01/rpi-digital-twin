"""
websocket_server.py
---------------------
Servidor Socket.IO que mantém a lista de clientes conectados (dashboard
e gêmeo digital) e envia (broadcast) o JSON de telemetria toda vez que
main.py chama `broadcast(data)`.

Os dados são transmitidos através do evento chamado "telemetry".

JSON enviado para os clientes:

{
    "timestamp": 1690000000.123,
    "gyro":  {"x": 0.1, "y": -0.2, "z": 1.3},
    "accel": {"x": 0.05, "y": 0.01, "z": 9.81},
    "linear_velocity": {"x": 0.5, "y": 0.0, "z": 0.0},
    "orientation": {"roll": 1.2, "pitch": -0.5, "yaw": 45.0}
}
"""

import asyncio
import socketio
from aiohttp import web


class WebSocketServer:
    def __init__(self, host="0.0.0.0", port=8765):
        self.host = host
        self.port = port
        
        # Instancia o servidor Socket.IO com suporte a CORS liberado para o frontend
        self.sio = socketio.AsyncServer(
            async_mode="aiohttp",
            cors_allowed_origins="*"
        )
        self.app = web.Application()
        self.sio.attach(self.app)

        self.runner = None
        self.site = None
        self.clients = set()

        self._register_events()

    def _register_events(self):
        @self.sio.event
        async def connect(sid, environ):
            self.clients.add(sid)
            print(f"[SocketIOServer] Cliente conectado: {sid} (total: {len(self.clients)})")

        @self.sio.event
        async def disconnect(sid):
            self.clients.discard(sid)
            print(f"[SocketIOServer] Cliente desconectado: {sid} (total: {len(self.clients)})")

    async def start(self):
        """Sobe o servidor HTTP + Socket.IO na porta especificada."""
        self.runner = web.AppRunner(self.app)
        await self.runner.setup()
        self.site = web.TCPSite(self.runner, self.host, self.port)
        await self.site.start()
        print(f"[SocketIOServer] Servidor rodando em http://{self.host}:{self.port}")

    async def broadcast(self, data: dict, event_name: str = "telemetry"):
        """
        Envia o dicionário `data` via evento Socket.IO para todos os clientes conectados.
        """
        if not self.clients:
            return  # ninguém conectado, não faz nada

        await self.sio.emit(event_name, data)

    async def stop(self):
        """Encerra o servidor web aiohttp."""
        if self.runner is not None:
            await self.runner.cleanup()
            print("[SocketIOServer] Servidor encerrado.")


# ----------------------------------------------------------------------
# Teste manual: sobe o servidor e envia dados falsos a cada 0.5s.
# ----------------------------------------------------------------------
if __name__ == "__main__":
    import time

    server = WebSocketServer()

    async def fake_loop():
        await server.start()
        while True:
            fake_data = {
                "timestamp": time.time(),
                "gyro": {"x": 0.0, "y": 0.0, "z": 0.0},
                "accel": {"x": 0.0, "y": 0.0, "z": 9.81},
                "linear_velocity": {"x": 0.0, "y": 0.0, "z": 0.0},
                "orientation": {"roll": 0.0, "pitch": 0.0, "yaw": 0.0},
            }
            await server.broadcast(fake_data)
            print("Broadcast enviado:", fake_data)
            await asyncio.sleep(0.5)

    try:
        asyncio.run(fake_loop())
    except KeyboardInterrupt:
        print("\n[Teste] Encerrando por interrupção...")