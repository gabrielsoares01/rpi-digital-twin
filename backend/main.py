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
import os
import multiprocessing
import logging
from logger import setup_logger

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

class CPUUsageTracker:
    def __init__(self):
        self.last_time = time.time()
        self.last_cpu_time = sum(os.times()[:2])

    def get_cpu_usage(self):
        now = time.time()
        cpu_now = sum(os.times()[:2])
        dt = now - self.last_time
        dcpu = cpu_now - self.last_cpu_time
        
        self.last_time = now
        self.last_cpu_time = cpu_now
        
        if dt <= 0:
            return 0.0
        
        cores = multiprocessing.cpu_count()
        usage = (dcpu / dt) * 100 / cores
        return round(min(100.0, usage), 2)

def get_memory_usage_mb():
    try:
        with open("/proc/self/status", "r") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    parts = line.split()
                    return round(float(parts[1]) / 1024, 2)
    except Exception:
        try:
            import resource
            # ru_maxrss is in KB on Linux, but bytes on macOS
            factor = 1024.0
            if os.uname().sysname == 'Darwin':
                factor = 1024.0 * 1024.0
            return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / factor, 2)
        except Exception:
            return 0.0

def round_dict(d, decimals=3):
    return {k: round(v, decimals) for k, v in d.items()}


async def main():
    sensor = None
    server = None

    try:
        # Pre-initialize websocket server to bind to logger
        server = WebSocketServer(host=WS_HOST, port=WS_PORT)

        # Setup structured logging
        setup_logger(level=logging.INFO, server=server)
        logger = logging.getLogger("main")

        logger.info("Inicializando sensor...")
        sensor = SensorReader()
        sensor.calibrate(samples=CALIBRATION_SAMPLES)

        orientation_filter = ComplementaryFilter(alpha=0.96)
        velocity_estimator = VelocityEstimator()

        logger.info(f"Iniciando servidor WebSocket em ws://{WS_HOST}:{WS_PORT}")
        await server.start()

        loop_period = 1.0 / LOOP_FREQUENCY_HZ
        
        # Leitura inicial para estabilizar o timestamp de delta t (dt)
        first_reading = sensor.read()
        last_time = first_reading["timestamp"]

        logger.info("Loop principal iniciado. Pressione Ctrl+C para encerrar.")

        # Batch telemetry buffer (10Hz transmission)
        payload_buffer = []

        # Performance monitoring metrics
        cpu_tracker = CPUUsageTracker()
        last_metrics_time = time.time()
        processed_frames = 0
        loop_latencies = []

        while True:
            iter_start = time.time()

            # --- 1. Leitura do sensor com proteção de ruído I2C ---
            try:
                reading = sensor.read()
            except Exception as err:
                logger.warning(f"Erro de leitura no I2C ({err}). Ignorando frame...")
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
            payload_buffer.append(payload)

            # --- 6. Transmite em lotes a 10Hz (5 * 20ms = 100ms) ---
            if len(payload_buffer) >= 5:
                await server.broadcast(payload_buffer)
                payload_buffer = []

            # --- 7. Monitoramento de desempenho e coleta de métricas (1Hz) ---
            elapsed = time.time() - iter_start
            loop_latencies.append(elapsed)
            processed_frames += 1

            now_metrics = time.time()
            if now_metrics - last_metrics_time >= 1.0:
                dt_metrics = now_metrics - last_metrics_time
                throughput = processed_frames / dt_metrics
                avg_latency = sum(loop_latencies) / len(loop_latencies) if loop_latencies else 0.0
                max_latency = max(loop_latencies) if loop_latencies else 0.0
                
                # Fetch system resources
                cpu_usage = cpu_tracker.get_cpu_usage()
                mem_usage = get_memory_usage_mb()

                metrics_payload = {
                    "timestamp": now_metrics,
                    "cpu_usage_pct": cpu_usage,
                    "memory_usage_mb": mem_usage,
                    "avg_latency_ms": round(avg_latency * 1000, 3),
                    "max_latency_ms": round(max_latency * 1000, 3),
                    "throughput_fps": round(throughput, 1),
                    "client_count": len(server.clients),
                    "queue_backlog_len": 0, # develops doesn't have queue backlog yet, keep 0
                }
                
                await server.broadcast(metrics_payload, event_name="system_metrics")

                # Reset counters
                last_metrics_time = now_metrics
                processed_frames = 0
                loop_latencies.clear()

            # --- 8. Controle do tempo do loop ---
            sleep_time = max(0.0, loop_period - elapsed)
            await asyncio.sleep(sleep_time)

    except KeyboardInterrupt:
        logger.info("Encerrando por interrupção do usuário...")
    except Exception as e:
        logger.error(f"Erro fatal: {e}")
    finally:
        logger.info("Limpando recursos...")
        if server:
            await server.stop()
        if sensor:
            sensor.close()
        logger.info("Sistema encerrado com sucesso.")


if __name__ == "__main__":
    asyncio.run(main())