"""
velocity_estimator.py
----------------------
Estima a velocidade linear do robô a partir da aceleração, usando:

  1. Remoção do vetor gravidade (usando a orientação estimada pelo
     orientation_filter.py).
  2. Integração numérica simples (Euler) da aceleração.
  3. ZUPT (Zero Velocity Update): zera a velocidade quando o robô está em repouso.
  4. Filtro passa-alta (leaky integrator) para evitar acúmulo de drift.
"""

import math

GRAVITY = 9.80665  # m/s^2


class VelocityEstimator:
    def __init__(
        self,
        accel_threshold=0.25,     # m/s^2 - limiar de repouso (tolerante a ruído/~1.5 deg de erro de tilt)
        gyro_threshold=3.0,       # graus/s - limiar de repouso do giroscópio
        zupt_min_samples=5,       # amostras seguidas de repouso p/ acionar ZUPT
        highpass_alpha=0.95,      # 0 < alpha < 1 (quanto mais próximo de 1, menor a atenuacao do drift)
    ):
        self.accel_threshold = accel_threshold
        self.gyro_threshold = gyro_threshold
        self.zupt_min_samples = zupt_min_samples
        self.highpass_alpha = highpass_alpha

        self.velocity = {"x": 0.0, "y": 0.0, "z": 0.0}
        self._rest_counter = 0

    def _remove_gravity(self, accel, orientation):
        """Projeta o vetor gravidade no referencial do sensor usando roll e pitch."""
        roll = math.radians(orientation["roll"])
        pitch = math.radians(orientation["pitch"])

        gx = -GRAVITY * math.sin(pitch)
        gy = GRAVITY * math.sin(roll) * math.cos(pitch)
        gz = GRAVITY * math.cos(roll) * math.cos(pitch)

        return {
            "x": accel["x"] - gx,
            "y": accel["y"] - gy,
            "z": accel["z"] - gz,
        }

    def _is_at_rest(self, accel_no_gravity, gyro):
        """Verifica se a magnitude do vetor de aceleração livre de gravidade e do giroscópio estão abaixo do limiar."""
        accel_mag = math.sqrt(
            accel_no_gravity["x"] ** 2
            + accel_no_gravity["y"] ** 2
            + accel_no_gravity["z"] ** 2
        )
        gyro_mag = math.sqrt(gyro["x"] ** 2 + gyro["y"] ** 2 + gyro["z"] ** 2)

        return accel_mag < self.accel_threshold and gyro_mag < self.gyro_threshold

    def update(self, accel, gyro, orientation, dt):
        """
        Calcula a nova velocidade estimada a partir dos dados do sensor e do tempo delta (dt).
        """
        if dt <= 0:
            return self.velocity

        accel_no_gravity = self._remove_gravity(accel, orientation)

        # --- Detecção de repouso / ZUPT ---
        if self._is_at_rest(accel_no_gravity, gyro):
            self._rest_counter += 1
        else:
            self._rest_counter = 0

        if self._rest_counter >= self.zupt_min_samples:
            # Robô parado: zera a velocidade acumulada
            self.velocity = {"x": 0.0, "y": 0.0, "z": 0.0}
            return self.velocity

        # --- Filtro Passa-Alta Integrado (Leaky Integrator) ---
        # v[k] = alpha * (v[k-1] + a * dt)
        alpha = self.highpass_alpha
        self.velocity = {
            "x": alpha * (self.velocity["x"] + accel_no_gravity["x"] * dt),
            "y": alpha * (self.velocity["y"] + accel_no_gravity["y"] * dt),
            "z": alpha * (self.velocity["z"] + accel_no_gravity["z"] * dt),
        }

        return self.velocity

    def get_velocity(self):
        return self.velocity


if __name__ == "__main__":
    estimator = VelocityEstimator()
    orientation_flat = {"roll": 0.0, "pitch": 0.0, "yaw": 0.0}

    # Simulação 1: Robô parado
    accel_rest = {"x": 0.0, "y": 0.0, "z": 9.80665}
    gyro_rest = {"x": 0.0, "y": 0.0, "z": 0.0}

    print("--- Teste Parado ---")
    for i in range(7):
        v = estimator.update(accel_rest, gyro_rest, orientation_flat, dt=0.05)
        print(f"passo {i}: vx={v['x']:.4f}, vy={v['y']:.4f}, vz={v['z']:.4f}")

    # Simulação 2: Impulso em X
    print("\n--- Teste Movimento em X ---")
    accel_move = {"x": 1.0, "y": 0.0, "z": 9.80665}
    for i in range(5):
        v = estimator.update(accel_move, gyro_rest, orientation_flat, dt=0.05)
        print(f"passo {i}: vx={v['x']:.4f}, vy={v['y']:.4f}, vz={v['z']:.4f}")