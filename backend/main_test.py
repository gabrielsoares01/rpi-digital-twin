"""
main_test.py
------------
Script de teste isolado para o backend.
Lê os dados do MPU6050, calcula a orientação e velocidade, 
e imprime os resultados no terminal (sem necessidade de WebSocket).

Para rodar:
    python3 main_test.py
"""

import time
import json
from sensor_reader import SensorReader
from orientation_filter import ComplementaryFilter
from velocity_estimator import VelocityEstimator

# ----------------------------------------------------------------------
# Configurações de Teste
# ----------------------------------------------------------------------
LOOP_FREQUENCY_HZ = 50          # Frequência de processamento (50 Hz)
CALIBRATION_SAMPLES = 200       # Amostras para calibração inicial
PRINT_MODE = "json"             # Escolha "line" para linha única ou "json" para bloco JSON


def main():
    sensor = None
    try:
        print("[main_test] Inicializando sensor...")
        sensor = SensorReader()
        sensor.calibrate(samples=CALIBRATION_SAMPLES)

        orientation_filter = ComplementaryFilter(alpha=0.96)
        velocity_estimator = VelocityEstimator()

        loop_period = 1.0 / LOOP_FREQUENCY_HZ
        first_reading = sensor.read()
        last_time = first_reading["timestamp"]
        frame_count = 0

        print("\n[main_test] Loop de teste iniciado. Pressione Ctrl+C para encerrar.\n")

        while True:
            iter_start = time.time()

            # 1. Leitura do sensor
            try:
                reading = sensor.read()
            except Exception as err:
                print(f"\n[main_test] Erro I2C: {err}")
                time.sleep(loop_period)
                continue

            accel = reading["accel"]
            gyro = reading["gyro"]

            # 2. Cálculo de dt
            now = reading["timestamp"]
            dt = now - last_time
            last_time = now

            if dt <= 0 or dt > 0.2:
                dt = loop_period

            # 3. Processamento de orientação e velocidade
            orientation = orientation_filter.update(accel, gyro, dt=dt)
            linear_velocity = velocity_estimator.update(accel, gyro, orientation, dt=dt)

            # 4. Montagem do payload de telemetria
            payload = {
                "timestamp": now,
                "gyro": gyro,
                "accel": accel,
                "linear_velocity": linear_velocity,
                "orientation": orientation,
            }

            # 5. Exibição no terminal (atualiza a ~5 Hz)
            frame_count += 1
            if frame_count % 10 == 0:
                if PRINT_MODE == "json":
                    # Exibe o JSON bruto e formatado
                    print(json.dumps(payload, indent=2))
                else:
                    # Exibe em linha única (sobrescreve a linha anterior no terminal)
                    print(
                        f"\r[IMU TEST] "
                        f"Roll: {orientation['roll']:6.1f}° | "
                        f"Pitch: {orientation['pitch']:6.1f}° | "
                        f"Yaw: {orientation['yaw']:6.1f}° | "
                        f"Vx: {linear_velocity['x']:6.2f} m/s | "
                        f"Vy: {linear_velocity['y']:6.2f} m/s",
                        end="",
                        flush=True
                    )

            # 6. Controle do tempo do loop (50 Hz)
            elapsed = time.time() - iter_start
            time.sleep(max(0.0, loop_period - elapsed))

    except KeyboardInterrupt:
        print("\n\n[main_test] Teste interrompido pelo usuário.")
    except Exception as e:
        print(f"\n\n[main_test] Erro no teste: {e}")
    finally:
        if sensor:
            sensor.close()
        print("[main_test] Conexão com o sensor fechada.")


if __name__ == "__main__":
    main()