import socketio
import time

sio = socketio.Client()

@sio.event
def connect():
    print("✅ Conectado ao servidor WebSocket!")

@sio.event
def disconnect():
    print("❌ Desconectado do servidor.")

@sio.on("telemetry")
def on_telemetry(data):
    # Imprime os dados recebidos via WebSocket
    orient = data["orientation"]
    vel = data["linear_velocity"]
    print(f"Recebido -> Roll: {orient['roll']:.1f}° | Pitch: {orient['pitch']:.1f}° | Vx: {vel['x']:.2f} m/s")

if __name__ == "__main__":
    try:
        # Conecta no backend rodando localmente
        sio.connect("http://localhost:8765")
        sio.wait()
    except KeyboardInterrupt:
        print("\nCliente encerrado.")
        sio.disconnect()