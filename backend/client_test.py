import json
import socketio

# ----------------------------------------------------------------------
# Configuração de exibição:
# Use "json" para ver o JSON completo/formatado
# Use "line" para ver apenas a linha resumida
# ----------------------------------------------------------------------
PRINT_MODE = "json"

# IP do robô na rede Hotspot (mude para "http://localhost:8765" se rodar na própria Rasp)
ROBOT_URL = "http://10.42.0.1:8765"

sio = socketio.Client()


@sio.event
def connect():
    print("✅ Conectado ao servidor WebSocket!")


@sio.event
def disconnect():
    print("❌ Desconectado do servidor.")


@sio.on("telemetry")
def on_telemetry(data):
    if PRINT_MODE == "json":
        # Imprime o dicionário formatado como JSON estruturado
        print(json.dumps(data, indent=2))
    else:
        # Imprime os dados formatados em linha única
        orient = data["orientation"]
        vel = data["linear_velocity"]
        gyro = data["gyro"]
        accel = data["accel"]

        print(
            f"Recebido -> Roll: {orient['roll']:.1f}° | Pitch: {orient['pitch']:.1f}° | Yaw: {orient['yaw']:.1f}° | "
            f"Vx: {vel['x']:.2f} m/s | Vy: {vel['y']:.2f} m/s | Vz: {vel['z']:.2f} m/s | "
            f"GyroX: {gyro['x']:.1f}°/s | GyroY: {gyro['y']:.1f}°/s | GyroZ: {gyro['z']:.1f}°/s | "
            f"AccelX: {accel['x']:.2f} m/s² | AccelY: {accel['y']:.2f} m/s² | AccelZ: {accel['z']:.2f} m/s²"
        )


if __name__ == "__main__":
    try:
        sio.connect(ROBOT_URL)
        sio.wait()
    except KeyboardInterrupt:
        print("\nCliente encerrado.")
        sio.disconnect()