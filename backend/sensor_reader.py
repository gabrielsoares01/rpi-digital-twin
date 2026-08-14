"""
sensor_reader.py
----------------
Responsável por ler os dados brutos do sensor MPU6050 (acelerômetro +
giroscópio de 3 eixos cada) via I2C, e aplicar calibração (offset/bias)
medida com o sensor parado.

Uso típico:

    from sensor_reader import SensorReader

    sensor = SensorReader()
    sensor.calibrate(samples=200)

    try:
        while True:
            data = sensor.read()
            # data = {
            #   "accel": {"x": ..., "y": ..., "z": ...},  # em m/s^2
            #   "gyro":  {"x": ..., "y": ..., "z": ...},  # em graus/s
            #   "timestamp": ...
            # }
    finally:
        sensor.close()
"""

import time
import struct
import smbus2
import logging

# Endereço padrão do MPU6050 no barramento I2C
MPU6050_ADDR = 0x68

# Registradores relevantes
PWR_MGMT_1 = 0x6B
ACCEL_XOUT_H = 0x3B

# Sensibilidades padrão (depende da configuração de escala do sensor)
# Config default: AFS_SEL=0 (+-2g) e FS_SEL=0 (+-250 graus/s)
ACCEL_SCALE = 16384.0   # LSB/g
GYRO_SCALE = 131.0      # LSB/(graus/s)

GRAVITY = 9.80665       # m/s^2

logger = logging.getLogger("sensor_reader")


class SensorReader:
    def __init__(self, bus_num=1, address=MPU6050_ADDR):
        self.bus_num = bus_num
        self.address = address
        self.bus = smbus2.SMBus(self.bus_num)

        # Acorda o sensor (por padrão ele inicia em modo sleep)
        self.bus.write_byte_data(self.address, PWR_MGMT_1, 0)
        time.sleep(0.1)

        # Offsets de calibração (bias), aplicados em toda leitura
        self.accel_offset = {"x": 0.0, "y": 0.0, "z": 0.0}
        self.gyro_offset = {"x": 0.0, "y": 0.0, "z": 0.0}

    def close(self):
        """Fecha a conexão com o barramento I2C."""
        try:
            self.bus.close()
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Leitura de baixo nível (otimizada em bloco)
    # ------------------------------------------------------------------
    def _read_raw(self):
        """
        Lê 14 bytes contínuos registrador (0x3B a 0x47):
        Acelerômetro (6 bytes) + Temperatura (2 bytes) + Giroscópio (6 bytes).
        """
        data = self.bus.read_i2c_block_data(self.address, ACCEL_XOUT_H, 14)
        
        # Unpack de 7 inteiros de 16-bits signed (big-endian)
        ax, ay, az, _temp, gx, gy, gz = struct.unpack(">7h", bytes(data))

        return {
            "accel": {
                "x": ax / ACCEL_SCALE,
                "y": ay / ACCEL_SCALE,
                "z": az / ACCEL_SCALE,
            },
            "gyro": {
                "x": gx / GYRO_SCALE,
                "y": gy / GYRO_SCALE,
                "z": gz / GYRO_SCALE,
            },
        }

    # ------------------------------------------------------------------
    # Calibração
    # ------------------------------------------------------------------
    def calibrate(self, samples=200, delay=0.005):
        """
        Deve ser chamado com o robô parado e nivelado (plano) sobre uma
        superfície estável. Calcula a média de várias leituras e usa
        isso como offset a ser subtraído das leituras futuras.
        """
        logger.info(
            f"Calibrando com {samples} amostras. Mantenha o robô parado e nivelado..."
        )

        sum_ax = sum_ay = sum_az = 0.0
        sum_gx = sum_gy = sum_gz = 0.0

        for _ in range(samples):
            raw = self._read_raw()
            sum_ax += raw["accel"]["x"]
            sum_ay += raw["accel"]["y"]
            sum_az += raw["accel"]["z"]
            sum_gx += raw["gyro"]["x"]
            sum_gy += raw["gyro"]["y"]
            sum_gz += raw["gyro"]["z"]
            time.sleep(delay)

        self.accel_offset["x"] = sum_ax / samples
        self.accel_offset["y"] = sum_ay / samples
        # Ajusta o offset em Z de forma que o valor calibrado em repouso seja ~1.0g
        self.accel_offset["z"] = (sum_az / samples) - 1.0

        self.gyro_offset["x"] = sum_gx / samples
        self.gyro_offset["y"] = sum_gy / samples
        self.gyro_offset["z"] = sum_gz / samples

        logger.info("Calibração concluída.")
        logger.info(f"  accel_offset = {self.accel_offset}")
        logger.info(f"  gyro_offset  = {self.gyro_offset}")

    # ------------------------------------------------------------------
    # Leitura pública (já calibrada e convertida para SI)
    # ------------------------------------------------------------------
    def read(self):
        """
        Retorna um dicionário com:
          - accel em m/s^2 (com offset removido, mantendo a gravidade no Z)
          - gyro em graus/s (com offset removido)
          - timestamp (time.time())
        """
        raw = self._read_raw()

        accel = {
            "x": (raw["accel"]["x"] - self.accel_offset["x"]) * GRAVITY,
            "y": (raw["accel"]["y"] - self.accel_offset["y"]) * GRAVITY,
            "z": (raw["accel"]["z"] - self.accel_offset["z"]) * GRAVITY,
        }

        gyro = {
            "x": raw["gyro"]["x"] - self.gyro_offset["x"],
            "y": raw["gyro"]["y"] - self.gyro_offset["y"],
            "z": raw["gyro"]["z"] - self.gyro_offset["z"],
        }

        return {
            "accel": accel,
            "gyro": gyro,
            "timestamp": time.time(),
        }


# ----------------------------------------------------------------------
# Teste manual
# ----------------------------------------------------------------------
if __name__ == "__main__":
    sensor = SensorReader()
    sensor.calibrate()

    try:
        while True:
            data = sensor.read()
            print(data)
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\nEncerrado pelo usuário.")
    finally:
        sensor.close()