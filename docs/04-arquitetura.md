# 4. Arquitetura Proposta

## 4.1 Visão Geral

O sistema é dividido em dois subsistemas que se comunicam via Wi-Fi/WebSocket:
um **backend embarcado** (Raspberry Pi + IMU MPU6050), responsável por
amostragem, calibração e filtragem cinemática, e um **frontend Web** (React +
Three.js), responsável por consumir a telemetria e renderizar o Gêmeo Digital.

```
┌─────────────────────────────────────────┐        Wi-Fi Hotspot         ┌──────────────────────────────────────┐
│              Raspberry Pi                │      (Robo-Network,         │              Navegador Web            │
│                                           │       10.42.0.1)            │                                       │
│  ┌───────────────┐   I2C   ┌───────────┐ │  ───────────────────────►   │  ┌─────────────────┐   ┌────────────┐ │
│  │  MPU6050 (IMU) │ ─────► │SensorReader│ │        Socket.IO            │  │ useSensorSocket  │──►│  Dashboard │ │
│  └───────────────┘         └─────┬─────┘ │   evento "telemetry"        │  │ (socket.io-client)│   │  (Recharts)│ │
│                                   │       │   porta 8765, ~50 Hz        │  └────────┬────────┘   └────────────┘ │
│                          ┌────────▼──────────┐                         │           │                            │
│                          │ ComplementaryFilter│                        │  ┌────────▼─────────┐                 │
│                          │  (Roll/Pitch/Yaw)  │                        │  │  RobotTwin /       │                 │
│                          └────────┬──────────┘                         │  │  TwinScene (R3F +  │                 │
│                          ┌────────▼──────────┐                         │  │  Three.js, lerp)   │                 │
│                          │ VelocityEstimator  │                        │  └────────────────────┘                 │
│                          │  (gravidade + ZUPT)│                        │                                       │
│                          └────────┬──────────┘                         │                                       │
│                          ┌────────▼──────────┐                         │                                       │
│                          │  WebSocketServer   │ ───────────────────────┘                                       │
│                          │ (Socket.IO/aiohttp)│                                                                 │
│                          └────────────────────┘                                                                 │
└───────────────────────────────────────────┘                            └──────────────────────────────────────┘
```

## 4.2 Backend Embarcado (`backend/`)

Loop principal orquestrado por `main.py`, executado a 50 Hz (RNF01):

1. **`sensor_reader.py`** — `SensorReader`: leitura crua do MPU6050 via I2C
   (`smbus2`), com calibração de offsets em repouso (`calibrate()`, RF01/RF02)
   e tratamento de erros de barramento sem interromper o loop (RNF04).
2. **`orientation_filter.py`** — `ComplementaryFilter`: fusão do acelerômetro
   e giroscópio (α = 0.96) para estimar Roll, Pitch e Yaw em graus (RF03).
3. **`velocity_estimator.py`** — `VelocityEstimator`: remove o vetor de
   gravidade da leitura de aceleração usando a orientação estimada e aplica
   ZUPT (*Zero Velocity Update*) para atenuar o *drift* de integração (RF04).
4. **`websocket_server.py`** — `WebSocketServer`: servidor Socket.IO sobre
   `aiohttp`, mantém os clientes conectados e faz *broadcast* do payload no
   evento `telemetry`, porta 8765 (RF05).
5. **`iniciar_wifi.sh`** — sobe a Raspberry Pi como Hotspot Wi-Fi autônomo
   (`Robo-Network`, gateway fixo `10.42.0.1`) via `nmcli`, dispensando
   roteador externo (RNF06).

Payload transmitido a cada ciclo:

```json
{
  "timestamp": 1690000000.123,
  "gyro":  { "x": 0.1, "y": -0.2, "z": 1.3 },
  "accel": { "x": 0.05, "y": 0.01, "z": 9.81 },
  "linear_velocity": { "x": 0.5, "y": 0.0, "z": 0.0 },
  "orientation": { "roll": 1.2, "pitch": -0.5, "yaw": 45.0 }
}
```

## 4.3 Frontend / Gêmeo Digital (`front/`)

Aplicação Web construída com **TanStack Start (React 19)**, **Three.js** via
`@react-three/fiber`/`@react-three/drei`, **Tailwind CSS** e
**socket.io-client**:

- **`services/websocket.ts`** e **`hooks/useSensorSocket.ts`** — conectam ao
  servidor Socket.IO do robô e expõem os pacotes de telemetria recebidos,
  com suporte a modo Mock e conexão real (RF08).
- **`hooks/usePositionTracker.ts`** — integra a velocidade linear recebida
  para estimar a posição do protótipo no espaço.
- **`components/TwinScene.tsx`**, **`RobotTwin.tsx`**, **`TrailPath.tsx`** —
  cena 3D do Gêmeo Digital: aplicam a orientação (Roll/Pitch/Yaw) ao modelo
  com interpolação linear (*lerp*) no loop de animação do R3F, evitando
  re-renders do React a cada pacote do socket (RNF05, RF07).
- **`routes/dashboard.tsx`** — painel com gráficos (Recharts) da telemetria.
- **`routes/twin.tsx`** — rota do Gêmeo Digital 3D.
- **`components/Sidebar.tsx`** — navegação entre Home, Dashboard e Twin.

## 4.4 Comunicação

- Transporte: Wi-Fi local via Hotspot dedicado (sem depender de infraestrutura
  externa), com Socket.IO sobre WebSocket na porta `8765` (RF05/RF06/RNF02).
- Frequência: amostragem e *broadcast* a 50 Hz no backend (RNF01); o frontend
  consome esse fluxo e interpola visualmente para manter fluidez (RNF05).

## 4.5 Próximos Refinamentos

- Implementar a lógica de **detecção de acidente** (pico de aceleração + queda
  de velocidade + inclinação anômala) descrita na motivação, hoje ainda não
  presente como módulo dedicado no backend.
- Adicionar testes automatizados de integração cobrindo o pipeline completo
  sensor → filtro → WebSocket → frontend.
