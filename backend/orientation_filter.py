"""
orientation_filter.py
----------------------
Filtro complementar para estimar a orientação (roll, pitch, yaw) do robô
a partir do acelerômetro e giroscópio.

Por que precisamos disso?
Para remover corretamente o vetor gravidade da leitura do acelerômetro
(passo necessário antes de integrar e obter velocidade linear), é preciso
saber a orientação atual do sensor. Só o giroscópio integrado sofre de
drift; só o acelerômetro é ruidoso e não capta rotação em torno do eixo
vertical (yaw). O filtro complementar combina os dois: usa o giroscópio
para variações rápidas e o acelerômetro para corrigir o drift lentamente.

Fórmula clássica do filtro complementar:

    angulo = alpha * (angulo_anterior + giro * dt) + (1 - alpha) * angulo_acc

Onde alpha é tipicamente entre 0.95 e 0.98 (confia mais no giroscópio
no curto prazo, mas deixa o acelerômetro corrigir no longo prazo).

Observação sobre Yaw:
O acelerômetro não fornece nenhuma informação sobre rotação em torno do
eixo Z (yaw), pois a gravidade não muda com essa rotação. Por isso, o yaw
aqui é estimado apenas por integração do giroscópio Z, e vai sofrer de
drift ao longo do tempo (isso é esperado sem um magnetômetro).
"""

import math
import time


class ComplementaryFilter:
    def __init__(self, alpha=0.96):
        self.alpha = alpha

        # Ângulos atuais em graus
        self.roll = 0.0
        self.pitch = 0.0
        self.yaw = 0.0

        self._last_time = None

    def _accel_to_angles(self, accel):
        """
        Calcula roll e pitch a partir do vetor de aceleração, assumindo
        que, em média, a única aceleração relevante é a gravidade.
        Isso é uma aproximação: com aceleração linear forte (arrancadas,
        freadas bruscas) o cálculo fica temporariamente impreciso, mas o
        filtro complementar já compensa isso dando mais peso ao giroscópio
        nesses momentos rápidos.
        """
        ax, ay, az = accel["x"], accel["y"], accel["z"]

        roll_acc = math.degrees(math.atan2(ay, math.sqrt(ax ** 2 + az ** 2)))
        pitch_acc = math.degrees(math.atan2(-ax, math.sqrt(ay ** 2 + az ** 2)))

        return roll_acc, pitch_acc

    def update(self, accel, gyro, dt=None):
        """
        Atualiza a estimativa de orientação com uma nova leitura.

        accel: dict {"x":, "y":, "z":} em m/s^2
        gyro:  dict {"x":, "y":, "z":} em graus/s
        dt: intervalo de tempo desde a última leitura (segundos).
            Se None, é calculado automaticamente com base no relógio.

        Retorna: dict {"roll":, "pitch":, "yaw":} em graus
        """
        now = time.time()
        if dt is None:
            if self._last_time is None:
                dt = 0.0
            else:
                dt = now - self._last_time
        self._last_time = now

        roll_acc, pitch_acc = self._accel_to_angles(accel)

        # Integração do giroscópio (curto prazo, sujeito a drift)
        roll_gyro = self.roll + gyro["x"] * dt
        pitch_gyro = self.pitch + gyro["y"] * dt
        yaw_gyro = self.yaw + gyro["z"] * dt

        # Combina: giroscópio pesa "alpha", acelerômetro pesa "(1 - alpha)"
        self.roll = self.alpha * roll_gyro + (1 - self.alpha) * roll_acc
        self.pitch = self.alpha * pitch_gyro + (1 - self.alpha) * pitch_acc

        # Yaw não tem correção via acelerômetro (ver docstring do módulo)
        self.yaw = yaw_gyro

        return {"roll": self.roll, "pitch": self.pitch, "yaw": self.yaw}

    def get_orientation(self):
        """Retorna a última orientação estimada sem atualizar o filtro."""
        return {"roll": self.roll, "pitch": self.pitch, "yaw": self.yaw}


# ----------------------------------------------------------------------
# Teste manual simples com dados sintéticos
# ----------------------------------------------------------------------
if __name__ == "__main__":
    filt = ComplementaryFilter()

    # Simula sensor parado e nivelado (accel só com gravidade no Z)
    fake_accel = {"x": 0.0, "y": 0.0, "z": 9.81}
    fake_gyro = {"x": 0.0, "y": 0.0, "z": 0.0}

    for _ in range(10):
        orientation = filt.update(fake_accel, fake_gyro, dt=0.1)
        print(orientation)
