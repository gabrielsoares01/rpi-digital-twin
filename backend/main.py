"""
main.py
--------
Orquestra o loop principal do backend:

  1. Lê os dados brutos do MPU6050 (sensor_reader.py)
  2. Atualiza a estimativa de orientação (orientation_filter.py)
  3. Usa a orientação para remover a gravidade e estimar a velocidade
     linear (velocity_estimator.py), já com ZUPT e filtro passa-alta
  4. Monta o JSON final e faz broadcast via WebSocket para os clientes
     (websocket_server.py)

Para rodar (na Raspberry Pi, com o MPU6050 conectado via I2C):

    python3 main.py
"""

import asyncio
import time

from sensor_reader import SensorReader
from orientation_filter import ComplementaryFilter
from velocity_estimator import VelocityEstimator
from websocket_server import WebSocketServer

# ----------------------------------------------------------------------
# Configurações gerais
# ----------------------------------------------------------------------
LOOP_FREQUENCY_HZ = 50          # 50 Hz (20ms por ciclo) -> Ideal para filtros IMU
CALIBRATION_SAMPLES = 200       # Amostras usadas na calibração inicial
WS_HOST = "0.0.0.0"
WS_PORT = 8765


def round_dict(d, decimals=3):
    return {k: round(v, decimals) for k, v in d.items()}


async def main():
    sensor = None
    server = None

    try:
        # --- Inicialização dos módulos ---
        print("[main] Inicializando sensor...")
        sensor = SensorReader()
        sensor.calibrate(samples=CALIBRATION_SAMPLES)

        orientation_filter = ComplementaryFilter(alpha=0.96)
        velocity_estimator = VelocityEstimator()

        print(f"[main] Iniciando servidor WebSocket em ws://{WS_HOST}:{WS_PORT}")
        server = WebSocketServer(host=WS_HOST, port=WS_PORT)
        await server.start()

        loop_period = 1.0 / LOOP_FREQUENCY_HZ
        
        # Leitura inicial para estabilizar o timestamp de delta t (dt)
        first_reading = sensor.read()
        last_time = first_reading["timestamp"]

        print("[main] Loop principal iniciado. Pressione Ctrl+C para encerrar.")

        while True:
            iter_start = time.time()

            # --- 1. Leitura do sensor com proteção de ruído I2C ---
            try:
                reading = sensor.read()
            except Exception as err:
                print(f"[main] Alerta: Erro de leitura no I2C ({err}). Ignorando frame...")
                await asyncio.sleep(loop_period)
                continue

            accel = reading["accel"]
            gyro = reading["gyro"]

            # --- 2. Cálculo do dt real entre leituras ---
            now = reading["timestamp"]
            dt = now - last_time
            last_time = now

            # Trava de segurança para dts anômalos
            if dt <= 0 or dt > 0.2:
                dt = loop_period

            # --- 3. Atualiza orientação ---
            orientation = orientation_filter.update(accel, gyro, dt=dt)

            # --- 4. Atualiza velocidade linear ---
            linear_velocity = velocity_estimator.update(
                accel, gyro, orientation, dt=dt
            )

            # --- 5. Monta o pacote de dados otimizado ---
            payload = {
                "timestamp": round(now, 4),
                "gyro": round_dict(gyro, 3),
                "accel": round_dict(accel, 3),
                "linear_velocity": round_dict(linear_velocity, 3),
                "orientation": round_dict(orientation, 3),
            }

            # --- 6. Transmite aos clientes conectados ---
            await server.broadcast(payload)

            # --- 7. Controle do tempo do loop ---
            elapsed = time.time() - iter_start
            sleep_time = max(0.0, loop_period - elapsed)
            await asyncio.sleep(sleep_time)

    except KeyboardInterrupt:
        print("\n[main] Encerrando por interrupção do usuário...")
    except Exception as e:
        print(f"\n[main] Erro fatal: {e}")
    finally:
        print("[main] Limpando recursos...")
        if server:
            await server.stop()
        if sensor:
            sensor.close()
        print("[main] Sistema encerrado com sucesso.")


if __name__ == "__main__":
    asyncio.run(main())